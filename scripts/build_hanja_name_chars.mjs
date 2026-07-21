import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const [nameIndexPath, unihanZipPath, outputPath] = process.argv.slice(2);

if (!nameIndexPath || !unihanZipPath || !outputPath) {
  console.error("Usage: node scripts/build_hanja_name_chars.mjs <name_index.json> <Unihan.zip> <output.json>");
  process.exit(1);
}

const nameIndex = JSON.parse(readFileSync(nameIndexPath, "utf8"));
const unihanText = execFileSync("unzip", ["-p", unihanZipPath], {
  encoding: "utf8",
  maxBuffer: 80 * 1024 * 1024,
});
const compoundSurnames = new Set(nameIndex.meta?.compoundSurnames || []);
const preciseGivenHanjaEvidence = buildPreciseGivenHanjaEvidence();

function splitNameUnits(name) {
  const surnameLength = name.length >= 3 && compoundSurnames.has(name.slice(0, 2)) ? 2 : 1;
  return {
    surname: name.slice(0, surnameLength),
    given: name.slice(surnameLength),
  };
}

function buildPreciseGivenHanjaEvidence() {
  const evidence = new Map();
  for (const row of nameIndex.fullNames || []) {
    if (!row?.hangul || !row?.hanja) continue;
    const hangulChars = Array.from(row.hangul);
    const hanjaChars = Array.from(row.hanja);
    if (hangulChars.length !== hanjaChars.length) continue;

    const { surname, given } = splitNameUnits(row.hangul);
    const surnameLength = Array.from(surname).length;
    const givenChars = Array.from(given);
    const givenHanjaChars = hanjaChars.slice(surnameLength);
    if (givenChars.length !== givenHanjaChars.length) continue;

    for (const [index, reading] of givenChars.entries()) {
      const char = givenHanjaChars[index];
      const key = `${char}:${reading}`;
      evidence.set(key, (evidence.get(key) || 0) + Number(row.weight || 1));
    }
  }
  return evidence;
}

function syllablePopularity(reading) {
  const syllable = nameIndex.syllables?.[reading] || {};
  return (
    Math.log1p(Number(syllable.givenCount || 0) + Number(syllable.nameCount || 0)) * 18 +
    Math.log1p(Number(syllable.decadeWeight || 0)) * 10 +
    Math.log1p(Number(syllable.hanjaGivenCount || 0)) * 28 +
    (syllable.sinoAllowed ? 38 : 0)
  );
}

function localHanjaEvidence(char, reading) {
  return preciseGivenHanjaEvidence.get(`${char}:${reading}`) || 0;
}

function flagScore(flags) {
  let score = 0;
  if (flags.includes("N")) score += 280;
  if (flags.includes("E")) score += 110;
  if (flags.includes("0")) score += 45;
  if (flags.includes("1")) score += 28;
  if (flags.includes("X")) score -= 600;
  return score;
}

const candidates = [];
const seen = new Set();

for (const line of unihanText.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const [codePoint, property, value] = line.split("\t");
  if (property !== "kHangul" || !value) continue;
  const char = String.fromCodePoint(Number.parseInt(codePoint.replace("U+", ""), 16));

  for (const entry of value.split(/\s+/)) {
    const [reading, flags = ""] = entry.split(":");
    if (!/^[가-힣]$/.test(reading || "")) continue;
    if (!flags.includes("N") && !localHanjaEvidence(char, reading)) continue;

    const key = `${char}:${reading}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const observedScore = localHanjaEvidence(char, reading);
    const score =
      (observedScore ? 10000 + observedScore * 520 : 0) +
      syllablePopularity(reading) +
      flagScore(flags);

    candidates.push({
      char,
      reading,
      flags,
      observedScore: Number(observedScore.toFixed(3)),
      score: Number(score.toFixed(3)),
    });
  }
}

const topCharacters = candidates
  .sort((a, b) => b.score - a.score || a.char.localeCompare(b.char))
  .slice(0, 1000);

const charactersByReading = {};
for (const item of topCharacters) {
  const bucket = charactersByReading[item.reading] || [];
  bucket.push({
    char: item.char,
    score: item.score,
    flags: item.flags,
    observedScore: item.observedScore,
  });
  charactersByReading[item.reading] = bucket;
}

for (const bucket of Object.values(charactersByReading)) {
  bucket.sort((a, b) => b.score - a.score || a.char.localeCompare(b.char));
}

const payload = {
  meta: {
    source: "Unicode Unihan kHangul name-use readings ranked with this app's modern given-name evidence",
    sourceFile: "Unihan.zip/kHangul",
    characterCount: topCharacters.length,
    readingCount: Object.keys(charactersByReading).length,
    ranking: "Observed app Hanja-given evidence first; remaining name-use Hanja ranked by modern Hangul given-name signals.",
  },
  characters: topCharacters,
  charactersByReading,
};

writeFileSync(outputPath, `${JSON.stringify(payload)}\n`);
