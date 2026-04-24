const dataUrl = "./data/name_index.json";

const state = {
  data: null,
  runtime: null,
};

const scriptPatterns = {
  hangul: /[가-힣]/g,
  latin: /[A-Za-zÀ-ȳŏŭŎŬ]/g,
  kana: /[ァ-ヶー゛゜ぁ-ゖゝゞ]/g,
  hanja: /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g,
};

const resultTemplate = document.querySelector("#result-template");
const resultsEl = document.querySelector("#results");
const queryEl = document.querySelector("#query");
const formEl = document.querySelector("#search-form");
const detectedScriptsEl = document.querySelector("#detected-scripts");

const compoundSurnamesFallback = new Set(["남궁", "황보", "선우", "제갈", "사공", "서문", "독고", "동방", "어금", "망절"]);
const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_ONSETS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const HANGUL_VOWELS = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const HANGUL_CODAS = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function stripDiacritics(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeLatin(text) {
  return stripDiacritics(text).toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeKana(text) {
  return Array.from(text)
    .map((char) => {
      const code = char.codePointAt(0);
      if (code >= 0x3041 && code <= 0x3096) {
        return String.fromCodePoint(code + 0x60);
      }
      if (/[ 　・･\-\u2010-\u2015]/.test(char)) {
        return "";
      }
      return char;
    })
    .join("");
}

function extractHangul(text) {
  return (text.match(/[가-힣]/g) || []).join("");
}

function extractHanja(text) {
  return (text.match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g) || []).join("");
}

function detectScripts(text) {
  const labels = [];
  if ((text.match(scriptPatterns.hangul) || []).length) labels.push("Hangul");
  if ((text.match(scriptPatterns.latin) || []).length) labels.push("Roman");
  if ((text.match(scriptPatterns.kana) || []).length) labels.push("Kana");
  if ((text.match(scriptPatterns.hanja) || []).length) labels.push("Hanja");
  return labels;
}

function romanTextToTokenish(text) {
  return stripDiacritics(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[._,/()[\]{}（）]+/g, " ")
    .replace(/[‐‑‒–—―]+/g, "-");
}

function splitRomanGroups(text) {
  return romanTextToTokenish(text)
    .split(/\s+/)
    .map((group) => (group.match(/[A-Za-z]+/g) || []).map((token) => token.toLowerCase()).filter(Boolean))
    .filter((group) => group.length);
}

function splitRomanTokens(text) {
  return splitRomanGroups(text).flat();
}

function hasRomanVowel(text) {
  return /[aeiouy]/.test(text);
}

function expandRomanTokenVariants(token) {
  const norm = normalizeLatin(token);
  if (!norm) return [];
  const variants = [{ token: norm, penalty: 0 }];
  const replacements = [
    ["kyoung", "kyung", 6],
    ["jeoun", "jeon", 5],
    ["yeoun", "yeon", 5],
    ["yea", "ye", 5],
    ["june", "jun", 2],
    ["joon", "jun", 2],
    ["choon", "chun", 2],
    ["aeh", "ae", 2],
  ];
  for (const [from, to, penalty] of replacements) {
    if (norm.includes(from)) {
      variants.push({ token: norm.replaceAll(from, to), penalty });
    }
  }
  if (norm === "ion") {
    variants.push({ token: "yeon", penalty: 5 });
  }
  if (/^eu(?:l|r)?i/.test(norm)) {
    variants.push({
      token: norm.replace(/^eu/, "yu"),
      penalty: 3,
    });
  }
  if (/[aeiou]h(?=[bcdfghjklmnpqrstvwxyz]|$)/.test(norm)) {
    variants.push({
      token: norm.replace(/([aeiou])h(?=[bcdfghjklmnpqrstvwxyz]|$)/g, "$1"),
      penalty: 4,
    });
  }
  return dedupeScoredByField(variants, "token", "score", 8).map((item) => ({
    token: item.token,
    penalty: variants.find((variant) => variant.token === item.token)?.penalty || 0,
  }));
}

function splitKanaTokens(text) {
  return text
    .replace(/[・･]/g, " ")
    .split(/[\s\u3000\-]+/)
    .map((token) => normalizeKana(token))
    .filter(Boolean);
}

function splitKanaSpaceGroups(text) {
  return (text || "")
    .split(/[\s\u3000]+/)
    .map((token) => normalizeKana(token))
    .filter(Boolean);
}

function tokenizeByScript(text) {
  const groups = [];
  let current = "";
  let currentType = null;
  for (const char of Array.from(text)) {
    let type = null;
    if (/[가-힣]/.test(char)) type = "hangul";
    else if (/[A-Za-zÀ-ȳŏŭŎŬ]/.test(char)) type = "latin";
    else if (/[ァ-ヶー゛゜ぁ-ゖゝゞ]/.test(char)) type = "kana";
    else if (/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(char)) type = "hanja";
    else type = "sep";

    if (type === "sep") {
      if (current) groups.push({ type: currentType, text: current });
      current = "";
      currentType = null;
      continue;
    }
    if (type === currentType) {
      current += char;
    } else {
      if (current) groups.push({ type: currentType, text: current });
      current = char;
      currentType = type;
    }
  }
  if (current) groups.push({ type: currentType, text: current });
  return groups;
}

function splitNameUnits(name, compoundSurnames) {
  const compounds = compoundSurnames || compoundSurnamesFallback;
  const surnameLength = name.length >= 3 && compounds.has(name.slice(0, 2)) ? 2 : 1;
  return {
    surname: name.slice(0, surnameLength),
    given: name.slice(surnameLength),
    units: Array.from(name.slice(0, surnameLength)).concat(Array.from(name.slice(surnameLength))),
  };
}

function decomposeHangulSyllable(syllable) {
  if (!syllable || syllable.length !== 1) return null;
  const code = syllable.codePointAt(0);
  if (code < HANGUL_BASE || code > HANGUL_END) return null;
  const offset = code - HANGUL_BASE;
  const onset = HANGUL_ONSETS[Math.floor(offset / 588)];
  const vowel = HANGUL_VOWELS[Math.floor((offset % 588) / 28)];
  const coda = HANGUL_CODAS[offset % 28];
  return { onset, vowel, coda };
}

function requiredPlainOnsetForVoicedKana(text) {
  const norm = normalizeKana(text || "");
  const mapping = [
    ["ジャ", "ㅈ"], ["ジュ", "ㅈ"], ["ジョ", "ㅈ"], ["ジェ", "ㅈ"], ["ジ", "ㅈ"],
    ["ヂャ", "ㄷ"], ["ヂュ", "ㄷ"], ["ヂョ", "ㄷ"], ["ヂェ", "ㄷ"], ["ヂ", "ㄷ"],
    ["ガ", "ㄱ"], ["ギ", "ㄱ"], ["グ", "ㄱ"], ["ゲ", "ㄱ"], ["ゴ", "ㄱ"],
    ["ダ", "ㄷ"], ["デ", "ㄷ"], ["ド", "ㄷ"],
    ["バ", "ㅂ"], ["ビ", "ㅂ"], ["ブ", "ㅂ"], ["ベ", "ㅂ"], ["ボ", "ㅂ"],
  ];
  for (const [prefix, onset] of mapping) {
    if (norm.startsWith(prefix)) return onset;
  }
  return null;
}

function filterKanaChunkCandidates(chunk, items) {
  if (!items?.length) return [];
  const requiredOnset = requiredPlainOnsetForVoicedKana(chunk);
  if (!requiredOnset) return items;
  const filtered = items.filter((item) => decomposeHangulSyllable(item.hangul)?.onset === requiredOnset);
  return filtered.length ? filtered : items;
}

function syntheticKanaCandidateScore(hangul, scale = 1) {
  const syllableData = state.data?.syllables?.[hangul];
  if (!syllableData) return 0;
  const observed = Number(syllableData.givenCount || 0) + Number(syllableData.nameCount || 0);
  const decadeWeight = Number(syllableData.decadeWeight || 0);
  const hanjaGivenCount = Number(syllableData.hanjaGivenCount || 0);
  let score = Math.log1p(observed) * 8 + Math.log1p(decadeWeight) * 5 + Math.log1p(hanjaGivenCount) * 10;
  if (isAllowedNameSyllable(hangul)) score += 12;
  if (isUltraRareGivenSyllable(hangul)) score -= 18;
  return Math.max(1.2, score * scale);
}

function syntheticSurnameKanaCandidateScore(hangul, scale = 1) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  if (!surnameData) return 0;
  const population = Number(surnameData.population || 0);
  return Math.max(1.2, Math.log1p(population) * 14 * scale);
}

