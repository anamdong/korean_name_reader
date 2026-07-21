import { basename } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const [outputPath, ...inputPaths] = process.argv.slice(2);

if (!outputPath || !inputPaths.length) {
  console.error("Usage: node scripts/build_hanja_usage_rank.mjs <output.json> <ohmybaby_rank_page.html>...");
  process.exit(1);
}

const HANJA_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const HANJA_BEFORE_MEANING_RE = /([\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF])\(/g;

function pageMetaFromPath(filePath) {
  const match = basename(filePath).match(/(\d{4})_(boy|girl)/);
  const year = match ? Number(match[1]) : null;
  const gender = match?.[2] || "unknown";
  return {
    year,
    gender,
    url: year && gender !== "unknown" ? `https://www.ohmybaby.kr/rankings/${year}/${gender}` : "",
  };
}

function extractItemLists(html) {
  const out = [];
  const scriptRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const match of html.matchAll(scriptRe)) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed?.["@type"] === "ItemList") out.push(parsed);
    } catch {
      // Ignore unrelated or malformed structured-data scripts.
    }
  }
  return out;
}

function representativeHanja(description) {
  return [...String(description || "").matchAll(HANJA_BEFORE_MEANING_RE)].map((match) => match[1]).join("");
}

function entryWeight(year, position) {
  const recency = year === 2026 ? 1.18 : 1;
  return (61 - Number(position || 60)) * recency;
}

const givenNameMap = new Map();
const characterMap = new Map();
const sourceUrls = new Set();
const sourcePages = [];

function pushScored(map, key, create, score, source) {
  const current = map.get(key) || create();
  current.score += score;
  current.sources.push(source);
  if (!current.bestRank || source.rank < current.bestRank) current.bestRank = source.rank;
  map.set(key, current);
}

for (const inputPath of inputPaths) {
  const html = readFileSync(inputPath, "utf8");
  const page = pageMetaFromPath(inputPath);
  if (page.url) sourceUrls.add(page.url);
  const itemLists = extractItemLists(html);
  let itemCount = 0;

  for (const itemList of itemLists) {
    for (const item of itemList.itemListElement || []) {
      const hangul = String(item.name || "").trim();
      const hanja = representativeHanja(item.description);
      const hangulChars = Array.from(hangul);
      const hanjaChars = Array.from(hanja);
      if (!hangul || !hanja || hangulChars.length !== hanjaChars.length || !HANJA_RE.test(hanja)) continue;

      itemCount += 1;
      const rank = Number(item.position || itemCount);
      const score = entryWeight(page.year, rank);
      const source = { year: page.year, gender: page.gender, rank };

      pushScored(
        givenNameMap,
        `${hangul}:${hanja}`,
        () => ({ hangul, hanja, score: 0, bestRank: null, sources: [] }),
        score,
        source,
      );

      for (const [index, char] of hanjaChars.entries()) {
        const reading = hangulChars[index];
        pushScored(
          characterMap,
          `${reading}:${char}`,
          () => ({ reading, char, score: 0, bestRank: null, examples: new Set(), sources: [] }),
          score,
          source,
        );
        characterMap.get(`${reading}:${char}`).examples.add(hangul);
      }
    }
  }

  sourcePages.push({ ...page, itemCount });
}

const givenNames = {};
for (const entry of givenNameMap.values()) {
  const bucket = givenNames[entry.hangul] || [];
  bucket.push({
    hanja: entry.hanja,
    score: Number(entry.score.toFixed(3)),
    bestRank: entry.bestRank,
    sources: entry.sources,
  });
  givenNames[entry.hangul] = bucket;
}

for (const bucket of Object.values(givenNames)) {
  bucket.sort((a, b) => b.score - a.score || a.bestRank - b.bestRank || a.hanja.localeCompare(b.hanja));
}

const charactersByReading = {};
for (const entry of characterMap.values()) {
  const bucket = charactersByReading[entry.reading] || [];
  bucket.push({
    char: entry.char,
    score: Number(entry.score.toFixed(3)),
    bestRank: entry.bestRank,
    examples: [...entry.examples].slice(0, 8),
    sources: entry.sources,
  });
  charactersByReading[entry.reading] = bucket;
}

for (const bucket of Object.values(charactersByReading)) {
  bucket.sort((a, b) => b.score - a.score || a.bestRank - b.bestRank || a.char.localeCompare(b.char));
}

const characters = Object.values(charactersByReading)
  .flat()
  .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank || a.char.localeCompare(b.char));

const payload = {
  meta: {
    source: "Oh My Baby 2025/2026 top-50 baby-name pages; representative Hanja spellings rank-weighted as a modern usage prior.",
    sourceUrls: [...sourceUrls],
    sourcePages,
    givenNameCount: Object.keys(givenNames).length,
    characterReadingCount: characters.length,
    caveat: "This is a rank-weighted representative-Hanja prior, not an official per-character registry count.",
  },
  givenNames,
  charactersByReading,
  characters,
};

writeFileSync(outputPath, `${JSON.stringify(payload)}\n`);
