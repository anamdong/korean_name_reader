#!/usr/bin/env python3
"""Build compact bon-gwan shares from the official KOSIS census export."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


SURNAME_PATTERN = re.compile(r"^(?P<hangul>.+)\((?P<hanja>.+)\)$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="KOSIS 101_DT_1IN15SB_F_2015.csv")
    parser.add_argument("output", type=Path, help="Destination JSON file")
    return parser.parse_args()


def clean_code(value: str) -> str:
    return value.lstrip("'").strip()


def read_nationwide_rows(source: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    with source.open(encoding="cp949", newline="") as stream:
        for row in csv.reader(stream):
            if len(row) < 6 or clean_code(row[2]) != "00" or row[4] != "2015":
                continue
            try:
                count = int(float(row[5]))
            except ValueError:
                continue
            rows.append({"code": clean_code(row[0]), "label": row[1].strip(), "count": count})
    return rows


def build_payload(rows: list[dict[str, object]]) -> dict[str, object]:
    parents: dict[str, dict[str, object]] = {}
    children: dict[str, list[dict[str, object]]] = {}

    for row in rows:
        code = str(row["code"])
        label = str(row["label"])
        if len(code) == 4:
            match = SURNAME_PATTERN.match(label)
            if not match:
                continue
            parents[code] = {
                "hangul": match.group("hangul"),
                "hanja": match.group("hanja"),
                "total": int(row["count"]),
            }
        elif len(code) == 8 and code[:4] != "0000":
            children.setdefault(code[:4], []).append(
                {
                    "name": label,
                    "count": int(row["count"]),
                    "otherCombined": label == "기타",
                }
            )

    surnames: dict[str, object] = {}
    for code, parent in parents.items():
        clans = sorted(children.get(code, []), key=lambda item: (-int(item["count"]), str(item["name"])))
        if not clans:
            continue
        child_total = sum(int(item["count"]) for item in clans)
        if child_total != int(parent["total"]):
            raise ValueError(
                f"Bon-gwan counts do not reconcile for {parent['hangul']}({parent['hanja']}): "
                f"{child_total} != {parent['total']}"
            )
        key = f'{parent["hangul"]}|{parent["hanja"]}'
        surnames[key] = {**parent, "clans": clans}

    return {
        "meta": {
            "title": "Population by surname and bon-gwan - nationwide",
            "source": "KOSIS Population and Housing Census",
            "sourceTable": "DT_1IN15SB",
            "sourceUrl": "https://kosis.kr/statHtml/statHtml.do?orgId=101&tblId=DT_1IN15SB&conn_path=I2",
            "downloadUrl": "https://kosis.kr/statisticsList/mass/mass_list.jsp?org_id=101&tbl_id=DT_1IN15SB&vw_cd=MT_ZTITLE&list_id=A41_10&process=statHtml",
            "referenceDate": "2015-11-01",
            "year": 2015,
            "geography": "Nationwide",
            "note": "Bon-gwan with fewer than 1,000 people are combined in the source table's 기타 category.",
            "surnameCount": len(surnames),
            "allSurnameTotalsReconciled": True,
        },
        "surnames": surnames,
    }


def main() -> None:
    args = parse_args()
    payload = build_payload(read_nationwide_rows(args.source))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