function mergeKanaCandidateLists(primary, synthetic, targetField = "hangul", limit = 12) {
  return dedupeScoredByField([...(primary || []), ...(synthetic || [])], targetField, "score", limit);
}

function isBlockedUnsupportedComplexCodaSyllable(syllable) {
  const parts = decomposeHangulSyllable(syllable);
  if (!parts?.coda || parts.coda.length <= 1) return false;
  return !isSinoAllowedSyllable(syllable);
}

function kanaSyllableAliases(chunk) {
  const norm = normalizeKana(chunk);
  const aliases = [];
  if (norm === "ガン") {
    aliases.push(
      { hangul: "광", score: syntheticKanaCandidateScore("광", 0.88) },
      { hangul: "관", score: syntheticKanaCandidateScore("관", 0.82) },
    );
  }
  if (norm === "コン" || norm === "ゴン") {
    aliases.push({ hangul: "권", score: syntheticKanaCandidateScore("권", norm === "ゴン" ? 0.92 : 0.84) });
  }
  return aliases.filter((item) => item.score > 0);
}

function kanaSurnameAliases(token) {
  const norm = normalizeKana(token);
  const aliases = [];
  if (norm === "コン" || norm === "ゴン") {
    aliases.push({ hangul: "권", score: syntheticSurnameKanaCandidateScore("권", norm === "ゴン" ? 0.96 : 0.88) });
  }
  return aliases.filter((item) => item.score > 0);
}

function isDuumShiftedSurfaceSyllable(syllable) {
  const parts = decomposeHangulSyllable(syllable);
  return !!parts && canRecoverDuumShiftedInitial(parts);
}

function lookupKanaChunkCandidates(chunk) {
  const exact = filterKanaChunkCandidates(chunk, state.data.syllableKanaIndex[normalizeKana(chunk)] || []);
  const aliased = filterKanaChunkCandidates(chunk, kanaSyllableAliases(chunk));
  const merged = mergeKanaCandidateLists(exact, aliased, "hangul", 12);
  const filtered = merged.filter((item) => !isBlockedUnsupportedComplexCodaSyllable(item.hangul));
  const pool = filtered.length ? filtered : merged;
  const evidenceBacked = pool.filter((item) => hasGivenSyllableEvidence(item.hangul) || isAllowedNameSyllable(item.hangul));
  if (evidenceBacked.length) return evidenceBacked;
  if (pool.length && isDuumShiftedSurfaceSyllable(pool[0].hangul)) {
    return [pool[0]];
  }
  return pool;
}

function applyNieunLiaison(nextKana) {
  const text = normalizeKana(nextKana);
  const mapping = [
    ["ヒャ", "ニャ"],
    ["ヒュ", "ニュ"],
    ["ヒョ", "ニョ"],
    ["ヒェ", "ニェ"],
    ["ファ", "ナ"],
    ["フィ", "ニ"],
    ["フェ", "ネ"],
    ["フォ", "ノ"],
    ["ハ", "ナ"],
    ["ヒ", "ニ"],
    ["フ", "ヌ"],
    ["ヘ", "ネ"],
    ["ホ", "ノ"],
    ["イェ", "ニェ"],
    ["ヤ", "ニャ"],
    ["ユ", "ニュ"],
    ["ヨ", "ニョ"],
    ["ア", "ナ"],
    ["イ", "ニ"],
    ["ウ", "ヌ"],
    ["エ", "ネ"],
    ["オ", "ノ"],
  ];
  for (const [from, to] of mapping) {
    if (text.startsWith(from)) {
      return `${to}${text.slice(from.length)}`;
    }
  }
  return null;
}

function generateLiaisonKanaVariants(parts, syllables) {
  let surfaces = [{ text: parts.join("\u0000"), scoreScale: 1 }];
  for (let index = 1; index < parts.length; index += 1) {
    const previous = decomposeHangulSyllable(syllables[index - 1]);
    const current = decomposeHangulSyllable(syllables[index]);
    if (!previous || !current) continue;
    if (previous.coda !== "ㄴ" || !["ㅇ", "ㅎ"].includes(current.onset)) continue;

    const nextSurface = [];
    for (const surface of surfaces) {
      nextSurface.push(surface);
      const currentParts = surface.text ? surface.text.split("\u0000") : parts.slice();
      const previousPart = currentParts[index - 1] || "";
      const currentPart = currentParts[index] || "";
      if (!previousPart.endsWith("ン")) continue;
      const liaison = applyNieunLiaison(currentPart);
      if (!liaison) continue;
      const mergedParts = currentParts.slice();
      mergedParts[index - 1] = previousPart.slice(0, -1);
      mergedParts[index] = liaison;
      nextSurface.push({
        text: mergedParts.join("\u0000"),
        scoreScale: surface.scoreScale * 0.93,
      });
    }
    surfaces = dedupeScoredByField(
      nextSurface.map((item) => ({ surface: item.text, score: item.scoreScale })),
      "surface",
      "score",
      12,
    ).map((item) => ({ text: item.surface, scoreScale: item.score }));
  }

  return surfaces.map((item) => ({
    text: item.text.split("\u0000").join(""),
    scoreScale: item.scoreScale,
  }));
}

function normalizeKanaPartForSyllable(part, syllable, hasFollowingPart = true) {
  if (!part) return part;
  if (hasFollowingPart && part.endsWith("ング")) return `${part.slice(0, -2)}ン`;
  const decomposed = decomposeHangulSyllable(syllable);
  if (decomposed?.coda === "ㅇ" && part.endsWith("グ")) return `${part.slice(0, -1)}ン`;
  return part;
}

function normalizeKanaPartsForJoin(parts, syllables = []) {
  return parts.map((part, index) => normalizeKanaPartForSyllable(part, syllables[index], index < parts.length - 1));
}

function normalizeKanaJoinPart(part, syllable, hasFollowingPart = true) {
  return normalizeKanaPartForSyllable(part, syllable, hasFollowingPart);
}

function unvoiceInitialGiyeokKana(text) {
  if (!text) return text;
  const replacements = [
    ["ギャ", "キャ"],
    ["ギュ", "キュ"],
    ["ギョ", "キョ"],
    ["ギェ", "キェ"],
    ["グァ", "クァ"],
    ["グェ", "クェ"],
    ["グィ", "クィ"],
    ["グォ", "クォ"],
    ["ガ", "カ"],
    ["ギ", "キ"],
    ["グ", "ク"],
    ["ゲ", "ケ"],
    ["ゴ", "コ"],
  ];
  for (const [from, to] of replacements) {
    if (text.startsWith(from)) return `${to}${text.slice(from.length)}`;
  }
  return text;
}

function augmentInitialGivenKanaVariants(syllable, variants, syllableIndex) {
  if (syllableIndex !== 0 || !variants?.length) return variants || [];
  const parts = decomposeHangulSyllable(syllable);
  if (!parts || parts.onset !== "ㄱ") return variants;
  const augmented = [...variants];
  for (const variant of variants) {
    const unvoiced = unvoiceInitialGiyeokKana(variant.text);
    if (!unvoiced || unvoiced === variant.text) continue;
    if (augmented.some((item) => item.text === unvoiced)) continue;
    augmented.push({
      text: unvoiced,
      score: Number(variant.score) * 0.62,
    });
  }
  return augmented.sort((a, b) => Number(b.score) - Number(a.score));
}

function dedupeScored(items, textKey = "text", scoreKey = "score", limit = 8) {
  const map = new Map();
  for (const item of items) {
    const key = item[textKey];
    const score = Number(item[scoreKey]) || 0;
    map.set(key, Math.max(score, map.get(key) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text, score]) => ({ text, score }));
}

function dedupeScoredByField(items, fieldKey, scoreKey = "score", limit = 8) {
  const map = new Map();
  for (const item of items) {
    const key = item[fieldKey];
    if (key == null) continue;
    const score = Number(item[scoreKey]) || 0;
    map.set(key, Math.max(score, map.get(key) || 0));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, score]) => ({ [fieldKey]: value, score }));
}

