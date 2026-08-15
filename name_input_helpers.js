const KEYBOARD_ROWS = [
  { letters: "qwertyuiop", offset: 0 },
  { letters: "asdfghjkl", offset: 0.25 },
  { letters: "zxcvbnm", offset: 0.75 },
];

const KEYBOARD_POSITIONS = new Map(
  KEYBOARD_ROWS.flatMap(({ letters, offset }, row) =>
    Array.from(letters, (letter, column) => [letter, { x: column + offset, y: row }]),
  ),
);

const PINYIN_INITIAL_CUE = /^(?:zh|q|x)/;
const WADE_GILES_CUE = /^(?:hs|ts|tz)/;
const WADE_GILES_GIVEN_CUE = /(?:hsing|hsuan|hsueh|hsiao|hsi|chih|chung|chuan|tsung|tz[uou])/;
const WADE_GILES_APOSTROPHE_CUE = /(?:^|[-\s])(?:ch|p|t|k)'/i;
const CANTONESE_SURNAME_CUES = new Set([
  "lam", "leung", "cheung", "kwok", "yip", "yeung", "yuen", "tsang", "tse", "tsui", "lau", "mak", "au", "luk",
  "chow", "tang", "lo", "lui", "poon", "so", "kong", "fong", "tam", "to", "yau", "chiu", "shum", "mok",
]);
const CANTONESE_AMBIGUOUS_SURNAME_CUES = new Set(["wong", "chan", "ho", "ng", "lee", "lim", "wang", "han", "kwan", "choi"]);
const CANTONESE_GIVEN_SYLLABLES = new Set([
  "ho", "hoi", "hin", "yin", "yan", "wai", "wing", "fai", "yiu", "keung", "kiu", "fung", "ming", "man", "lun", "tung",
  "yue", "yu", "ching", "shing", "sing", "kwong", "kit", "chak", "tsz", "sze", "siu", "pui", "ka", "kam", "lok", "yee", "wan",
  "leung", "chi", "chun", "chiu", "hei", "kui", "lam", "ping", "po", "shun", "tai", "wah", "yan", "yip", "yuen",
]);
const MANDARIN_SURNAME_CUES = new Set([
  "bai", "cai", "cao", "chen", "cheng", "deng", "dong", "du", "fan", "fang", "fu", "gao", "gu", "guo", "he", "hong",
  "hou", "huang", "jia", "jiang", "jin", "kong", "li", "liang", "lin", "liu", "long", "lu", "luo", "ma", "pan", "peng",
  "qian", "qin", "qiu", "ren", "shen", "shi", "song", "su", "sun", "tan", "tang", "wei", "wu", "xiao", "xie", "xu",
  "yan", "yang", "yao", "yu", "yuan", "zhang", "zhao", "zheng", "zhou", "zhu", "zou",
]);
const AMBIGUOUS_SURNAME_CUES = new Set(["lee", "lim", "wang"]);
const PINYIN_SUPPORTING_CUES = new Set(["wei", "yue", "yuan", "xuan", "xun", "qiu", "qin", "qing", "hao", "ran", "ming", "ting", "wen"]);
const PINYIN_GIVEN_SYLLABLES = new Set([
  "ai", "an", "ang", "ao", "bao", "bei", "bin", "bo", "cai", "can", "cao", "chang", "chen", "cheng", "chong", "chun",
  "da", "dan", "dao", "de", "deng", "di", "dian", "ding", "dong", "duan", "en", "er", "fan", "fang", "fei", "fen", "feng",
  "fu", "gan", "gang", "gao", "ge", "gong", "gu", "guan", "guang", "gui", "guo", "hai", "hao", "he", "heng", "hong", "hou",
  "hu", "hua", "huan", "huang", "hui", "huo", "jia", "jian", "jiang", "jiao", "jie", "jin", "jing", "jiong", "juan", "jun",
  "kai", "kang", "ke", "kong", "ku", "kun", "lai", "lan", "lang", "lao", "lei", "li", "lian", "liang", "liao", "lin", "ling",
  "liu", "long", "lu", "luo", "ma", "man", "mao", "mei", "meng", "mian", "miao", "ming", "mo", "mu", "na", "nan", "nao",
  "ni", "nian", "niang", "ning", "niu", "nong", "nuo", "pan", "pei", "peng", "ping", "pu", "qi", "qian", "qiang", "qiao", "qing",
  "qiu", "quan", "qun", "ran", "ren", "rong", "ru", "rui", "run", "san", "shan", "shao", "she", "shen", "sheng", "shi", "shou",
  "shu", "shuang", "si", "song", "su", "sun", "ta", "tai", "tan", "tang", "tao", "te", "tian", "ting", "tong", "tu", "wan",
  "wang", "wei", "wen", "wu", "xi", "xian", "xiang", "xiao", "xin", "xing", "xiong", "xiu", "xuan", "xue", "xun", "ya", "yan",
  "yang", "yao", "ye", "yi", "yin", "ying", "yong", "you", "yu", "yuan", "yun", "za", "zhan", "zhao", "zhen", "zheng", "zhi",
  "zhong", "zhou", "zhu", "zhuang", "zi", "zong", "zou", "zu",
]);

