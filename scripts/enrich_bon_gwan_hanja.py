#!/usr/bin/env python3
"""Attach surname-specific Hanja labels to the KOSIS bon-gwan dataset.

The KOSIS export supplies bon-gwan labels in Hangul. Several labels are
homographs, so they cannot be converted safely with a global place-name map.
This script resolves each exact surname and bon-gwan pair against a clan index,
using the census count to disambiguate duplicate historical readings.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from html.parser import HTMLParser
import json
import re
import unicodedata
from pathlib import Path


ENTRY_PATTERN = re.compile(
    r"^\s*(?P<rank>\d+)\.\s*"
    r"(?P<place>[가-힣 ]+?)\s+(?P<surname>[가-힣]+)씨\s*"
    r"[({]\s*(?P<place_hanja>[\u3400-\u9fff\uf900-\ufaff ]+?)\s+"
    r"(?P<surname_hanja>[\u3400-\u9fff\uf900-\ufaff]+)氏\s*[)\]}]?\s*"
    r"-\s*(?P<count>[\d,.]+)(?P<tail>.*)$"
)

# Reviewed exceptions cover malformed source rows, orthographic variants, and
# exact surname-place pairs that cannot be inferred from a Hangul label alone.
REVIEWED_OVERRIDES = {
    ("고|高", "장흥"): "長興",
    ("고|高", "장택"): "長澤",
    ("고|高", "청주"): "淸州",
    ("고|高", "안동"): "安東",
    ("김|金", "안동"): "安東",
    ("김|金", "사천"): "泗川",
    ("김|金", "광주"): "廣州",
    ("문|文", "감천"): "甘泉",
    ("배|裵", "곤산"): "昆山",
    ("변|邊", "황주"): "黃州",
    ("설|?", "경주"): "慶州",
    ("설|薛", "경주"): "慶州",
    ("송|宋", "연안"): "延安",
    ("엄|嚴", "영성"): "寧城",
    ("이|李", "공산"): "公山",
    ("임|林", "풍천"): "豐川",
    ("편|片", "석강"): "石江",
    ("편|片", "나주"): "羅州",
    ("현|玄", "성주"): "星州",
    ("현|玄", "창원"): "昌原",
    ("현|玄", "순천"): "順天",
    ("현|玄", "연일"): "延日",
    ("황|黃", "창원"): "昌原",
    ("황|黃", "회산"): "檜山",
    ("황|黃", "제안"): "齊安",
    ("황|黃", "창녕"): "昌寧",
}

SURNAME_VARIANTS = str.maketrans(
    {
        "髙": "高",
        "晋": "晉",
        "豊": "豐",
        "邉": "邊",
        "邊": "邊",
        "黄": "黃",
    }
)


@dataclass(frozen=True)
class ClanIndexEntry:
    rank: int
    place: str
    surname: str
    place_hanja: str
    surname_hanja: str
    count: int
    aliases: str


class ParagraphParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._depth = 0
        self._parts: list[str] = []
        self.paragraphs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "p":
            if self._depth == 0:
                self._parts = []
            self._depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag != "p" or self._depth == 0:
            return
        self._depth -= 1
        if self._depth == 0:
            text = " ".join("".join(self._parts).split())
            if text:
                self.paragraphs.append(text)

    def handle_data(self, data: str) -> None:
        if self._depth:
            self._parts.append(data)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="KOSIS bon_gwan_by_surname.json")
    parser.add_argument("clan_index", type=Path, help="Saved clan ranking/index HTML")
    parser.add_argument("output", type=Path, help="Destination enriched JSON")
    return parser.parse_args()


def canonical_hanja(value: str) -> str:
    return unicodedata.normalize("NFKC", value).translate(SURNAME_VARIANTS)


def parse_count(value: str) -> int:
    return int(value.replace(",", "").replace(".", ""))


def parse_clan_index(source: Path) -> list[ClanIndexEntry]:
    parser = ParagraphParser()
    parser.feed(source.read_text(encoding="utf-8"))
    entries: list[ClanIndexEntry] = []
    for paragraph in parser.paragraphs:
        match = ENTRY_PATTERN.match(paragraph)
        if not match:
            continue
        entries.append(
            ClanIndexEntry(
                rank=int(match.group("rank")),
                place=match.group("place").strip(),
                surname=match.group("surname").strip(),
                place_hanja=canonical_hanja(match.group("place_hanja").replace(" ", "")),
                surname_hanja=canonical_hanja(match.group("surname_hanja")),
                count=parse_count(match.group("count")),
                aliases=(match.group("tail").split(";", 1)[1] if ";" in match.group("tail") else ""),
            )
        )
    if not entries:
        raise ValueError(f"No clan index rows were parsed from {source}")
    return entries


def surname_matches(surname_key: str, entry: ClanIndexEntry) -> bool:
    hangul, hanja = surname_key.split("|", 1)
    if hanja == "?":
        return entry.surname == hangul
    # Initial-sound-law spellings vary between sources (류/유, 라/나, etc.).
    # The exact surname Hanja is the stable identity in those cases.
    return canonical_hanja(hanja) == entry.surname_hanja


def alias_hanja(name: str, entry: ClanIndexEntry) -> str:
    match = re.search(
        rf"(?<![가-힣]){re.escape(name)}\s*\(([\u3400-\u9fff\uf900-\ufaff]+)\)",
        entry.aliases,
    )
    return canonical_hanja(match.group(1)) if match else entry.place_hanja


def resolve_hanja(
    surname_key: str,
    name: str,
    count: int,
    entries: list[ClanIndexEntry],
) -> str | None:
    reviewed = REVIEWED_OVERRIDES.get((surname_key, name))
    if reviewed:
        return reviewed
    candidates: list[tuple[int, int, int, str]] = []
    for entry in entries:
        if not surname_matches(surname_key, entry):
            continue
        if entry.place == name:
            candidates.append((0, abs(entry.count - count), entry.rank, entry.place_hanja))
        elif name in entry.aliases:
            candidates.append((1, abs(entry.count - count), entry.rank, alias_hanja(name, entry)))
    if candidates:
        return min(candidates)[3]
    return None


def enrich_payload(payload: dict[str, object], entries: list[ClanIndexEntry]) -> dict[str, object]:
    unresolved: list[str] = []
    resolved_count = 0
    surnames = payload.get("surnames")
    if not isinstance(surnames, dict):
        raise ValueError("The source JSON has no surnames object")

    for surname_key, record in surnames.items():
        if not isinstance(record, dict):
            continue
        clans = record.get("clans", [])
        if not isinstance(clans, list):
            continue
        for clan in clans:
            if not isinstance(clan, dict) or clan.get("otherCombined"):
                continue
            name = str(clan.get("name", ""))
            count = int(clan.get("count", 0))
            hanja = resolve_hanja(str(surname_key), name, count, entries)
            if not hanja:
                unresolved.append(f"{surname_key}:{name}")
                continue
            clan["hanja"] = hanja
            resolved_count += 1

    if unresolved:
        raise ValueError("Unresolved bon-gwan Hanja: " + ", ".join(unresolved))

    meta = payload.setdefault("meta", {})
    if not isinstance(meta, dict):
        raise ValueError("The source JSON meta value is not an object")
    meta.update(
        {
            "bonGwanHanjaSource": "Korean clan and historical-place indexes",
            "bonGwanHanjaSourceUrl": "https://ph3588.tistory.com/4",
            "bonGwanHanjaReferenceUrl": "https://www.surname.info/local.html",
            "bonGwanHanjaResolvedCount": resolved_count,
            "bonGwanHanjaPairSpecific": True,
        }
    )
    return payload


def main() -> None:
    args = parse_args()
    payload = json.loads(args.source.read_text(encoding="utf-8"))
    enriched = enrich_payload(payload, parse_clan_index(args.clan_index))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(enriched, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