function dedupeCandidateUnits(candidates, limit = 24) {
  const map = new Map();
  for (const candidate of candidates) {
    const key = (candidate.units || []).join("");
    if (!key) continue;
    const existing = map.get(key);
    if (!existing || Number(candidate.score) > Number(existing.score)) {
      map.set(key, candidate);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function pruneWeakExactSyllableMatches(items, token, threshold = 0.14) {
  if (!items?.length) return [];
  const topScore = Number(items[0].score) || 0;
  if (!topScore) return items;
  return items.filter((item, index) => {
    if (index === 0 || Number(item.score) >= topScore * threshold) return true;
    const syllable = state.data?.syllables?.[item.hangul];
    const latinVariants = (syllable?.latin || []).map((variant) => normalizeLatin(variant.text));
    if (!token || !latinVariants.includes(token)) return false;
    const total = Number(syllable?.givenCount || 0) + Number(syllable?.nameCount || 0);
    const ultraRare = total <= 2 && Number(syllable?.decadeWeight || 0) === 0;
    const unsupportedForNames = !syllable?.sinoAllowed && !Number(syllable?.hanjaGivenCount || 0);
    if (ultraRare && unsupportedForNames) return false;
    return true;
  });
}

function givenSyllableNamePrior(syllable) {
  const data = state.data?.syllables?.[syllable];
  if (!data) return -80;
  const total = Number(data.givenCount || 0) + Number(data.nameCount || 0);
  const decadeWeight = Number(data.decadeWeight || 0);
  const decadePeriods = Number(data.decadePeriods || 0);
  const allowlisted = isAllowedNameSyllable(syllable);
  if (total === 0 && decadeWeight === 0) return allowlisted ? -140 : -420;
  if (total <= 2 && decadeWeight === 0) return allowlisted ? -120 : -720;
  if (total <= 4 && decadeWeight === 0) return allowlisted ? -40 : -260;
  let prior = Math.log1p(Math.max(total, 0)) * 12 + Math.log1p(Math.max(decadeWeight, 0)) * 5 + decadePeriods * 10;
  if (total <= 2) prior -= 180;
  else if (total <= 4) prior -= 70;
  return prior;
}

function givenWholeNamePrior(units) {
  const name = units.join("");
  if (!name) return 0;
  const data = state.data?.givenNames?.[name];
  if (!data) return 0;
  const totalWeight = Number(data.totalWeight || 0);
  const periodsPresentCount = Number(data.periodsPresentCount || 0);
  const datasetCount = Number(data.datasetCount || 0);
  const rowOccurrences = Number(data.rowOccurrences || 0);
  let prior = 0;
  if (totalWeight > 0) {
    prior += Math.log1p(totalWeight) * 18;
    prior += periodsPresentCount * 20;
  }
  if (datasetCount > 0) prior += Math.log1p(datasetCount) * 35;
  if (rowOccurrences > 0) prior += Math.log1p(rowOccurrences) * 8;
  return prior;
}

function givenUnitsNamePrior(units) {
  const extraUnitPenalty = units.length <= 2 ? 0 : (units.length - 2) * 80;
  return units.reduce((sum, syllable) => sum + givenSyllableNamePrior(syllable), 0) + givenWholeNamePrior(units) - extraUnitPenalty;
}

function hasGivenSyllableEvidence(syllable) {
  if (isBlockedUnsupportedComplexCodaSyllable(syllable)) return false;
  const data = state.data?.syllables?.[syllable];
  return Number(data?.givenCount || 0) + Number(data?.nameCount || 0) > 0;
}

function isUltraRareGivenSyllable(syllable) {
  const data = state.data?.syllables?.[syllable];
  if (!data) return true;
  const total = Number(data.givenCount || 0) + Number(data.nameCount || 0);
  const decadeWeight = Number(data.decadeWeight || 0);
  return total <= 2 && decadeWeight === 0;
}

function hasHanjaGivenSupport(syllable) {
  const data = state.data?.syllables?.[syllable];
  return Number(data?.hanjaGivenCount || 0) > 0;
}

function isSinoAllowedSyllable(syllable) {
  return !!state.data?.syllables?.[syllable]?.sinoAllowed;
}

function isNonSinoExceptionSyllable(syllable) {
  return !!state.data?.syllables?.[syllable]?.nonSinoException;
}

function isAllowedNameSyllable(syllable) {
  if (isBlockedUnsupportedComplexCodaSyllable(syllable)) return false;
  return isSinoAllowedSyllable(syllable) || isNonSinoExceptionSyllable(syllable);
}

function isFullyAllowedGivenCandidate(candidate) {
  return candidate.units.every((syllable) => isAllowedNameSyllable(syllable));
}

function filterEvidenceBackedGivenCandidates(candidates) {
  const filteredComplexCoda = candidates.filter(
    (candidate) => candidate.units.every((syllable) => !isBlockedUnsupportedComplexCodaSyllable(syllable)),
  );
  const pool = filteredComplexCoda.length ? filteredComplexCoda : candidates;
  const evidenceBacked = pool.filter((candidate) => candidate.units.every((syllable) => hasGivenSyllableEvidence(syllable)));
  return evidenceBacked.length ? evidenceBacked : pool;
}

function composeHangulSyllable(onset, vowel, coda = "") {
  const onsetIndex = HANGUL_ONSETS.indexOf(onset);
  const vowelIndex = HANGUL_VOWELS.indexOf(vowel);
  const codaIndex = HANGUL_CODAS.indexOf(coda);
  if (onsetIndex < 0 || vowelIndex < 0 || codaIndex < 0) return null;
  return String.fromCodePoint(HANGUL_BASE + onsetIndex * 588 + vowelIndex * 28 + codaIndex);
}

const DUUM_RECOVERY_VOWELS = new Set(["ㅑ", "ㅒ", "ㅕ", "ㅖ", "ㅛ", "ㅠ", "ㅣ"]);

function canRecoverDuumShiftedInitial(parts) {
  return parts?.onset === "ㄴ" && DUUM_RECOVERY_VOWELS.has(parts.vowel);
}

function recoveredOnsetOptionsForDuum(parts) {
  if (!canRecoverDuumShiftedInitial(parts)) return [];
  return ["ㅇ", "ㄹ"];
}

function recoveredCodaOptionsForNasalizedSurface(coda) {
  if (coda === "ㅇ") return ["ㄱ"];
  if (coda === "ㄴ") return ["ㄷ"];
  if (coda === "ㅁ") return ["ㅂ"];
  return [];
}

function isPlausibleRecoveredDuumSyllable(syllable) {
  const parts = decomposeHangulSyllable(syllable);
  if (!parts) return false;
  if (isBlockedUnsupportedComplexCodaSyllable(syllable)) return false;
  if (!["ㅇ", "ㄹ"].includes(parts.onset)) return false;
  return DUUM_RECOVERY_VOWELS.has(parts.vowel);
}

function recoverPronouncedSinoGivenCandidates(candidates) {
  const recovered = [...(candidates || [])];
  for (const candidate of candidates || []) {
    const units = candidate.units || [];
    for (let index = 1; index < units.length; index += 1) {
      const previous = decomposeHangulSyllable(units[index - 1]);
      const current = decomposeHangulSyllable(units[index]);
      if (!previous || !current) continue;
      if (!canRecoverDuumShiftedInitial(current)) continue;

      const previousCodaOptions = recoveredCodaOptionsForNasalizedSurface(previous.coda);
      if (!previousCodaOptions.length) continue;

      for (const restoredPreviousCoda of previousCodaOptions) {
        const restoredPrevious = composeHangulSyllable(previous.onset, previous.vowel, restoredPreviousCoda);
        if (!restoredPrevious) continue;
        if (!isAllowedNameSyllable(restoredPrevious) && !hasGivenSyllableEvidence(restoredPrevious) && !hasHanjaGivenSupport(restoredPrevious)) {
          continue;
        }

        for (const restoredOnset of recoveredOnsetOptionsForDuum(current)) {
          const restoredCurrent = composeHangulSyllable(restoredOnset, current.vowel, current.coda);
          if (!restoredCurrent) continue;
          const currentPlausible =
            isAllowedNameSyllable(restoredCurrent) ||
            hasGivenSyllableEvidence(restoredCurrent) ||
            hasHanjaGivenSupport(restoredCurrent) ||
            isPlausibleRecoveredDuumSyllable(restoredCurrent);
          if (!currentPlausible) continue;

          const nextUnits = units.slice();
          nextUnits[index - 1] = restoredPrevious;
          nextUnits[index] = restoredCurrent;
          recovered.push({
            units: nextUnits,
            score: Number(candidate.score) * (restoredOnset === "ㅇ" ? 0.91 : 0.86) + 18,
            recovered: true,
          });
        }
      }
    }
  }
  const deduped = dedupeCandidateUnits(recovered, 24);
  const recoveredOnly = deduped.filter((candidate) => candidate.recovered);
  if (recoveredOnly.length) {
    return recoveredOnly;
  }
  const withoutBlockedComplexCoda = deduped.filter(
    (candidate) => candidate.units.every((syllable) => !isBlockedUnsupportedComplexCodaSyllable(syllable)),
  );
  const allowedPool = (withoutBlockedComplexCoda.length ? withoutBlockedComplexCoda : deduped).filter(
    (candidate) => candidate.units.every((syllable) => isAllowedNameSyllable(syllable)),
  );
  return allowedPool.length ? allowedPool : (withoutBlockedComplexCoda.length ? withoutBlockedComplexCoda : deduped);
}

function pruneKanaSingleTokenGivenCandidates(candidates) {
  if (!candidates.length) return candidates;
  const bestCompact = candidates.find((candidate) => candidate.units.length <= 2);
  if (!bestCompact) return candidates;
  const bestAllowedCompact = candidates.find(
    (candidate) => candidate.units.length <= 2 && candidate.units.every((syllable) => isAllowedNameSyllable(syllable)),
  );
  return candidates.filter((candidate) => {
    if (bestAllowedCompact) {
      if (candidate.units.length > bestAllowedCompact.units.length && bestAllowedCompact.score >= candidate.score * 0.8) return false;
    }
    if (candidate.units.length > bestCompact.units.length && bestCompact.score >= candidate.score * 0.85) return false;
    return true;
  });
}

function buildKanaGivenCombosForUnits(units) {
  let givenCombos = [{ text: "", score: 0, parts: [] }];
  for (const [syllableIndex, syllable] of units.entries()) {
    const syllableData = state.data.syllables[syllable];
    const variants = augmentInitialGivenKanaVariants(syllable, syllableData?.kana || [], syllableIndex);
    if (!variants.length) {
      return [];
    }
    const next = [];
    for (const combo of givenCombos) {
      for (const variant of variants.slice(0, 4)) {
        next.push({
          text: `${combo.text}${variant.text}`,
          parts: (combo.parts || []).concat(variant.text),
          score: combo.score + Number(variant.score),
        });
      }
    }
    givenCombos = next.sort((a, b) => b.score - a.score).slice(0, 18);
  }
  return givenCombos;
}

function generatePronouncedGivenSurfaceVariants(units) {
  let surfaces = [{ units: units.slice(), scoreScale: 1 }];
  for (let index = 1; index < units.length; index += 1) {
    const next = [];
    for (const surface of surfaces) {
      next.push(surface);
      const previous = decomposeHangulSyllable(surface.units[index - 1]);
      const current = decomposeHangulSyllable(surface.units[index]);
      if (!previous || !current) continue;
      if (!DUUM_RECOVERY_VOWELS.has(current.vowel)) continue;
      if (!["ㅇ", "ㄹ"].includes(current.onset)) continue;
      const pronouncedCoda = previous.coda === "ㄱ" ? "ㅇ" : previous.coda === "ㄷ" ? "ㄴ" : previous.coda === "ㅂ" ? "ㅁ" : "";
      if (!pronouncedCoda) continue;
      const pronouncedPrevious = composeHangulSyllable(previous.onset, previous.vowel, pronouncedCoda);
      const pronouncedCurrent = composeHangulSyllable("ㄴ", current.vowel, current.coda);
      if (!pronouncedPrevious || !pronouncedCurrent) continue;
      const transformed = surface.units.slice();
      transformed[index - 1] = pronouncedPrevious;
      transformed[index] = pronouncedCurrent;
      next.push({
        units: transformed,
        scoreScale: surface.scoreScale * 0.9,
      });
    }
    surfaces = dedupeScoredByField(
      next.map((item) => ({ surface: item.units.join(""), score: item.scoreScale })),
      "surface",
      "score",
      8,
    ).map((item) => ({ units: Array.from(item.surface), scoreScale: item.score }));
  }
  return surfaces.filter((item) => item.units.join("") !== units.join(""));
}

function reattachGiyeokToFollowingYGlideKana(previousPart, currentPart) {
  if (!previousPart || !currentPart) return null;
  const previousTrimmed = previousPart.replace(/[クグ]$/, "");
  if (previousTrimmed === previousPart) return null;
  const mapping = [
    ["イェ", "ギェ"],
    ["ヤ", "ギャ"],
    ["ユ", "ギュ"],
    ["ヨ", "ギョ"],
    ["イ", "ギ"],
  ];
  for (const [from, to] of mapping) {
    if (currentPart.startsWith(from)) {
      return [previousTrimmed, `${to}${currentPart.slice(from.length)}`];
    }
  }
  return null;
}

function generateVoicedGiyeokKanaVariants(parts, units) {
  let surfaces = [{ parts: parts.slice(), scoreScale: 1 }];
  for (let index = 1; index < units.length; index += 1) {
    const next = [];
    for (const surface of surfaces) {
      next.push(surface);
      const previous = decomposeHangulSyllable(units[index - 1]);
      const current = decomposeHangulSyllable(units[index]);
      if (!previous || !current) continue;
      if (previous.coda !== "ㄱ") continue;
      if (!DUUM_RECOVERY_VOWELS.has(current.vowel)) continue;
      if (!["ㅇ", "ㄹ"].includes(current.onset)) continue;
      const transformed = reattachGiyeokToFollowingYGlideKana(surface.parts[index - 1], surface.parts[index]);
      if (!transformed) continue;
      const nextParts = surface.parts.slice();
      nextParts[index - 1] = transformed[0];
      nextParts[index] = transformed[1];
      next.push({
        parts: nextParts,
        scoreScale: surface.scoreScale * 0.82,
      });
    }
    surfaces = dedupeScoredByField(
      next.map((item) => ({ surface: item.parts.join("\u0000"), score: item.scoreScale })),
      "surface",
      "score",
      8,
    ).map((item) => ({ parts: item.surface.split("\u0000"), scoreScale: item.score }));
  }
  return surfaces.filter((item) => item.parts.join("") !== parts.join(""));
}

function trailingCodaClass(text) {
  if (!text) return "";
  if (text.endsWith("ng")) return "ng";
  if (text.endsWith("m")) return "m";
  if (text.endsWith("n")) return "n";
  if (text.endsWith("l") || text.endsWith("r")) return "l";
  return "";
}

function consonantSignature(text) {
  return normalizeLatin(text).replace(/[aeiouy]/g, "");
}

function preservesTrailingCoda(norm, key) {
  const normCoda = trailingCodaClass(norm);
  if (!normCoda) return true;
  const keyCoda = trailingCodaClass(key);
  if (normCoda === "n") return keyCoda === "n" || keyCoda === "ng";
  return keyCoda === normCoda;
}

function collapsedVowelSignature(text) {
  return (text.match(/[aeiouy]+/g) || []).join("").replace(/([aeiouy])\1+/g, "$1");
}

function preservesCoreVowels(norm, key) {
  const normVowels = collapsedVowelSignature(norm);
  const keyVowels = collapsedVowelSignature(key);
  if (!normVowels || !keyVowels) return true;
  if (normVowels.length === 1 && keyVowels.length === 1) return normVowels === keyVowels;
  return true;
}

function hasOddInitialHCluster(text) {
  return /^(?:nh|rh|lh|mh|bh|dh|gh|zh)/.test(text);
}

function buildRuntime(data) {
  const latinVariantLengths = [...new Set(Object.keys(data.syllableLatinIndex).map((key) => key.length))].sort((a, b) => b - a);
  const kanaVariantLengths = [...new Set(Object.keys(data.syllableKanaIndex).map((key) => key.length))].sort((a, b) => b - a);
  const surnameLatinKeysByFirst = new Map();
  const syllableLatinKeysByFirst = new Map();
  const syllableKanaKeysByFirst = new Map();
  const compoundSurnames = new Set(data.meta.compoundSurnames);

  for (const key of Object.keys(data.surnameLatinIndex)) {
    const first = key[0] || "";
    const list = surnameLatinKeysByFirst.get(first) || [];
    list.push(key);
    surnameLatinKeysByFirst.set(first, list);
  }
  for (const key of Object.keys(data.syllableLatinIndex)) {
    const first = key[0] || "";
    const list = syllableLatinKeysByFirst.get(first) || [];
    list.push(key);
    syllableLatinKeysByFirst.set(first, list);
  }
  for (const key of Object.keys(data.syllableKanaIndex)) {
    const first = key[0] || "";
    const list = syllableKanaKeysByFirst.get(first) || [];
    list.push(key);
    syllableKanaKeysByFirst.set(first, list);
  }

  return {
    latinVariantLengths,
    kanaVariantLengths,
    surnameLatinKeysByFirst,
    syllableLatinKeysByFirst,
    syllableKanaKeysByFirst,
    compoundSurnames,
    surnameByHangul: new Map(data.surnames.map((item) => [item.hangul, item])),
    fullNameByIndex: data.fullNames,
  };
}

function addCandidate(candidateMap, hangul, score, evidence) {
  if (!hangul) return;
  const current = candidateMap.get(hangul) || { hangul, score: -Infinity, evidence: new Set(), exactIds: new Set() };
  current.score = Math.max(current.score, score);
  if (evidence) current.evidence.add(evidence);
  candidateMap.set(hangul, current);
}

function addExactNameCandidates(query, candidateMap) {
  const { data } = state;
  const hangul = extractHangul(query);
  if (hangul && data.fullNameExactHangul[hangul]) {
    for (const index of data.fullNameExactHangul[hangul]) {
      const row = data.fullNames[index];
      addCandidate(candidateMap, row.hangul, 48 + row.weight, "Exact Hangul name match");
      candidateMap.get(row.hangul).exactIds.add(index);
    }
  }

  const hanja = extractHanja(query);
  if (hanja && data.fullNameExactHanja[hanja]) {
    for (const index of data.fullNameExactHanja[hanja]) {
      const row = data.fullNames[index];
      addCandidate(candidateMap, row.hangul, 45 + row.weight, "Exact Hanja name match");
      candidateMap.get(row.hangul).exactIds.add(index);
    }
  }

  const latin = normalizeLatin(query);
  if (latin && data.supplementalRomanIndex?.[latin]) {
    for (const item of data.supplementalRomanIndex[latin]) {
      addCandidate(candidateMap, item.hangul, 50000 + Number(item.score), "Supplemental attested Roman query match");
    }
  }
  if (latin && data.fullNameRomanIndex[latin]) {
    for (const item of data.fullNameRomanIndex[latin]) {
      const row = data.fullNames[item.index];
      addCandidate(candidateMap, row.hangul, 42 + Number(item.score) + row.weight, "Exact Romanized name match");
      candidateMap.get(row.hangul).exactIds.add(item.index);
    }
  }

  const kana = normalizeKana(query);
  if (kana && data.fullNameKanaIndex[kana]) {
    for (const item of data.fullNameKanaIndex[kana]) {
      const row = data.fullNames[item.index];
      addCandidate(candidateMap, row.hangul, 42 + Number(item.score) + row.weight, "Exact kana name match");
      candidateMap.get(row.hangul).exactIds.add(item.index);
    }
  }
}

function findSurnameCandidatesFromLatin(token) {
  const norm = normalizeLatin(token);
  if (!norm) return [];
  const { data, runtime } = state;
  const results = [];
  for (const variant of expandRomanTokenVariants(token)) {
    const direct = data.surnameLatinIndex[variant.token];
    if (direct) {
      for (const item of direct) {
        results.push({ hangul: item.hangul, score: Number(item.score) - variant.penalty });
      }
      continue;
    }

    const first = variant.token[0] || "";
    const keys = runtime.surnameLatinKeysByFirst.get(first) || [];
    const fuzzy = keys
      .filter((key) => {
        if (Math.abs(key.length - variant.token.length) > 1) return false;
        if (levenshtein(key, variant.token) > 1) return false;
        if (!preservesTrailingCoda(variant.token, key)) return false;
        if (variant.token.length >= 5 && consonantSignature(key) !== consonantSignature(variant.token)) return false;
        return true;
      })
      .flatMap((key) => data.surnameLatinIndex[key].map((item) => ({ hangul: item.hangul, score: Number(item.score) * 0.78 - variant.penalty })));
    results.push(...fuzzy);
  }
  return dedupeScoredByField(results, "hangul", "score", 8);
}

function findSurnameCandidatesFromKana(token) {
  const norm = normalizeKana(token);
  if (!norm) return [];
  return mergeKanaCandidateLists(state.data.surnameKanaIndex[norm] || [], kanaSurnameAliases(norm), "hangul", 8);
}

function findSurnameCandidatesFromHanja(token) {
  return state.data.surnameHanjaIndex[token] || [];
}

function findSurnameCandidatesFromHangul(token) {
  const norm = extractHangul(token);
  if (!norm) return [];
  const options = [];
  if (state.runtime.compoundSurnames.has(norm.slice(0, 2))) {
    options.push({ hangul: norm.slice(0, 2), score: 18 });
  }
  options.push({ hangul: norm.slice(0, 1), score: 16 });
  return options.filter((item, idx, arr) => item.hangul && arr.findIndex((other) => other.hangul === item.hangul) === idx);
}

function fuzzyLookup(norm, index, keyMap, targetField, penalty = 0.72) {
  if (!norm) return [];
  if (!hasRomanVowel(norm)) return [];
  if (hasOddInitialHCluster(norm)) return [];
  const keys = keyMap.get(norm[0] || "") || [];
  const out = [];
  for (const key of keys) {
    if (!hasRomanVowel(key)) continue;
    if (Math.abs(key.length - norm.length) > 1) continue;
    const distance = levenshtein(key, norm);
    if (distance > 1) continue;
    if (!preservesTrailingCoda(norm, key)) continue;
    if (!preservesCoreVowels(norm, key)) continue;
    if (norm.length >= 3 && consonantSignature(norm) !== consonantSignature(key)) continue;
    const distancePenalty = distance === 0 ? 1 : 0.12;
    for (const item of index[key] || []) {
      out.push({ [targetField]: item[targetField], score: Number(item.score) * penalty * distancePenalty });
    }
  }
  return dedupeScoredByField(out, targetField, "score", 10);
}

function singleTokenRomanChunkAdjustment(token, chunks, units) {
  const norm = normalizeLatin(token);
  if (!norm || !chunks?.length || !units?.length) return 0;

  let adjustment = 0;
  if (units.length > 2) adjustment -= (units.length - 2) * 140;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] || "";
    if (chunk.length === 1) adjustment -= 160;
    else if (chunk.length === 2) adjustment -= index === 0 ? 28 : 60;
    if (chunk.length <= 2 && /^[^aeiouy][aeiouy]$/i.test(chunk)) adjustment -= 70;
  }

  for (let index = 0; index < chunks.length - 1; index += 1) {
    const left = chunks[index] || "";
    const right = chunks[index + 1] || "";
    const leftLast = left.slice(-1);
    const rightFirst = right[0] || "";
    if (/[aeiouy]/.test(leftLast) && /[aeiouy]/.test(rightFirst)) {
      adjustment -= leftLast === rightFirst ? 180 : 50;
    }
  }

  const chunkPairs = chunks.slice(0, -1).map((chunk, index) => [chunk, chunks[index + 1] || ""]);
  if (/ng[kg]/.test(norm)) {
    const aligned = chunkPairs.some(([left, right]) => left.endsWith("ng") && /^[kg]/.test(right));
    const misaligned = chunkPairs.some(([left, right]) => left.endsWith("n") && /^[kg]/.test(right));
    adjustment += aligned ? 120 : -180;
    if (misaligned) adjustment -= 90;
  }
  if (/ng(?:ch|j)/.test(norm)) {
    const aligned = chunkPairs.some(([left, right]) => left.endsWith("ng") && /^(ch|j)/.test(right));
    const misaligned = chunkPairs.some(([left, right]) => left.endsWith("n") && /^(ch|j)/.test(right));
    adjustment += aligned ? 90 : -140;
    if (misaligned) adjustment -= 75;
  }

  return adjustment;
}

function parseSyllablesLatin(norm, maxUnits = 3) {
  const { data, runtime } = state;
  if (!norm) return [];
  const memo = new Map();

  function dfs(pos, used) {
    const key = `${pos}:${used}`;
    if (memo.has(key)) return memo.get(key);
    if (pos === norm.length) return [{ units: [], score: 0 }];
    if (used >= maxUnits) return [];

    const results = [];
    for (const len of runtime.latinVariantLengths) {
      if (pos + len > norm.length) continue;
      const chunk = norm.slice(pos, pos + len);
      if (!chunk) continue;
      if (!hasRomanVowel(chunk)) continue;
      const exact = pruneWeakExactSyllableMatches(data.syllableLatinIndex[chunk] || [], chunk);
      for (const item of exact) {
        for (const tail of dfs(pos + len, used + 1)) {
          results.push({
            units: [item.hangul, ...tail.units],
            score: Number(item.score) + tail.score,
            chunks: [chunk, ...(tail.chunks || [])],
          });
        }
      }
    }

    if (!results.length) {
      const chunk = norm.slice(pos);
      for (const item of fuzzyLookup(chunk, data.syllableLatinIndex, runtime.syllableLatinKeysByFirst, "hangul", 0.62)) {
        results.push({ units: [item.hangul], score: Number(item.score), chunks: [chunk] });
      }
    }

    const deduped = dedupeCandidateUnits(results, 24).map((item) => ({
      units: item.units,
      score: item.score,
      chunks: item.chunks || [],
    }));
    const filtered = filterEvidenceBackedGivenCandidates(deduped);
    memo.set(key, filtered);
    return filtered;
  }

  return dfs(0, 0);
}

function parseSyllablesKana(norm, maxUnits = 3) {
  const { data, runtime } = state;
  if (!norm) return [];
  const memo = new Map();

  function dfs(pos, used) {
    const key = `${pos}:${used}`;
    if (memo.has(key)) return memo.get(key);
    if (pos === norm.length) return [{ units: [], score: 0 }];
    if (used >= maxUnits) return [];

    const results = [];
    for (const len of runtime.kanaVariantLengths) {
      if (pos + len > norm.length) continue;
      const chunk = norm.slice(pos, pos + len);
      if (!chunk) continue;
      const exact = lookupKanaChunkCandidates(chunk);
      for (const item of exact) {
        for (const tail of dfs(pos + len, used + 1)) {
          results.push({
            units: [item.hangul, ...tail.units],
            score: Number(item.score) + tail.score,
          });
        }
      }
    }
    const deduped = dedupeScored(
      results.map((item) => ({ text: item.units.join(""), score: item.score })),
      "text",
      "score",
      24,
    ).map((item) => ({
      units: Array.from(item.text),
      score: item.score,
    }));
    const filtered = filterEvidenceBackedGivenCandidates(deduped);
    memo.set(key, filtered);
    return filtered;
  }

  return dfs(0, 0);
}

function parseGivenLatinTokens(tokens) {
  if (!tokens.length) return [];
  if (tokens.length === 1) {
    const results = [];
    for (const variant of expandRomanTokenVariants(tokens[0])) {
      for (const candidate of parseSyllablesLatin(variant.token, 3)) {
        results.push({
          units: candidate.units,
          score: candidate.score - variant.penalty + singleTokenRomanChunkAdjustment(variant.token, candidate.chunks || [], candidate.units),
          chunks: candidate.chunks || [],
        });
      }
    }
    return filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(results, 24));
  }
  const perToken = tokens.map((token) => {
    const candidates = [];
    for (const variant of expandRomanTokenVariants(token)) {
      const exact = pruneWeakExactSyllableMatches(state.data.syllableLatinIndex[variant.token], variant.token);
      if (exact?.length) {
        for (const item of exact) {
          candidates.push({ units: [item.hangul], score: Number(item.score) - variant.penalty, chunks: [variant.token] });
        }
      } else {
        for (const item of fuzzyLookup(variant.token, state.data.syllableLatinIndex, state.runtime.syllableLatinKeysByFirst, "hangul", 0.62)) {
          candidates.push({ units: [item.hangul], score: Number(item.score) - variant.penalty, chunks: [variant.token] });
        }
      }
    }
    return filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(candidates, 12));
  });
  if (perToken.some((items) => !items.length)) {
    return parseSyllablesLatin(tokens.join(""), 3);
  }
  let combos = [{ units: [], score: 0 }];
  for (const items of perToken) {
    const next = [];
    for (const combo of combos) {
      for (const item of items.slice(0, 5)) {
        next.push({
          units: combo.units.concat(item.units),
          score: combo.score + item.score,
          chunks: (combo.chunks || []).concat(item.chunks || item.units),
        });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 20);
  }
  return filterEvidenceBackedGivenCandidates(combos);
}