export function normalizeRomanNameText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function romanConsonantSignature(value) {
  return normalizeRomanNameText(value).replace(/[aeiouy]/g, "");
}

function romanNameTokens(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

function isLatinNameInput(value) {
  const text = String(value || "").trim();
  return Boolean(text) && /^[A-Za-z\s.'-]+$/.test(text) && /[A-Za-z]/.test(text);
}

function isCompoundCantoneseGivenNameToken(token) {
  if (token.length < 4) return false;
  for (let splitAt = 2; splitAt <= token.length - 2; splitAt += 1) {
    if (CANTONESE_GIVEN_SYLLABLES.has(token.slice(0, splitAt)) && CANTONESE_GIVEN_SYLLABLES.has(token.slice(splitAt))) {
      return true;
    }
  }
  return false;
}

function isLikelyCantoneseGivenNameToken(token) {
  return CANTONESE_GIVEN_SYLLABLES.has(token) || isCompoundCantoneseGivenNameToken(token);
}

function pinyinSyllableCount(token) {
  if (PINYIN_SUPPORTING_CUES.has(token) || PINYIN_GIVEN_SYLLABLES.has(token)) return 1;
  if (token.length < 4) return 0;
  const memo = new Map();
  function segment(position) {
    if (position === token.length) return 0;
    if (memo.has(position)) return memo.get(position);
    let best = -Infinity;
    for (let end = position + 2; end <= token.length; end += 1) {
      if (!PINYIN_GIVEN_SYLLABLES.has(token.slice(position, end))) continue;
      const tail = segment(end);
      if (tail >= 0) best = Math.max(best, 1 + tail);
    }
    memo.set(position, best);
    return best;
  }
  return Math.max(0, segment(0));
}

function isLikelyPinyinGivenNameToken(token) {
  return pinyinSyllableCount(token) > 0;
}

function formatRomanName(text) {
  return String(text || "")
    .trim()
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .split(/([\s-]+)/)
    .map((part) => (/^[a-z]+$/i.test(part) ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join("");
}

function keyboardSubstitutionCost(from, to) {
  if (from === to) return 0;
  const first = KEYBOARD_POSITIONS.get(from);
  const second = KEYBOARD_POSITIONS.get(to);
  if (!first || !second) return 1;
  const distance = Math.hypot(first.x - second.x, first.y - second.y);
  if (distance <= 1.15) return 0.45;
  if (distance <= 1.8) return 0.7;
  return 1;
}

function repeatedCharacterCost(text, index) {
  const character = text[index];
  return character && (text[index - 1] === character || text[index + 1] === character) ? 0.18 : 0.92;
}

function accidentalAdjacentKeyInsertionCost(source, sourceIndex, target, targetIndex) {
  const inserted = source[sourceIndex];
  const intendedNeighbors = [target[targetIndex - 1], target[targetIndex]].filter(Boolean);
  if (intendedNeighbors.some((letter) => keyboardSubstitutionCost(inserted, letter) <= 0.45)) return 0.36;
  return repeatedCharacterCost(source, sourceIndex);
}

export function keyboardWeightedDistance(source, target) {
  const first = normalizeRomanNameText(source);
  const second = normalizeRomanNameText(target);
  if (!first || !second) return Infinity;
  const table = Array.from({ length: first.length + 1 }, () => new Array(second.length + 1).fill(0));

  for (let row = 1; row <= first.length; row += 1) table[row][0] = table[row - 1][0] + repeatedCharacterCost(first, row - 1);
  for (let column = 1; column <= second.length; column += 1) table[0][column] = table[0][column - 1] + repeatedCharacterCost(second, column - 1);

  for (let row = 1; row <= first.length; row += 1) {
    for (let column = 1; column <= second.length; column += 1) {
      table[row][column] = Math.min(
        table[row - 1][column] + accidentalAdjacentKeyInsertionCost(first, row - 1, second, column),
        table[row][column - 1] + repeatedCharacterCost(second, column - 1),
        table[row - 1][column - 1] + keyboardSubstitutionCost(first[row - 1], second[column - 1]),
      );
      if (
        row > 1 &&
        column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1]
      ) {
        table[row][column] = Math.min(table[row][column], table[row - 2][column - 2] + 0.56);
      }
    }
  }
  return table[first.length][second.length];
}

export function createKoreanRomanSuggestionIndex(entries) {
  const bySurface = new Map();
  for (const entry of entries || []) {
    const normalized = normalizeRomanNameText(entry?.text);
    if (normalized.length < 3) continue;
    const next = {
      text: formatRomanName(entry.text),
      normalized,
      weight: Math.max(1, Number(entry.weight || 1)),
    };
    const existing = bySurface.get(normalized);
    if (!existing || next.weight > existing.weight) bySurface.set(normalized, next);
  }
  const items = [...bySurface.values()];
  const byLength = new Map();
  const vowellessBySignature = new Map();
  for (const item of items) {
    const bucket = byLength.get(item.normalized.length) || [];
    bucket.push(item);
    byLength.set(item.normalized.length, bucket);

    const signature = romanConsonantSignature(item.normalized);
    if (signature.length < 2 || signature === item.normalized || item.normalized.length > 7) continue;
    const signatureMatches = vowellessBySignature.get(signature) || new Map();
    const existing = signatureMatches.get(item.normalized);
    if (!existing || item.weight > existing.weight) signatureMatches.set(item.normalized, item);
    vowellessBySignature.set(signature, signatureMatches);
  }
  return {
    exactSurfaces: new Set(bySurface.keys()),
    byLength,
    vowellessBySignature: new Map(
      [...vowellessBySignature.entries()].map(([signature, matches]) => [
        signature,
        [...matches.values()].sort((first, second) => second.weight - first.weight || first.text.localeCompare(second.text)),
      ]),
    ),
  };
}

function typoDistanceLimit(length) {
  if (length <= 4) return 1.05;
  if (length <= 7) return 1.05;
  return 1.35;
}

export function isKoreanRomanShorthand(query) {
  if (!isLatinNameInput(query)) return false;
  const normalized = normalizeRomanNameText(query);
  return normalized.length >= 2 && normalized.length <= 4 && !/[aeiouy]/.test(normalized);
}

function shorthandSignatureVariants(signature) {
  const variants = [signature];
  for (let index = 1; index < signature.length; index += 1) {
    if (signature[index] !== signature[index - 1]) continue;
    const collapsed = `${signature.slice(0, index)}${signature.slice(index + 1)}`;
    if (collapsed.length >= 2 && !variants.includes(collapsed)) variants.push(collapsed);
  }
  return variants;
}

export function suggestKoreanRomanShorthand(query, index) {
  if (!index || !isKoreanRomanShorthand(query)) return null;
  const normalized = normalizeRomanNameText(query);
  for (const signature of shorthandSignatureVariants(normalized)) {
    const best = index.vowellessBySignature?.get(signature)?.[0];
    if (best) return { text: best.text };
  }
  return null;
}

export function suggestKoreanRomanSpelling(query, index) {
  if (!isLatinNameInput(query) || !index) return null;
  const normalized = normalizeRomanNameText(query);
  if (normalized.length < 3 || index.exactSurfaces?.has(normalized)) return null;

  const matches = [];
  for (let length = normalized.length - 2; length <= normalized.length + 2; length += 1) {
    for (const candidate of index.byLength?.get(length) || []) {
      if (differsOnlyByOneH(normalized, candidate.normalized)) continue;
      const distance = keyboardWeightedDistance(normalized, candidate.normalized);
      if (distance > typoDistanceLimit(Math.max(normalized.length, candidate.normalized.length))) continue;
      matches.push({
        ...candidate,
        distance,
        rank: distance - Math.min(0.42, Math.log1p(candidate.weight) * 0.06),
      });
    }
  }
  matches.sort((first, second) => first.rank - second.rank || first.distance - second.distance || second.weight - first.weight);
  const best = matches[0];
  const runnerUp = matches[1];
  if (!best) return null;
  if (runnerUp && runnerUp.rank - best.rank < 0.16 && best.distance > 0.3) return null;
  return { text: best.text, distance: best.distance };
}

function differsOnlyByOneH(first, second) {
  if (Math.abs(first.length - second.length) !== 1) return false;
  const longer = first.length > second.length ? first : second;
  const shorter = first.length > second.length ? second : first;
  for (let index = 0; index < longer.length; index += 1) {
    if (longer[index] !== "h") continue;
    if (`${longer.slice(0, index)}${longer.slice(index + 1)}` === shorter) return true;
  }
  return false;
}

export function detectPossibleChineseRomanization(query, options = {}) {
  if (!isLatinNameInput(query) || options.hasExactKoreanMatch) return null;
  const tokens = romanNameTokens(query);
  if (!tokens.length || tokens.length > 4) return null;

  let score = 0;
  const cues = [];
  const cantoneseSurnamePositions = new Set();
  const cantoneseGivenPositions = new Set();
  const mandarinSurnamePositions = new Set();
  const pinyinGivenPositions = new Set();
  let hasMultiSyllablePinyinGiven = false;
  let hasStrongPinyinCue = false;
  let hasStrongWadeGilesCue = false;
  let wadeGilesGivenCount = 0;
  for (const [position, token] of tokens.entries()) {
    const isCantoneseSurname = CANTONESE_SURNAME_CUES.has(token) || CANTONESE_AMBIGUOUS_SURNAME_CUES.has(token);
    const isMandarinSurname = MANDARIN_SURNAME_CUES.has(token);
    if (PINYIN_INITIAL_CUE.test(token)) {
      score += 4;
      hasStrongPinyinCue = true;
      cues.push("pinyin");
    }
    if (WADE_GILES_CUE.test(token)) {
      score += 4;
      hasStrongWadeGilesCue = true;
      cues.push("wade-giles");
    }
    if (WADE_GILES_GIVEN_CUE.test(token)) {
      score += 4;
      wadeGilesGivenCount += 1;
      hasStrongWadeGilesCue = true;
      cues.push("wade-giles");
    }
    if (CANTONESE_SURNAME_CUES.has(token)) {
      score += 4;
      cantoneseSurnamePositions.add(position);
      cues.push("cantonese");
    } else if (CANTONESE_AMBIGUOUS_SURNAME_CUES.has(token)) {
      score += 1;
      cantoneseSurnamePositions.add(position);
      cues.push("cantonese");
    }
    if (isLikelyCantoneseGivenNameToken(token)) {
      score += isCompoundCantoneseGivenNameToken(token) ? 4 : 2;
      cantoneseGivenPositions.add(position);
      cues.push("cantonese");
    }
    if (isMandarinSurname) {
      score += 3;
      mandarinSurnamePositions.add(position);
      cues.push("pinyin");
    }
    // A shared surname such as Hong is not independent evidence that the
    // same token is also a Chinese given-name syllable.
    if (!isCantoneseSurname && !isMandarinSurname && isLikelyPinyinGivenNameToken(token)) {
      score += 2;
      pinyinGivenPositions.add(position);
      hasMultiSyllablePinyinGiven ||= pinyinSyllableCount(token) >= 2;
      cues.push("pinyin");
    }
  }
  const hasDistinctCantonesePair = [...cantoneseSurnamePositions].some(
    (position) => [...cantoneseGivenPositions].some((givenPosition) => givenPosition !== position),
  );
  const hasDistinctMandarinPinyinPair = [...mandarinSurnamePositions].some(
    (position) => [...pinyinGivenPositions].some((givenPosition) => givenPosition !== position),
  );
  const hasAmbiguousSurnameWithPinyinGiven =
    tokens.length >= 2 &&
    tokens.some((token) => AMBIGUOUS_SURNAME_CUES.has(token)) &&
    pinyinGivenPositions.size > 0;
  const hasAmbiguousSurnameWithWadeGilesGiven =
    tokens.length >= 2 &&
    tokens.some((token) => AMBIGUOUS_SURNAME_CUES.has(token)) &&
    wadeGilesGivenCount > 0;
  if (WADE_GILES_APOSTROPHE_CUE.test(query)) {
    score += 6;
    hasStrongWadeGilesCue = true;
    cues.push("wade-giles");
  }
  if (hasAmbiguousSurnameWithPinyinGiven && hasMultiSyllablePinyinGiven) {
    score += 4;
    cues.push("pinyin");
  }
  if (hasAmbiguousSurnameWithWadeGilesGiven) {
    score += 2;
    cues.push("wade-giles");
  }
  if (hasDistinctCantonesePair) {
    score += 3;
    cues.push("cantonese");
  }
  if (hasDistinctMandarinPinyinPair && hasMultiSyllablePinyinGiven) {
    score += 2;
    cues.push("pinyin");
  }
  if (mandarinSurnamePositions.size && wadeGilesGivenCount) {
    score += 2;
    cues.push("wade-giles");
  }
  const hasCompoundCantoneseGiven = tokens.some((token) => isCompoundCantoneseGivenNameToken(token));
  if (hasCompoundCantoneseGiven) score += 2;
  const hasIInitialSurnameLastPattern =
    tokens.length >= 3 &&
    tokens[0] === "i" &&
    mandarinSurnamePositions.has(tokens.length - 1) &&
    pinyinGivenPositions.size > 0;
  if (hasIInitialSurnameLastPattern) {
    score += 2;
    cues.push("pinyin");
  }
  const hasDistinctChinesePattern =
    hasStrongPinyinCue ||
    hasStrongWadeGilesCue ||
    hasCompoundCantoneseGiven ||
    hasDistinctCantonesePair ||
    (hasDistinctMandarinPinyinPair && hasMultiSyllablePinyinGiven) ||
    (hasAmbiguousSurnameWithPinyinGiven && hasMultiSyllablePinyinGiven) ||
    hasIInitialSurnameLastPattern;
  return score >= 6 && hasDistinctChinesePattern ? { score, cues: [...new Set(cues)] } : null;
}

export function analyzeLatinNameInput(query, index) {
  const possibleChinese = detectPossibleChineseRomanization(query, {
    hasExactKoreanMatch: Boolean(index?.exactSurfaces?.has(normalizeRomanNameText(query))),
  });
  if (possibleChinese) return { possibleChinese, suggestion: null };
  const shorthand = suggestKoreanRomanShorthand(query, index);
  if (shorthand) return { possibleChinese: null, suggestion: shorthand };
  return { possibleChinese: null, suggestion: suggestKoreanRomanSpelling(query, index) };
}