function pruneRomanSingleTokenGivenCandidates(candidates) {
  if (!candidates.length) return candidates;
  const topCandidate = candidates[0];
  const topTwoUnit = candidates.find((candidate) => candidate.units.length <= 2);
  const topAllowed = candidates.find((candidate) => isFullyAllowedGivenCandidate(candidate));
  const topHanjaBackedCompact = candidates.find(
    (candidate) => candidate.units.length <= 2 && candidate.units.every((syllable) => hasHanjaGivenSupport(syllable)),
  );
  if (!topTwoUnit) return candidates;
  return candidates.filter((candidate) => {
    if (topAllowed) {
      if (!isFullyAllowedGivenCandidate(candidate)) return false;
      const shorterAllowed = candidates.find(
        (other) => isFullyAllowedGivenCandidate(other) && other.units.length < candidate.units.length,
      );
      if (shorterAllowed && shorterAllowed.score >= candidate.score * 0.7) return false;
      return candidate.score >= topAllowed.score * 0.18;
    }
    if (
      topHanjaBackedCompact &&
      candidate.units.length > topHanjaBackedCompact.units.length &&
      candidate.units.some((syllable) => !hasHanjaGivenSupport(syllable)) &&
      topHanjaBackedCompact.score >= candidate.score * 0.35
    ) {
      return false;
    }
    const bestShorter = candidates.find((other) => other.units.length < candidate.units.length);
    if (bestShorter && bestShorter.score >= candidate.score * 0.7) {
      return candidate.units.length <= bestShorter.units.length;
    }
    if (candidate.units.length <= 2) {
      return candidate.score >= topCandidate.score * 0.22;
    }
    if (candidate.units.length > topTwoUnit.units.length && candidate.score < topTwoUnit.score * 1.35) {
      return false;
    }
    return candidate.score >= topTwoUnit.score * 0.4;
  });
}

function parseGivenKanaTokens(tokens) {
  if (!tokens.length) return [];
  const joined = normalizeKana(tokens.join(""));
  const exactGiven = (state.data.givenNameKanaIndex?.[joined] || []).map((item) => ({
    units: Array.from(item.hangul),
    score: Number(item.score) + 180,
  }));
  if (exactGiven.length) {
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(exactGiven, 24)));
  }
  if (tokens.length === 1) {
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(parseSyllablesKana(tokens[0], 3), 24)));
  }
  const perToken = tokens.map((token) => lookupKanaChunkCandidates(token).map((item) => ({
    units: [item.hangul],
    score: Number(item.score),
  })));
  if (perToken.some((items) => !items.length)) {
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(parseSyllablesKana(tokens.join(""), 3), 24)));
  }
  let combos = [{ units: [], score: 0 }];
  for (const items of perToken) {
    const next = [];
    for (const combo of combos) {
      for (const item of items.slice(0, 5)) {
        next.push({ units: combo.units.concat(item.units), score: combo.score + item.score });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 20);
  }
  return recoverPronouncedSinoGivenCandidates(filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(combos, 24)));
}

function parseGivenHanja(text) {
  const norm = extractHanja(text);
  if (!norm) return [];
  let combos = [{ units: [], score: 0 }];
  for (const char of Array.from(norm)) {
    const items = state.data.hanjaGivenIndex[char] || [];
    if (!items.length) return [];
    const next = [];
    for (const combo of combos) {
      for (const item of items.slice(0, 6)) {
        next.push({ units: combo.units.concat(item.hangul), score: combo.score + Number(item.score) });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 30);
  }
  return combos;
}

function hasNonLatinScript(groups) {
  return groups.some((group) => group.type !== "latin");
}

function searchHangul(query, candidateMap) {
  const hangul = extractHangul(query);
  if (!hangul || hangul.length < 2) return;
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  let score = 20;
  const surnameData = state.runtime.surnameByHangul.get(surname);
  if (surnameData) score += Math.log1p(Number(surnameData.population || 0));
  for (const syllable of Array.from(given)) {
    const syllableData = state.data.syllables[syllable];
    if (syllableData) {
      score += Math.log1p(Number(syllableData.givenCount || 0) + Number(syllableData.nameCount || 0));
    }
  }
  addCandidate(candidateMap, hangul, score, "Hangul form parsed directly");
}

function searchLatin(query, candidateMap) {
  const latin = normalizeLatin(query);
  if (!latin) return;
  const groups = splitRomanGroups(query);
  const tokens = groups.flat();

  if (groups.length === 1 && tokens.length === 1) {
    const directCandidates = pruneRomanSingleTokenGivenCandidates(parseGivenLatinTokens(tokens)).filter(
      (candidate) => candidate.units.length === 1,
    );
    if (directCandidates.length) {
      for (const candidate of directCandidates.slice(0, 8)) {
        const hangul = candidate.units.join("");
        const score = Number(candidate.score) + givenUnitsNamePrior(candidate.units) + 40;
        addCandidate(candidateMap, hangul, score, "Roman single-syllable parse");
      }
      return;
    }
  }

  if (groups.length >= 2) {
    const hypotheses = [
      { surnameToken: groups[0].join(""), givenTokens: groups.slice(1).flat(), boost: 1.0, label: "Latin surname-first parse" },
    ];
    if (groups[groups.length - 1].length === 1) {
      hypotheses.push({
        surnameToken: groups[groups.length - 1][0],
        givenTokens: groups.slice(0, -1).flat(),
        boost: 0.84,
        label: "Latin surname-last parse",
      });
    }
    if (groups.length >= 3 && groups[0].length === 1 && groups[1].length === 1) {
      hypotheses.push({
        surnameToken: `${groups[0][0]}${groups[1][0]}`,
        givenTokens: groups.slice(2).flat(),
        boost: 1.06,
        label: "Latin compound-surname parse",
        requireCompoundSurname: true,
      });
    }
    if (groups.length >= 3 && groups[groups.length - 2].length === 1 && groups[groups.length - 1].length === 1) {
      hypotheses.push({
        surnameToken: `${groups[groups.length - 2][0]}${groups[groups.length - 1][0]}`,
        givenTokens: groups.slice(0, -2).flat(),
        boost: 0.88,
        label: "Latin compound-surname-last parse",
        requireCompoundSurname: true,
      });
    }
    for (const hypothesis of hypotheses) {
      let surnameCandidates = findSurnameCandidatesFromLatin(hypothesis.surnameToken);
      if (hypothesis.requireCompoundSurname) {
        surnameCandidates = surnameCandidates.filter((item) => (item.hangul || "").length === 2 && state.runtime.compoundSurnames.has(item.hangul));
      }
      if (!surnameCandidates.length || !hypothesis.givenTokens.length) continue;
      let givenCandidates = parseGivenLatinTokens(hypothesis.givenTokens);
      if (hypothesis.givenTokens.length === 1) {
        givenCandidates = pruneRomanSingleTokenGivenCandidates(givenCandidates);
      }
      combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, hypothesis.boost, hypothesis.label);
    }
  }

  if (tokens.length <= 1) {
    for (const [variant, surnameCandidates] of Object.entries(state.data.surnameLatinIndex)) {
      if (latin.startsWith(variant) && latin.length !== variant.length) {
        const givenCandidates = parseSyllablesLatin(latin.slice(variant.length), 3);
        combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.96, "Latin joined-string parse");
      }
      if (latin.endsWith(variant) && latin.length !== variant.length) {
        const givenCandidates = parseSyllablesLatin(latin.slice(0, -variant.length), 3);
        combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.94, "Latin suffix-surname parse");
      }
    }
  }
}

function searchKana(query, candidateMap) {
  const kana = normalizeKana(query);
  if (!kana) return;
  const tokens = splitKanaTokens(query);
  const spaceGroups = splitKanaSpaceGroups(query);
  const hasStrictSurnameBoundary = spaceGroups.length === 2;
  if (tokens.length >= 2) {
    const surnameCandidates = findSurnameCandidatesFromKana(tokens[0]);
    const givenCandidates = parseGivenKanaTokens(tokens.slice(1));
    combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 1.0, "Kana surname-first parse");
  }

  if (hasStrictSurnameBoundary) return;

  for (const [variant, surnameCandidates] of Object.entries(state.data.surnameKanaIndex)) {
    if (!kana.startsWith(variant) || kana.length === variant.length) continue;
    const givenCandidates = parseGivenKanaTokens([kana.slice(variant.length)]);
    combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.96, "Kana joined-string parse");
  }
}

function searchHanja(query, candidateMap) {
  const hanja = extractHanja(query);
  if (!hanja) return;
  const surnameKeys = hanja.length >= 2 ? [hanja.slice(0, 2), hanja.slice(0, 1)] : [hanja.slice(0, 1)];
  for (const key of surnameKeys) {
    const surnameCandidates = findSurnameCandidatesFromHanja(key);
    if (!surnameCandidates.length) continue;
    const givenCandidates = parseGivenHanja(hanja.slice(key.length));
    if (!givenCandidates.length && hanja.length === key.length) continue;
    combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.94, "Hanja reading parse");
  }
}

function searchMixedGroups(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (groups.length < 2) return;
  if (!hasNonLatinScript(groups)) return;
  const surnameGroup = groups[0];
  const givenGroups = groups.slice(1);
  const surnameCandidates = parseSurnameGroup(surnameGroup);
  if (!surnameCandidates.length) return;
  let combos = [{ units: [], score: 0 }];
  for (const group of givenGroups) {
    const parsed = parseGivenGroup(group);
    if (!parsed.length) return;
    const next = [];
    for (const combo of combos) {
      for (const item of parsed.slice(0, 8)) {
        next.push({ units: combo.units.concat(item.units), score: combo.score + item.score });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 30);
  }
  combineSurnameAndGivenCandidates(surnameCandidates, combos, candidateMap, 0.9, "Mixed-script segmented parse");
}

function parseSurnameGroup(group) {
  switch (group.type) {
    case "hangul":
      return findSurnameCandidatesFromHangul(group.text);
    case "latin":
      return findSurnameCandidatesFromLatin(group.text);
    case "kana":
      return findSurnameCandidatesFromKana(group.text);
    case "hanja":
      return findSurnameCandidatesFromHanja(group.text);
    default:
      return [];
  }
}

function parseGivenGroup(group) {
  switch (group.type) {
    case "hangul":
      return [{ units: Array.from(extractHangul(group.text)), score: 8 }];
    case "latin":
      return parseGivenLatinTokens(splitRomanTokens(group.text));
    case "kana":
      return parseGivenKanaTokens(splitKanaTokens(group.text));
    case "hanja":
      return parseGivenHanja(group.text);
    default:
      return [];
  }
}

function combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, boost, label) {
  for (const surnameCandidate of surnameCandidates.slice(0, 10)) {
    for (const givenCandidate of givenCandidates.slice(0, 24)) {
      const givenPrior = givenUnitsNamePrior(givenCandidate.units);
      const hangul = `${surnameCandidate.hangul}${givenCandidate.units.join("")}`;
      const score = (Number(surnameCandidate.score) + Number(givenCandidate.score)) * boost + givenPrior;
      addCandidate(candidateMap, hangul, score, label);
    }
  }
}

function gatherExactRowsForHangul(hangul, candidate) {
  const ids = new Set(candidate.exactIds || []);
  const exact = state.data.fullNameExactHangul[hangul] || [];
  for (const id of exact) ids.add(id);
  return [...ids].map((id) => state.data.fullNames[id]);
}

function generateRomanOutputs(hangul, exactRows) {
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const surnameData = state.runtime.surnameByHangul.get(surname);
  const givenUnits = Array.from(given);
  const counter = new Map();

  const add = (text, score) => {
    if (!text) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };

  for (const row of exactRows) {
    for (const item of row.romanizations || []) add(item.text, Number(item.score) + Number(row.weight || 0));
  }

  const surnameVariants = (surnameData?.latin || [{ text: surname, score: 1 }]).slice(0, 5);
  let givenCombos = [{ text: "", score: 0, parts: [] }];
  for (const [syllableIndex, syllable] of givenUnits.entries()) {
    const syllableData = state.data.syllables[syllable];
    let variants = (syllableData?.latin || [{ text: syllable, score: 1 }]).slice(0, 4);
    if (syllable === "이" && syllableIndex > 0) {
      const filtered = variants.filter((variant) => normalizeLatin(variant.text) !== "lee");
      if (filtered.length) variants = filtered;
    }
    const next = [];
    for (const combo of givenCombos) {
      for (const variant of variants) {
        next.push({
          text: `${combo.text}${variant.text}`,
          score: combo.score + Number(variant.score),
          parts: combo.parts.concat(variant.text),
        });
      }
    }
    givenCombos = next.sort((a, b) => b.score - a.score).slice(0, 18);
  }

  for (const surnameVariant of surnameVariants) {
    for (const givenCombo of givenCombos) {
      if (!givenCombo.parts.length) continue;
      const spaced = `${surnameVariant.text} ${givenCombo.parts.join(" ")}`;
      add(spaced, Number(surnameVariant.score) + givenCombo.score * 0.74);
      add(`${surnameVariant.text} ${givenCombo.parts.join("-")}`, Number(surnameVariant.score) + givenCombo.score);
      add(`${surnameVariant.text} ${givenCombo.text}`, Number(surnameVariant.score) + givenCombo.score * 0.9);
    }
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function generateKanaOutputs(hangul, exactRows) {
  const counter = new Map();
  const add = (text, score) => {
    if (!text) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };
  for (const row of exactRows) {
    for (const item of row.kana || []) add(item.text, Number(item.score) + Number(row.weight || 0));
  }
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const surnameData = state.runtime.surnameByHangul.get(surname);
  const surnameKana = surnameData?.kana || [];
  if (!surnameKana.length) {
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([text, score]) => ({ text, score }));
  }

  const givenUnits = Array.from(given);
  const givenCombos = buildKanaGivenCombosForUnits(givenUnits);

  if (givenCombos.length) {
    for (const surnameVariant of surnameKana.slice(0, 6)) {
      const surnameSurface = normalizeKanaJoinPart(surnameVariant.text, surname, true);
      for (const givenCombo of givenCombos) {
        const normalizedParts = normalizeKanaPartsForJoin(givenCombo.parts || [], givenUnits);
        for (const surface of generateLiaisonKanaVariants(normalizedParts, givenUnits)) {
          add(`${surnameSurface} ${surface.text}`.trim(), (Number(surnameVariant.score) + givenCombo.score) * surface.scoreScale);
        }
        for (const voicedSurface of generateVoicedGiyeokKanaVariants(normalizedParts, givenUnits)) {
          add(
            `${surnameSurface} ${voicedSurface.parts.join("")}`.trim(),
            (Number(surnameVariant.score) + givenCombo.score) * voicedSurface.scoreScale,
          );
        }
      }
    }
  }

  for (const pronouncedSurface of generatePronouncedGivenSurfaceVariants(givenUnits)) {
    const pronouncedCombos = buildKanaGivenCombosForUnits(pronouncedSurface.units);
    if (!pronouncedCombos.length) continue;
    for (const surnameVariant of surnameKana.slice(0, 6)) {
      const surnameSurface = normalizeKanaJoinPart(surnameVariant.text, surname, true);
      for (const givenCombo of pronouncedCombos) {
        const normalizedParts = normalizeKanaPartsForJoin(givenCombo.parts || [], pronouncedSurface.units);
        for (const surface of generateLiaisonKanaVariants(normalizedParts, pronouncedSurface.units)) {
          add(
            `${surnameSurface} ${surface.text}`.trim(),
            (Number(surnameVariant.score) + givenCombo.score) * surface.scoreScale * pronouncedSurface.scoreScale,
          );
        }
      }
    }
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function hanjaOutputsForCandidate(hangul, exactRows) {
  const counter = new Map();
  for (const row of exactRows) {
    if (!row.hanja) continue;
    counter.set(row.hanja, Math.max(Number(row.weight || 0) + 5, counter.get(row.hanja) || 0));
  }
  if (!counter.size) {
    const { surname } = splitNameUnits(hangul, state.runtime.compoundSurnames);
    const surnameData = state.runtime.surnameByHangul.get(surname);
    const hanjaEntries = surnameData?.hanjaEntries || [];
    if (hanjaEntries.length) {
      return hanjaEntries.slice(0, 6).map((item) => ({
        text: `${item.text} …`,
        score: Number(item.percent ?? item.count ?? 0),
        percent: item.percent != null ? Number(item.percent) : null,
      }));
    }
    for (const hanja of surnameData?.hanja || []) {
      counter.set(`${hanja} …`, 1.2);
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([text, score]) => ({ text, score }));
}

function buildResultCards(candidateMap) {
  const candidates = [...candidateMap.values()].sort((a, b) => b.score - a.score).slice(0, 16);
  if (!candidates.length) {
    resultsEl.innerHTML = `<div class="empty-state">No plausible candidates found. Try another spacing style, a different romanization, or a shorter query.</div>`;
    return;
  }

  const maxScore = candidates[0].score || 1;
  resultsEl.innerHTML = "";
  for (const candidate of candidates) {
    const exactRows = gatherExactRowsForHangul(candidate.hangul, candidate);
    const romanOutputs = generateRomanOutputs(candidate.hangul, exactRows);
    const kanaOutputs = generateKanaOutputs(candidate.hangul, exactRows);
    const hanjaOutputs = hanjaOutputsForCandidate(candidate.hangul, exactRows);
    const plausibility = Math.max(1, Math.round((candidate.score / maxScore) * 100));
    const { surname, given } = splitNameUnits(candidate.hangul, state.runtime.compoundSurnames);

    const fragment = resultTemplate.content.cloneNode(true);
    fragment.querySelector(".result-hangul").textContent = candidate.hangul;
    fragment.querySelector(".result-subtitle").textContent = `Surname ${surname} · Given ${given || "—"} · ${exactRows.length ? `${exactRows.length} supporting dataset row(s)` : "synthetic from surname and syllable evidence"}`;
    fragment.querySelector(".score-value").textContent = `${plausibility}%`;
    fragment.querySelector(".score-bar span").style.width = `${plausibility}%`;

    const romanList = fragment.querySelector(".roman-list");
    const kanaList = fragment.querySelector(".kana-list");
    const hanjaList = fragment.querySelector(".hanja-list");
    fillVariantList(romanList, romanOutputs, maxScore);
    fillVariantList(kanaList, kanaOutputs, maxScore);
    fillVariantList(hanjaList, hanjaOutputs, maxScore, !hanjaOutputs.length ? "No observed Hanja reading in the dataset" : "");

    resultsEl.appendChild(fragment);
  }
}

function pruneImplausibleCandidates(candidateMap) {
  const candidates = [...candidateMap.values()].sort((a, b) => b.score - a.score);
  if (candidates.length < 2) return candidateMap;

  const bestAllowed = candidates.find((candidate) => {
    const { given } = splitNameUnits(candidate.hangul, state.runtime.compoundSurnames);
    return Array.from(given).every((syllable) => isAllowedNameSyllable(syllable));
  });

  const bestPlausible = candidates.find((candidate) => {
    const { given } = splitNameUnits(candidate.hangul, state.runtime.compoundSurnames);
    const units = Array.from(given);
    return units.length && units.every((syllable) => !isUltraRareGivenSyllable(syllable));
  });
  const plausibilityBaseline = bestPlausible || bestAllowed || candidates[0];
  if (!plausibilityBaseline) return candidateMap;

  const filtered = new Map();
  for (const candidate of candidates) {
    const { given } = splitNameUnits(candidate.hangul, state.runtime.compoundSurnames);
    const units = Array.from(given);
    const ultraRareCount = units.filter((syllable) => isUltraRareGivenSyllable(syllable)).length;
    const unsupportedCount = units.filter((syllable) => !isAllowedNameSyllable(syllable)).length;
    const hasExactEvidence =
      (candidate.exactIds && candidate.exactIds.size > 0) ||
      [...candidate.evidence].some((item) => /Exact|Supplemental|Hangul form parsed directly/.test(item));
    const kanaDerivedOnly = !hasExactEvidence && [...candidate.evidence].some((item) => /Kana/.test(item));
    if (!hasExactEvidence && bestAllowed && unsupportedCount >= 1) continue;
    if (
      kanaDerivedOnly &&
      unsupportedCount === 0 &&
      ultraRareCount <= 1 &&
      candidate.score >= plausibilityBaseline.score * 0.12
    ) {
      filtered.set(candidate.hangul, candidate);
      continue;
    }
    if (!hasExactEvidence && ultraRareCount >= 2 && candidate.score < plausibilityBaseline.score * 0.45) continue;
    if (!hasExactEvidence && ultraRareCount >= 1 && candidate.score < plausibilityBaseline.score * 0.28) continue;
    filtered.set(candidate.hangul, candidate);
  }
  return filtered;
}

function fillVariantList(listEl, items, maxScore, emptyText = "No output") {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    listEl.appendChild(li);
    return;
  }
  const localMax = items[0].score || maxScore || 1;
  for (const item of items) {
    const li = document.createElement("li");
    const value = document.createElement("span");
    value.textContent = item.text;
    const score = document.createElement("span");
    score.className = "variant-score";
    score.textContent = item.percent != null ? ` ${item.percent.toFixed(2)}%` : ` ${Math.round((item.score / localMax) * 100)}%`;
    li.append(value, score);
    listEl.appendChild(li);
  }
}

function search(query) {
  const scripts = detectScripts(query);
  detectedScriptsEl.textContent = scripts.length ? scripts.join(" · ") : "Unknown";
  if (!query.trim()) {
    resultsEl.innerHTML = `<div class="empty-state">Enter a Korean name in Hangul, romanization, kana, Hanja, or a mixed form.</div>`;
    return;
  }

  const candidateMap = new Map();
  addExactNameCandidates(query, candidateMap);
  searchHangul(query, candidateMap);
  searchLatin(query, candidateMap);
  searchKana(query, candidateMap);
  searchHanja(query, candidateMap);
  searchMixedGroups(query, candidateMap);
  const prunedCandidateMap = pruneImplausibleCandidates(candidateMap);
  buildResultCards(prunedCandidateMap);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

async function init() {
  const response = await fetch(dataUrl);
  state.data = await response.json();
  state.runtime = buildRuntime(state.data);
  resultsEl.innerHTML = `<div class="empty-state">Search is ready. Try one of the example names above.</div>`;
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  search(queryEl.value);
});

document.querySelectorAll(".example-chip").forEach((button) => {
  button.addEventListener("click", () => {
    queryEl.value = button.dataset.example || "";
    search(queryEl.value);
  });
});

init().catch((error) => {
  console.error(error);
  resultsEl.innerHTML = `<div class="empty-state">Failed to load the search index. Serve the folder over HTTP and reload.</div>`;
});
