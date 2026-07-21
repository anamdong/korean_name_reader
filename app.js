const dataUrl = "./data/name_index.json?v=20260626-gye-ge-kana";
const hanjaReadingUrl = "./data/hanja_readings.json?v=20260721-unihan-khangul";
const hanjaNameCharUrl = "./data/hanja_name_chars.json?v=20260721-top1000-name-hanja";
const hanjaUsageRankUrl = "./data/hanja_usage_rank.json?v=20260721-ohmybaby-top50";

const state = {
  data: null,
  runtime: null,
  queryMeta: null,
};

const scriptPatterns = {
  hangul: /[가-힣]/g,
  latin: /[A-Za-zÀ-ȳŏŭŎŬ]/g,
  kana: /[ァ-ヶー゛゜ぁ-ゖゝゞ]/g,
  hanja: /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g,
};

const resultTemplate = document.querySelector("#result-template");
const resultsSectionEl = document.querySelector(".results-section");
const resultsEl = document.querySelector("#results");
const interpretationEl = document.querySelector("#query-interpretation");
const queryEl = document.querySelector("#query");
const formEl = document.querySelector("#search-form");
const exampleChipEls = Array.from(document.querySelectorAll(".example-chip"));
const typewriterNameEl = document.querySelector("#typewriter-name");
let activePronunciationButton = null;
let activePronunciationAudio = null;
let activePronunciationUtterance = null;
let typewriterTimerId = null;

const TYPEWRITER_EXAMPLE_COUNT = 24;
const TYPEWRITER_TYPE_DELAY_MS = 72;
const TYPEWRITER_DELETE_DELAY_MS = 42;
const TYPEWRITER_HOLD_DELAY_MS = 1280;

const compoundSurnamesFallback = new Set(["남궁", "황보", "선우", "제갈", "사공", "서문", "독고", "동방", "어금", "망절"]);
const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const HANGUL_ONSETS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const HANGUL_VOWELS = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
const HANGUL_CODAS = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const COMPLEX_CODAS = new Set(["ㄳ", "ㄵ", "ㄶ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅄ"]);
const KANA_CODA_CARRIER_MAP = new Map([
  ["ム", new Set(["ㅁ"])],
  ["ン", new Set(["ㄴ", "ㅇ"])],
  ["ク", new Set(["ㄱ"])],
  ["プ", new Set(["ㅂ"])],
  ["ル", new Set(["ㄹ"])],
]);

function stripDiacritics(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeLatin(text) {
  return stripDiacritics(text).toLowerCase().replace(/[^a-z]/g, "");
}

const MODERN_KOREAN_SURNAME_ROMAN_ALLOWLIST = new Map(Object.entries({
  김: ["kim", "gim"],
  이: ["lee", "yi", "i", "rhee"],
  박: ["park", "bak", "pak"],
  최: ["choi", "choe"],
  정: ["jung", "jeong", "chung"],
  조: ["cho", "jo", "joh"],
  강: ["kang", "gang"],
  윤: ["yoon", "yun"],
  장: ["jang", "chang"],
  임: ["im", "yim", "lim"],
  한: ["han", "hahn"],
  오: ["oh", "o"],
  서: ["seo", "so", "suh"],
  신: ["shin", "sin"],
  권: ["kwon", "gwon", "kweon"],
  황: ["hwang"],
  안: ["ahn", "an"],
  송: ["song"],
  전: ["jeon", "jun", "chun", "cheon"],
  홍: ["hong"],
  유: ["yoo", "yu", "you", "ryu", "ryoo", "lyu"],
  류: ["ryu", "ryoo", "yoo", "you", "lyu", "yu"],
  노: ["noh", "no", "roh", "ro", "rho"],
  차: ["cha"],
  후: ["hu"],
  흥: ["heung"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

const BLOCKED_SURNAME_ROMAN_BY_HANGUL = new Map(Object.entries({
  후: ["hong", "hoo", "hou", "huu", "who"],
  흥: ["hong", "huynh", "khuong", "hung"],
  홍: ["heong", "heung", "hohng", "houng", "whong"],
  황: ["hang", "hoang", "huang", "hyang"],
  안: ["anh"],
  장: ["zhang", "zang"],
  권: ["guan"],
  한: ["hwan", "khan"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

const MODERN_GIVEN_SYLLABLE_ROMAN_OUTPUT_ALLOWLIST = new Map(Object.entries({
  도: ["do"],
  언: ["eon"],
  헌: ["hun", "heon"],
  후: ["hu"],
  홍: ["hong"],
  흥: ["heung"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

const BLOCKED_GIVEN_ROMAN_BY_HANGUL = new Map(Object.entries({
  태: ["t"],
}).map(([hangul, variants]) => [hangul, new Set(variants)]));

function isModernRomanText(text) {
  return /^[A-Za-z][A-Za-z -]*$/.test(text || "");
}

function modernGivenRomanVariantsForOutput(syllable, variants) {
  const modernVariants = (variants || []).filter((item) => isModernRomanText(item.text));
  const allowlist = MODERN_GIVEN_SYLLABLE_ROMAN_OUTPUT_ALLOWLIST.get(syllable);
  if (allowlist) {
    const filtered = modernVariants.filter((item) => allowlist.has(normalizeLatin(item.text)));
    if (filtered.length) return filtered;
  }
  const blocklist = BLOCKED_GIVEN_ROMAN_BY_HANGUL.get(syllable);
  const filtered = modernVariants.filter((item) => {
    const norm = normalizeLatin(item.text);
    if (!norm) return false;
    if (blocklist?.has(norm)) return false;
    if (!hasRomanVowel(norm)) return false;
    return !/(?:uh|aeu)/.test(norm);
  });
  return filtered.length ? filtered : modernVariants;
}

function isModernKoreanSurnameRomanVariant(hangul, item, index = 0) {
  const text = item?.text || "";
  if (!isModernRomanText(text)) return false;
  const norm = normalizeLatin(text);
  if (!norm) return false;
  if (BLOCKED_SURNAME_ROMAN_BY_HANGUL.get(hangul)?.has(norm)) return false;
  if (MODERN_KOREAN_SURNAME_ROMAN_ALLOWLIST.get(hangul)?.has(norm)) return true;
  const score = Number(item?.score || 0);
  return score >= 5.5 || (index === 0 && score >= 4.5);
}

function isUnsupportedComplexCodaInData(syllable, data) {
  const parts = decomposeHangulSyllable(syllable);
  if (!parts?.coda || !COMPLEX_CODAS.has(parts.coda)) return false;
  return !data?.syllables?.[syllable]?.sinoAllowed;
}

function hasIndexNameEvidence(syllable, data) {
  const item = data?.syllables?.[syllable];
  if (!item || isUnsupportedComplexCodaInData(syllable, data)) return false;
  return (
    Number(item.nameCount || 0) > 0 ||
    Number(item.givenCount || 0) > 0 ||
    Number(item.initialCount || 0) > 0 ||
    Number(item.surnamePopulation || 0) > 0 ||
    Number(item.hanjaGivenCount || 0) > 0 ||
    Number(item.decadeWeight || 0) > 0 ||
    Number(item.decadePeriods || 0) > 0 ||
    item.sinoAllowed === true ||
    item.nonSinoException === true
  );
}

function hasGivenNameEvidenceInData(syllable, data) {
  const item = data?.syllables?.[syllable];
  if (!item || isUnsupportedComplexCodaInData(syllable, data)) return false;
  return (
    Number(item.givenCount || 0) > 0 ||
    Number(item.hanjaGivenCount || 0) > 0 ||
    Number(item.decadeWeight || 0) > 0 ||
    Number(item.decadePeriods || 0) > 0 ||
    item.sinoAllowed === true ||
    item.nonSinoException === true
  );
}

function sanitizeModernNameEvidenceData(data) {
  if (!data?.syllables) return data;
  const supportedSyllables = new Set(
    Object.entries(data.syllables)
      .filter(([syllable]) => hasIndexNameEvidence(syllable, data))
      .map(([syllable]) => syllable),
  );
  const filterSyllableItems = (items) => (items || []).filter((item) => supportedSyllables.has(item.hangul));
  const filterIndex = (index) => {
    const filtered = {};
    for (const [key, items] of Object.entries(index || {})) {
      const kept = filterSyllableItems(items);
      if (kept.length) filtered[key] = kept;
    }
    return filtered;
  };

  data.syllables = Object.fromEntries(
    Object.entries(data.syllables).filter(([syllable]) => supportedSyllables.has(syllable)),
  );
  data.syllableLatinIndex = filterIndex(data.syllableLatinIndex);
  data.syllableKanaIndex = filterIndex(data.syllableKanaIndex);
  data.hanjaGivenIndex = filterIndex(data.hanjaGivenIndex);
  if (data.meta) data.meta.syllableCount = supportedSyllables.size;
  return data;
}

function rebuildSyllableLatinIndex(data) {
  const index = {};
  for (const [hangul, syllable] of Object.entries(data?.syllables || {})) {
    for (const item of syllable.latin || []) {
      const norm = normalizeLatin(item.text);
      if (!norm) continue;
      const bucket = index[norm] || [];
      bucket.push({ hangul, score: Number(item.score) || 0 });
      index[norm] = bucket;
    }
  }

  for (const key of Object.keys(index)) {
    index[key].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }

  data.syllableLatinIndex = index;
}

function sanitizeModernKoreanRomanData(data) {
  if (!data) return data;
  const allowedSurnameRomanByHangul = new Map();

  data.surnames = (data.surnames || []).map((surname) => {
    const filteredLatin = (surname.latin || []).filter((item, index) =>
      isModernKoreanSurnameRomanVariant(surname.hangul, item, index),
    );
    const fallbackLatin = filteredLatin.length
      ? filteredLatin
      : (surname.latin || []).filter((item) => isModernRomanText(item.text)).slice(0, 1);
    allowedSurnameRomanByHangul.set(
      surname.hangul,
      new Set(fallbackLatin.map((item) => normalizeLatin(item.text)).filter(Boolean)),
    );
    return { ...surname, latin: fallbackLatin };
  });

  if (data.surnameLatinIndex) {
    const filteredIndex = {};
    for (const [key, items] of Object.entries(data.surnameLatinIndex)) {
      const norm = normalizeLatin(key);
      const kept = (items || []).filter((item) => allowedSurnameRomanByHangul.get(item.hangul)?.has(norm));
      if (kept.length) filteredIndex[norm] = kept;
    }
    data.surnameLatinIndex = filteredIndex;
  }

  data.fullNames = (data.fullNames || []).map((row) => ({
    ...row,
    romanizations: (row.romanizations || []).filter((item) => isModernRomanText(item.text)),
  }));

  if (data.fullNameRomanIndex) {
    const filteredIndex = {};
    for (const [index, row] of (data.fullNames || []).entries()) {
      for (const item of row.romanizations || []) {
        const norm = normalizeLatin(item.text);
        if (!norm) continue;
        const bucket = filteredIndex[norm] || [];
        bucket.push({ index: String(index), score: Number(item.score) || 0 });
        filteredIndex[norm] = bucket;
      }
    }
    data.fullNameRomanIndex = filteredIndex;
  }

  for (const [syllable, meta] of Object.entries(data.syllables || {})) {
    const filteredLatin = modernGivenRomanVariantsForOutput(syllable, meta.latin || []);
    meta.latin = filteredLatin.length ? filteredLatin : (meta.latin || []).filter((item) => isModernRomanText(item.text));
  }
  rebuildSyllableLatinIndex(data);

  return sanitizeModernNameEvidenceData(data);
}

function attachHanjaReadingData(data, hanjaReadingData) {
  const readings = hanjaReadingData?.readings;
  if (!data || !readings || typeof readings !== "object") return data;
  data.hanjaReadingIndex = readings;
  if (data.meta && hanjaReadingData.meta) {
    data.meta.hanjaReadingSource = hanjaReadingData.meta.source || "Unihan";
    data.meta.hanjaReadingField = hanjaReadingData.meta.field || "kHangul";
    data.meta.hanjaReadingCount = Number(hanjaReadingData.meta.readingCount || 0);
  }
  return data;
}

function attachHanjaNameCharData(data, hanjaNameCharData) {
  const byReading = hanjaNameCharData?.charactersByReading;
  if (!data || !byReading || typeof byReading !== "object") return data;
  data.hanjaNameCharsByReading = byReading;
  if (data.meta && hanjaNameCharData.meta) {
    data.meta.hanjaNameCharSource = hanjaNameCharData.meta.source || "Unihan kHangul";
    data.meta.hanjaNameCharCount = Number(hanjaNameCharData.meta.characterCount || 0);
  }
  return data;
}

function attachHanjaUsageRankData(data, hanjaUsageRankData) {
  if (!data || !hanjaUsageRankData) return data;
  data.hanjaUsageGivenNames = hanjaUsageRankData.givenNames || {};
  data.hanjaUsageCharsByReading = hanjaUsageRankData.charactersByReading || {};
  if (data.meta && hanjaUsageRankData.meta) {
    data.meta.hanjaUsageRankSource = hanjaUsageRankData.meta.source || "Modern baby-name Hanja usage prior";
    data.meta.hanjaUsageRankCharacterReadingCount = Number(hanjaUsageRankData.meta.characterReadingCount || 0);
  }
  return data;
}

async function fetchOptionalJson(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
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

const BLOCKED_JAPANESE_KANA_SURFACES = ["ウンチ"];

function isBlockedJapaneseKanaSurface(text) {
  const norm = normalizeKana(text || "");
  if (!norm) return false;
  return BLOCKED_JAPANESE_KANA_SURFACES.some((surface) => norm.includes(surface));
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

function configuredTtsEndpoint() {
  if (typeof window === "undefined") return "";
  const endpoint = window.KOREAN_NAME_TTS_ENDPOINT;
  return typeof endpoint === "string" ? endpoint.trim() : "";
}

function supportsSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function supportsAudioPlayback() {
  return typeof Audio !== "undefined";
}

function isLikelyMobileBrowser() {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const userAgent = navigator.userAgent || "";
  const touchCapable = Number(navigator.maxTouchPoints || 0) > 0;
  const coarsePointer = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return /android|iphone|ipad|ipod|mobile/i.test(userAgent) || (touchCapable && coarsePointer);
}

function koreanSpeechVoice() {
  if (!supportsSpeechSynthesis()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => /^ko(?:[-_]|$)/i.test(voice.lang || "")) ||
    voices.find((voice) => /korean|한국|yuna|sora/i.test(`${voice.name || ""} ${voice.lang || ""}`)) ||
    null
  );
}

function setPronunciationButtonState(button, state) {
  if (!button) return;
  button.dataset.state = state;
  button.disabled = state === "loading";
}

function resetPronunciationButton(button) {
  if (!button) return;
  button.dataset.state = "idle";
  button.disabled = false;
}

function hasActiveSpeechSynthesisQueue() {
  if (!supportsSpeechSynthesis()) return false;
  const speechSynthesis = window.speechSynthesis;
  return Boolean(activePronunciationUtterance || speechSynthesis.speaking || speechSynthesis.pending);
}

function stopActivePronunciation() {
  if (activePronunciationAudio) {
    activePronunciationAudio.pause();
    activePronunciationAudio.removeAttribute("src");
    activePronunciationAudio.load();
    activePronunciationAudio = null;
  }
  if (hasActiveSpeechSynthesisQueue()) {
    window.speechSynthesis.cancel();
  }
  if (activePronunciationButton) {
    resetPronunciationButton(activePronunciationButton);
  }
  activePronunciationButton = null;
  activePronunciationUtterance = null;
}

function ttsEndpointUrl(endpoint, text) {
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set("text", text);
  url.searchParams.set("lang", "ko");
  return url.toString();
}

function naverTtsAudioUrl(text) {
  const url = new URL("https://dict.naver.com/api/nvoice");
  url.searchParams.set("service", "dictionary");
  url.searchParams.set("speech_fmt", "mp3");
  url.searchParams.set("text", text);
  url.searchParams.set("speaker", "kyuri");
  url.searchParams.set("speed", "0");
  return url.toString();
}

function ttsAudioCandidates(text) {
  const endpoint = configuredTtsEndpoint();
  return [
    endpoint ? ttsEndpointUrl(endpoint, text) : "",
    naverTtsAudioUrl(text),
  ].filter(Boolean);
}

function playTtsAudioUrl(url) {
  return new Promise((resolve, reject) => {
    if (!supportsAudioPlayback()) {
      reject(new Error("Audio playback unavailable"));
      return;
    }
    const audio = new Audio(url);
    let finished = false;
    let started = false;
    const startTimeout = window.setTimeout(() => {
      if (started || finished) return;
      finished = true;
      audio.pause();
      reject(new Error("TTS audio did not start"));
    }, 2500);
    const finish = (callback) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(startTimeout);
      callback();
    };
    const markStarted = () => {
      started = true;
      window.clearTimeout(startTimeout);
    };
    activePronunciationAudio = audio;
    audio.addEventListener("playing", markStarted, { once: true });
    audio.addEventListener("ended", () => finish(resolve), { once: true });
    audio.addEventListener("error", () => finish(() => reject(new Error("TTS audio failed"))), { once: true });
    audio.play().then(markStarted).catch((error) => finish(() => reject(error)));
  });
}

function estimatedSpeechDurationMs(text) {
  const syllableCount = Array.from(text || "").length;
  return Math.min(4200, Math.max(1400, 800 + syllableCount * 260));
}

function playSpeechSynthesisPronunciation(text, button, options = {}) {
  return new Promise((resolve, reject) => {
    if (!supportsSpeechSynthesis()) {
      reject(new Error("Speech synthesis unavailable"));
      return;
    }

    const { cancelExisting = true } = options;
    if (cancelExisting && hasActiveSpeechSynthesisQueue()) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = koreanSpeechVoice();
    let settled = false;
    const fallbackEndTimeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, estimatedSpeechDurationMs(text));
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackEndTimeout);
      callback();
    };

    utterance.lang = "ko-KR";
    utterance.rate = 0.88;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      setPronunciationButtonState(button, "playing");
    };
    utterance.onend = () => finish(resolve);
    utterance.onerror = (event) => finish(() => reject(event.error || new Error("Speech synthesis failed")));
    activePronunciationUtterance = utterance;
    setPronunciationButtonState(button, "playing");
    window.speechSynthesis.speak(utterance);
    if (typeof window.speechSynthesis.resume === "function") {
      window.speechSynthesis.resume();
    }
  });
}

async function playKoreanPronunciation(text, button) {
  if (!text) return;
  if (button === activePronunciationButton && button.dataset.state === "playing") {
    stopActivePronunciation();
    return;
  }

  stopActivePronunciation();
  activePronunciationButton = button;
  const shouldUseMobileSpeechFirst = isLikelyMobileBrowser() && supportsSpeechSynthesis();

  if (shouldUseMobileSpeechFirst) {
    try {
      await playSpeechSynthesisPronunciation(text, button, { cancelExisting: false });
      resetPronunciationButton(button);
      activePronunciationButton = null;
      activePronunciationUtterance = null;
      return;
    } catch {
      activePronunciationUtterance = null;
      setPronunciationButtonState(button, "loading");
    }
  } else {
    setPronunciationButtonState(button, "loading");
  }

  for (const audioUrl of ttsAudioCandidates(text)) {
    try {
      setPronunciationButtonState(button, "playing");
      await playTtsAudioUrl(audioUrl);
      activePronunciationAudio = null;
      resetPronunciationButton(button);
      activePronunciationButton = null;
      return;
    } catch {
      activePronunciationAudio = null;
      setPronunciationButtonState(button, "loading");
    }
  }

  if (!supportsSpeechSynthesis() || isLikelyMobileBrowser()) {
    button.disabled = true;
    button.dataset.state = "unavailable";
    activePronunciationButton = null;
    return;
  }

  try {
    await playSpeechSynthesisPronunciation(text, button);
    resetPronunciationButton(button);
    activePronunciationButton = null;
    activePronunciationUtterance = null;
  } catch {
    button.disabled = true;
    button.dataset.state = "unavailable";
    activePronunciationButton = null;
    activePronunciationUtterance = null;
  }
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

function hasRomanHyphenBoundary(text) {
  return /[A-Za-z]-+[A-Za-z]/.test(romanTextToTokenish(text));
}

function splitRomanTokens(text) {
  return splitRomanGroups(text).flat();
}

function isLeeSurnameCue(token) {
  return normalizeLatin(token) === "lee";
}

function forcedRomanHangulCandidates(token) {
  const norm = normalizeLatin(token);
  if (!norm) return null;
  if (norm === "joong") {
    return [{ hangul: "중", score: 100000 }];
  }
  if (norm === "yon") {
    return [{ hangul: "연", score: 100000 }];
  }
  return null;
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
    ["kyeng", "kyung", 2],
    ["hayon", "hayeon", 2],
    ["jeoun", "jeon", 5],
    ["guen", "gyun", 3],
    ["kwi", "gwi", 2],
    ["heun", "heon", 2],
    ["yeu", "yu", 3],
    ["yeoun", "yeon", 5],
    ["ryeon", "yeon", 180],
    ["ryun", "yun", 180],
    ["lyeon", "yeon", 180],
    ["lyun", "yun", 180],
    ["yea", "ye", 5],
    ["yae", "ye", 2],
    ["sunghyun", "sunghyeon", 2],
    ["junghyun", "junghyeon", 2],
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
  if (/[aeiouy]ll(?=[bcdfghjklmnpqrstvwxyz]|$)/.test(norm)) {
    variants.push({
      token: norm.replace(/([aeiouy])ll(?=[bcdfghjklmnpqrstvwxyz]|$)/g, "$1l"),
      penalty: 2,
    });
  }
  if (/[aeiouy]c(?=[bcdfghjklmnpqrstvwxyz]|$)/.test(norm)) {
    variants.push({
      token: norm.replace(/([aeiouy])c(?=[bcdfghjklmnpqrstvwxyz]|$)/g, "$1k"),
      penalty: 2,
    });
  }
  if (norm.includes("v")) {
    variants.push({
      token: norm.replaceAll("v", "b"),
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

function analyzeQueryMeta(query) {
  const groups = tokenizeByScript(query);
  const romanGroups = splitRomanGroups(query);
  const romanTokens = romanGroups.flat();
  const singleRomanToken = groups.length === 1 && groups[0]?.type === "latin" && romanGroups.length === 1 && romanTokens.length === 1;
  const normalizedSingleRoman = singleRomanToken ? normalizeLatin(romanTokens[0]) : "";
  return {
    isSingleRomanToken: singleRomanToken,
    explicitMedialRomanLateralCue: !!normalizedSingleRoman && /[a-z][rl]y(?:a|e|o|u|i)/.test(normalizedSingleRoman),
  };
}

function candidateKey(hangul, kind = "full") {
  return `${kind}:${hangul}`;
}

function candidateKindLabel(kind) {
  if (kind === "surname") return "surname";
  if (kind === "given") return "given name";
  return "full name";
}

function candidateGivenUnits(candidate) {
  if (candidate.kind === "given") return Array.from(candidate.hangul);
  if (candidate.kind === "surname") return [];
  return Array.from(splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames).given);
}

function isLikelyFullNameMisparsedAsGiven(candidate, candidateMap) {
  if (!candidate || candidate.kind !== "given") return false;
  const units = Array.from(candidate.hangul || "");
  if (units.length < 3 || units.length > 4) return false;
  const { surname, given } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
  if (!surname || !given) return false;
  if (!state.runtime?.surnameByHangul?.has(surname)) return false;
  const givenUnits = Array.from(given);
  const supportedGiven =
    hasSupportedWholeGivenName(givenUnits) ||
    givenUnits.every((syllable) => hasGivenSyllableEvidence(syllable) || isSinoLikeGivenSyllable(syllable));
  if (!supportedGiven) return false;
  if (!candidateMap) return true;
  return candidateMap.has(candidateKey(candidate.hangul, "full"));
}

function candidateRankingScore(candidate) {
  let score = Number(candidate?.score);
  if (!Number.isFinite(score)) score = 0;
  const evidenceList = candidate?.evidence ? [...candidate.evidence] : [];
  if (
    candidate?.kind === "full" &&
    evidenceList.some((item) => /Supplemental attested Roman query match|Exact Romanized name match/.test(item))
  ) {
    score += 180;
  }
  if (candidate?.kind === "full" && state.queryMeta?.isSingleRomanToken) {
    const { surname } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
    score += surnamePopulationPrior(surname);
  }
  const units = candidateGivenUnits(candidate);
  if (candidate?.kind !== "surname" && units.length) {
    if (hasSupportedWholeGivenName(units)) {
      score += 900 + Math.min(1600, givenWholeNamePrior(units) * 0.4) + givenWholeNameRankingBoost(units);
    } else if (units.length >= 2) {
      score -= 780;
      if (units.some((syllable) => isUltraRareGivenSyllable(syllable))) {
        score -= 360;
      }
    }
  }
  const liveNormalizedQuery = normalizeLatin(queryEl?.value || "");
  const explicitMedialRomanLateralCue =
    state.queryMeta?.explicitMedialRomanLateralCue ||
    (!!liveNormalizedQuery && /[a-z][rl]y(?:a|e|o|u|i)/.test(liveNormalizedQuery));
  if (explicitMedialRomanLateralCue && candidate?.kind === "given" && units.length === 2) {
    const secondParts = decomposeHangulSyllable(units[1]);
    if (secondParts && DUUM_RECOVERY_VOWELS.has(secondParts.vowel)) {
      if (secondParts.onset === "ㄹ" && isPlausibleRecoveredDuumSyllable(units[1])) score += 100000;
      else if (secondParts.onset === "ㅇ") score -= 100000;
    }
  }
  return Number.isFinite(score) ? score : 0;
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
  return isUnsupportedComplexCodaInData(syllable, state.data);
}

function kanaSyllableAliases(chunk) {
  const norm = normalizeKana(chunk);
  const aliases = [];
  const voicedGiyeok = voiceInitialGiyeokKana(norm);
  if (voicedGiyeok && voicedGiyeok !== norm) {
    const voicedMatches = state.data.syllableKanaIndex?.[voicedGiyeok] || [];
    for (const item of voicedMatches) {
      if (decomposeHangulSyllable(item.hangul)?.onset !== "ㄱ") continue;
      aliases.push({
        hangul: item.hangul,
        score: Number(item.score || 0) * 0.64,
      });
    }
  }
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

const REVERSE_NIEUN_LIAISON_PREFIXES = [
  ["ニャ", ["ヤ", "ヒャ"]],
  ["ニュ", ["ユ", "ヒュ"]],
  ["ニョ", ["ヨ", "ヒョ"]],
  ["ニェ", ["イェ", "ヒェ"]],
  ["ナ", ["ア", "ハ", "ファ"]],
  ["ニ", ["イ", "ヒ", "フィ"]],
  ["ヌ", ["ウ", "フ"]],
  ["ネ", ["エ", "ヘ", "フェ"]],
  ["ノ", ["オ", "ホ", "フォ"]],
];

function reverseNieunLiaisonSurfaces(text) {
  const norm = normalizeKana(text);
  const surfaces = [];
  for (const [from, originals] of REVERSE_NIEUN_LIAISON_PREFIXES) {
    if (!norm.startsWith(from)) continue;
    for (const original of originals) {
      surfaces.push(`${original}${norm.slice(from.length)}`);
    }
  }
  return surfaces;
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

function voiceInitialGiyeokKana(text) {
  if (!text) return text;
  const replacements = [
    ["キャ", "ギャ"],
    ["キュ", "ギュ"],
    ["キョ", "ギョ"],
    ["キェ", "ギェ"],
    ["クァ", "グァ"],
    ["クェ", "グェ"],
    ["クィ", "グィ"],
    ["クォ", "グォ"],
    ["カ", "ガ"],
    ["キ", "ギ"],
    ["ク", "グ"],
    ["ケ", "ゲ"],
    ["コ", "ゴ"],
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

function givenRomanContextScore(syllable, romanText, score) {
  const parts = decomposeHangulSyllable(syllable);
  const norm = normalizeLatin(romanText);
  let value = Number(score) || 0;
  if (!parts || !norm) return value;

  if (parts.onset === "ㅈ" && norm.startsWith("ch")) {
    value *= 0.08;
  } else if (parts.onset === "ㅊ" && norm.startsWith("ch")) {
    value = Math.max(value, 96);
  }

  return value;
}

function contextualGivenRomanCandidates(items, token) {
  if (!items?.length) return [];
  return items
    .map((item) => ({
      ...item,
      score: givenRomanContextScore(item.hangul, token, item.score),
    }))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
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

function givenWholeNameRankingBoost(units) {
  const name = units.join("");
  if (!name) return 0;
  const data = state.data?.givenNames?.[name];
  if (!data) return 0;
  const totalWeight = Number(data.totalWeight || 0);
  const periodsPresentCount = Number(data.periodsPresentCount || 0);
  const datasetCount = Number(data.datasetCount || 0);
  const rowOccurrences = Number(data.rowOccurrences || 0);
  let boost = 0;
  if (totalWeight > 0) boost += Math.pow(Math.log1p(totalWeight), 3) * 10;
  if (periodsPresentCount > 0) boost += periodsPresentCount * 120;
  if (datasetCount > 0) boost += datasetCount * 260;
  if (rowOccurrences > 0) boost += rowOccurrences * 45;
  return boost;
}

function surnamePopulationPrior(hangul) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  const population = Number(surnameData?.population || 0);
  if (!population) return -2200;

  let prior = Math.log1p(population) * 115;
  if (population < 50) prior -= 2600;
  else if (population < 200) prior -= 1850;
  else if (population < 1000) prior -= 1100;
  else if (population < 10000) prior -= 520;
  else if (population < 50000) prior -= 140;

  return prior;
}

function hasSupportedWholeGivenName(units) {
  const name = units.join("");
  if (!name) return false;
  const data = state.data?.givenNames?.[name];
  if (!data) return false;
  return Number(data.totalWeight || 0) > 0 || Number(data.datasetCount || 0) > 0 || Number(data.rowOccurrences || 0) > 0;
}

function givenUnitsNamePrior(units) {
  const extraUnitPenalty = units.length <= 2 ? 0 : (units.length - 2) * 80;
  const wholePrior = givenWholeNamePrior(units);
  const supportedWholeName = hasSupportedWholeGivenName(units);
  const syllablePrior = units.reduce((sum, syllable) => {
    const prior = givenSyllableNamePrior(syllable);
    return sum + (supportedWholeName ? Math.max(prior, -60) : prior);
  }, 0);
  return syllablePrior + wholePrior - extraUnitPenalty;
}

function hasGivenSyllableEvidence(syllable) {
  return hasGivenNameEvidenceInData(syllable, state.data);
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

function isNameLikeGivenSyllable(syllable) {
  return hasGivenNameEvidenceInData(syllable, state.data);
}

function isNameLikeGivenUnits(units) {
  if (!units?.length) return false;
  if (hasSupportedWholeGivenName(units)) return true;
  return units.every((syllable) => isNameLikeGivenSyllable(syllable));
}

function isNameLikeCandidate(candidate) {
  if (!candidate?.hangul) return false;
  if (candidate.kind === "surname") {
    return !!state.runtime?.surnameByHangul?.has(candidate.hangul);
  }
  const units = candidateGivenUnits(candidate);
  if (!isNameLikeGivenUnits(units)) return false;
  if (candidate.kind === "given") return true;
  const { surname, given } = splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames);
  return !!given && !!state.runtime?.surnameByHangul?.has(surname);
}

function hasCandidateExactEvidence(candidate) {
  return (
    (candidate?.exactIds && candidate.exactIds.size > 0) ||
    [...(candidate?.evidence || [])].some((item) => /Exact|Supplemental/.test(item))
  );
}

function isFullyAllowedGivenCandidate(candidate) {
  return candidate.units.every((syllable) => isAllowedNameSyllable(syllable));
}

function isSinoLikeGivenSyllable(syllable) {
  return isSinoAllowedSyllable(syllable) || hasHanjaGivenSupport(syllable) || isPlausibleRecoveredDuumSyllable(syllable);
}

function isSinoLikeRomanGivenCandidate(candidate) {
  return candidate.units.every((syllable) => isSinoLikeGivenSyllable(syllable));
}

function isSinoBackedGivenCandidate(candidate) {
  return candidate.units.every((syllable) => isSinoAllowedSyllable(syllable) || hasHanjaGivenSupport(syllable));
}

function filterEvidenceBackedGivenCandidates(candidates) {
  const filteredComplexCoda = candidates.filter(
    (candidate) => candidate.units.every((syllable) => !isBlockedUnsupportedComplexCodaSyllable(syllable)),
  );
  const pool = filteredComplexCoda.length ? filteredComplexCoda : candidates;
  const evidenceBacked = pool.filter((candidate) =>
    hasSupportedWholeGivenName(candidate.units) ||
    candidate.units.every((syllable) => hasGivenSyllableEvidence(syllable) || isSinoLikeGivenSyllable(syllable)),
  );
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
  if (!DUUM_RECOVERY_VOWELS.has(parts.vowel)) return false;
  if (isAllowedNameSyllable(syllable) || hasGivenSyllableEvidence(syllable) || hasHanjaGivenSupport(syllable)) {
    return true;
  }
  const recoveredSurface = composeHangulSyllable("ㄴ", parts.vowel, parts.coda);
  if (!recoveredSurface) return false;
  return (
    isAllowedNameSyllable(recoveredSurface) ||
    hasGivenSyllableEvidence(recoveredSurface) ||
    hasHanjaGivenSupport(recoveredSurface)
  );
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
  const recoveryPool = withoutBlockedComplexCoda.length ? withoutBlockedComplexCoda : deduped;
  const rankedWholeGivenPool = recoveryPool.filter((candidate) => hasSupportedWholeGivenName(candidate.units));
  const allowedPool = recoveryPool.filter(
    (candidate) => candidate.units.every((syllable) => isAllowedNameSyllable(syllable)),
  );
  if (rankedWholeGivenPool.length) {
    return dedupeCandidateUnits(rankedWholeGivenPool.concat(allowedPool), 24);
  }
  return allowedPool.length ? allowedPool : recoveryPool;
}

function recoverRomanDuumGivenCandidates(candidates) {
  const recovered = [...(candidates || [])];
  for (const candidate of candidates || []) {
    const units = candidate.units || [];
    const chunks = candidate.chunks || [];
      for (let index = 0; index < Math.min(units.length, chunks.length); index += 1) {
        const chunk = chunks[index] || "";
        if (!/^[rl]y(?:a|e|o|u|i)/.test(chunk)) continue;
        const current = decomposeHangulSyllable(units[index]);
        if (!current || !DUUM_RECOVERY_VOWELS.has(current.vowel)) continue;

      if (current.onset === "ㅇ") {
        const restored = composeHangulSyllable("ㄹ", current.vowel, current.coda);
        if (!restored || !isPlausibleRecoveredDuumSyllable(restored)) continue;
        const nextUnits = units.slice();
        nextUnits[index] = restored;
        recovered.push({
          units: nextUnits,
          chunks: chunks.slice(),
          score: Number(candidate.score) + 260,
          recoveredRomanDuum: true,
        });
        continue;
      }

      if (current.onset === "ㄹ" && isPlausibleRecoveredDuumSyllable(units[index])) {
        recovered.push({
          units: units.slice(),
          chunks: chunks.slice(),
          score: Number(candidate.score) + 180,
          recoveredRomanDuum: true,
        });
      }
    }
  }
  return dedupeCandidateUnits(recovered, 24);
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
  if (text.endsWith("k") || text.endsWith("g") || text.endsWith("c")) return "k";
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
  if (normCoda === "k") return keyCoda === "k";
  return keyCoda === normCoda;
}

function collapsedVowelSignature(text) {
  return (text.match(/[aeiouy]+/g) || []).join("").replace(/([aeiouy])\1+/g, "$1");
}

function normalizedVowelChunks(text) {
  return (normalizeLatin(text).match(/[aeiouy]+/g) || []).map((chunk) => {
    if (chunk === "ou") return "oo";
    return chunk;
  });
}

function preservesCoreVowels(norm, key) {
  const normChunks = normalizedVowelChunks(norm);
  const keyChunks = normalizedVowelChunks(key);
  if (!normChunks.length || !keyChunks.length) return true;
  if (normChunks.length !== keyChunks.length) return false;
  return normChunks.every((chunk, index) => chunk === keyChunks[index]);
}

function hasOddInitialHCluster(text) {
  return /^(?:nh|rh|lh|mh|bh|dh|gh|zh)/.test(text);
}

function buildObservedGivenRomanIndex(data) {
  const surnameByHangul = new Map((data.surnames || []).map((item) => [item.hangul, item]));
  const index = new Map();

  for (const row of data.fullNames || []) {
    const surnameData = surnameByHangul.get(row.surname);
    const surnameVariants = new Set(
      ((surnameData?.latin || []).map((item) => normalizeLatin(item.text)).filter(Boolean)).concat(normalizeLatin(row.surname)),
    );

    for (const item of row.romanizations || []) {
      const groups = splitRomanGroups(item.text);
      if (groups.length < 2) continue;

      const firstGroup = groups[0].join("");
      const lastGroup = groups[groups.length - 1].join("");
      let givenToken = "";

      if (surnameVariants.has(firstGroup)) {
        givenToken = groups.slice(1).flat().join("");
      } else if (surnameVariants.has(lastGroup)) {
        givenToken = groups.slice(0, -1).flat().join("");
      }

      if (!givenToken) continue;
      const bucket = index.get(givenToken) || new Map();
      bucket.set(row.given, Math.max(Number(item.score || 0) + Number(row.weight || 0), bucket.get(row.given) || 0));
      index.set(givenToken, bucket);
    }
  }

  return index;
}

function buildKnownGivenRomanIndex(data) {
  const index = buildObservedGivenRomanIndex(data);

  for (const [given, meta] of Object.entries(data.givenNames || {})) {
    const units = Array.from(given);
    if (!units.length || units.length > 3) continue;

    let combos = [{ text: "", score: 0 }];
    let viable = true;
    for (const [syllableIndex, syllable] of units.entries()) {
      const syllableData = data.syllables?.[syllable];
      let variants = (syllableData?.latin || [])
        .map((item) => ({
          text: normalizeLatin(item.text),
          score: givenRomanContextScore(syllable, item.text, item.score),
        }))
        .filter((item) => item.text)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      if (syllable === "이" && syllableIndex > 0) {
        const filtered = variants.filter((item) => item.text !== "lee");
        if (filtered.length) variants = filtered;
      }

      if (!variants.length) {
        viable = false;
        break;
      }

      const next = [];
      for (const combo of combos) {
        for (const variant of variants) {
          next.push({
            text: `${combo.text}${variant.text}`,
            score: combo.score + variant.score,
          });
        }
      }
      combos = next.sort((a, b) => b.score - a.score).slice(0, 24);
    }

    if (!viable) continue;

    const weightBoost =
      Math.log1p(Number(meta.totalWeight || 0)) * 8 +
      Number(meta.periodsPresentCount || 0) * 10 +
      Math.log1p(Number(meta.datasetCount || 0) + Number(meta.rowOccurrences || 0)) * 12;

    for (const combo of combos) {
      if (!combo.text) continue;
      const bucket = index.get(combo.text) || new Map();
      bucket.set(given, Math.max(combo.score + weightBoost, bucket.get(given) || 0));
      index.set(combo.text, bucket);
    }
  }

  return index;
}

function buildKnownGivenKanaIndex(data) {
  const index = new Map();
  const add = (surface, given, score) => {
    const key = normalizeKana(surface);
    if (!key || !given) return;
    const bucket = index.get(key) || new Map();
    bucket.set(given, Math.max(Number(score) || 0, bucket.get(given) || 0));
    index.set(key, bucket);
  };

  for (const [surface, items] of Object.entries(data.givenNameKanaIndex || {})) {
    for (const item of items || []) {
      add(surface, item.hangul, Number(item.score) || 0);
    }
  }

  for (const [given, meta] of Object.entries(data.givenNames || {})) {
    const units = Array.from(given);
    if (!units.length || units.length > 3) continue;
    const weightBoost =
      Math.log1p(Number(meta.totalWeight || 0)) * 8 +
      Number(meta.periodsPresentCount || 0) * 10 +
      Math.log1p(Number(meta.datasetCount || 0) + Number(meta.rowOccurrences || 0)) * 12;
    for (const item of generateGivenKanaOutputs(given)) {
      add(item.text, given, Number(item.score || 0) + weightBoost);
    }
  }

  return index;
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

  const fullNameRowsByGiven = new Map();
  const fullNameRowsBySurname = new Map();
  for (const row of data.fullNames || []) {
    const givenList = fullNameRowsByGiven.get(row.given) || [];
    givenList.push(row);
    fullNameRowsByGiven.set(row.given, givenList);
    const surnameList = fullNameRowsBySurname.get(row.surname) || [];
    surnameList.push(row);
    fullNameRowsBySurname.set(row.surname, surnameList);
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
    givenRomanIndex: buildKnownGivenRomanIndex(data),
    givenKanaIndex: buildKnownGivenKanaIndex(data),
    fullNameRowsByGiven,
    fullNameRowsBySurname,
  };
}

function addCandidate(candidateMap, hangul, score, evidence, meta = {}) {
  if (!hangul) return;
  const kind = meta.kind || "full";
  const key = candidateKey(hangul, kind);
  const current = candidateMap.get(key) || { hangul, kind, score: -Infinity, evidence: new Set(), exactIds: new Set() };
  current.score = Math.max(current.score, score);
  if (evidence) current.evidence.add(evidence);
  candidateMap.set(key, current);
}

function addExactNameCandidates(query, candidateMap) {
  const { data } = state;
  const hangul = extractHangul(query);
  if (hangul && data.fullNameExactHangul[hangul]) {
    for (const index of data.fullNameExactHangul[hangul]) {
      const row = data.fullNames[index];
      addCandidate(candidateMap, row.hangul, 48 + row.weight, "Exact Hangul name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(index);
    }
  }

  const hanja = extractHanja(query);
  if (hanja && data.fullNameExactHanja[hanja]) {
    for (const index of data.fullNameExactHanja[hanja]) {
      const row = data.fullNames[index];
      addCandidate(candidateMap, row.hangul, 45 + row.weight, "Exact Hanja name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(index);
    }
  }

  const latin = normalizeLatin(query);
  if (latin && data.supplementalRomanIndex?.[latin]) {
    for (const item of data.supplementalRomanIndex[latin]) {
      addCandidate(
        candidateMap,
        item.hangul,
        24 + Math.log1p(Number(item.score) || 0) * 8,
        "Supplemental attested Roman query match",
      );
    }
  }
  if (latin && data.fullNameRomanIndex[latin]) {
    for (const item of data.fullNameRomanIndex[latin]) {
      const row = data.fullNames[item.index];
      addCandidate(candidateMap, row.hangul, 24 + Number(item.score) + row.weight, "Exact Romanized name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(item.index);
    }
  }

  const kana = normalizeKana(query);
  if (kana && data.fullNameKanaIndex[kana]) {
    for (const item of data.fullNameKanaIndex[kana]) {
      const row = data.fullNames[item.index];
      addCandidate(candidateMap, row.hangul, 24 + Number(item.score) + row.weight, "Exact kana name match");
      candidateMap.get(candidateKey(row.hangul, "full")).exactIds.add(item.index);
    }
  }
}

function surnameLatinShapeAllowed(token, hangul) {
  const surname = state.runtime?.surnameByHangul?.get(hangul);
  if (!surname?.latin?.length) return true;
  const norm = normalizeLatin(token);
  if (!norm) return true;

  const aliases = surname.latin
    .map((item) => ({
      norm: normalizeLatin(item.text),
      score: Number(item.score) || 0,
    }))
    .filter((item) => item.norm);
  if (!aliases.length) return true;
  if (aliases.some((item) => item.norm === norm)) return true;

  const bestAlias = aliases.reduce((best, item) => (item.score > best.score ? item : best), aliases[0]);
  if (preservesCoreVowels(norm, bestAlias.norm) && preservesTrailingCoda(norm, bestAlias.norm)) {
    return true;
  }

  return aliases.some(
    (item) =>
      item.score >= bestAlias.score * 0.75 &&
      preservesCoreVowels(norm, item.norm) &&
      preservesTrailingCoda(norm, item.norm),
  );
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
        if (!surnameLatinShapeAllowed(variant.token, item.hangul)) continue;
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
        if (!preservesCoreVowels(variant.token, key)) return false;
        if (variant.token.length >= 5 && consonantSignature(key) !== consonantSignature(variant.token)) return false;
        return true;
      })
      .flatMap((key) =>
        data.surnameLatinIndex[key]
          .filter((item) => surnameLatinShapeAllowed(variant.token, item.hangul))
          .map((item) => ({ hangul: item.hangul, score: Number(item.score) * 0.78 - variant.penalty })),
      );
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

  for (let index = 0; index < Math.min(chunks.length, units.length); index += 1) {
    const chunk = chunks[index] || "";
    const syllable = units[index];
    const parts = decomposeHangulSyllable(syllable);
    if (!parts) continue;
    if (/^[rl]y(?:e|u|o|a)/.test(chunk)) {
      if (isPlausibleRecoveredDuumSyllable(syllable)) {
        adjustment += 920;
      } else if (parts.onset === "ㅇ") {
        adjustment -= 180;
      }
    }
  }

  return adjustment;
}

function romanChunkFitValue(chunk, syllable) {
  const key = normalizeLatin(chunk);
  if (!key || !syllable) return null;
  const matches = state.data?.syllableLatinIndex?.[key] || [];
  const contextualMatches = contextualGivenRomanCandidates(matches, key);
  const matched = contextualMatches.find((item) => item.hangul === syllable);
  if (!matched) return null;

  const score = Number(matched.score || 0);
  const topScore = Math.max(...contextualMatches.map((item) => Number(item.score || 0)), score);
  let value = 0;
  if (score >= 250) value += 1200;
  else if (score >= 80) value += 850;
  else if (score >= 20) value += 360;
  else if (score >= 8) value += 80;
  else value -= 220;

  if (topScore > score * 2.5) value -= 520;
  else if (topScore > score * 1.5) value -= 180;
  return value;
}

function romanChunksFitAdjustment(chunks, units) {
  if (!chunks?.length || !units?.length || chunks.length !== units.length) return null;
  let adjustment = 0;
  for (let index = 0; index < units.length; index += 1) {
    const value = romanChunkFitValue(chunks[index], units[index]);
    if (value == null) return null;
    adjustment += value;
  }
  return adjustment;
}

function bestJoinedRomanFitAdjustment(surface, units) {
  const target = normalizeLatin(surface);
  if (!target || !units?.length) return null;
  const memo = new Map();

  function dfs(unitIndex, position) {
    const key = `${unitIndex}:${position}`;
    if (memo.has(key)) return memo.get(key);
    if (unitIndex === units.length) return position === target.length ? 0 : null;

    const syllable = units[unitIndex];
    const variants = (state.data?.syllables?.[syllable]?.latin || [])
      .map((item) => normalizeLatin(item.text))
      .filter(Boolean);
    let best = null;
    for (const variant of variants) {
      if (!target.startsWith(variant, position)) continue;
      const value = romanChunkFitValue(variant, syllable);
      if (value == null) continue;
      const tail = dfs(unitIndex + 1, position + variant.length);
      if (tail == null) continue;
      const candidate = value + tail;
      best = best == null ? candidate : Math.max(best, candidate);
    }
    memo.set(key, best);
    return best;
  }

  return dfs(0, 0);
}

function romanGivenChunkFitAdjustment(candidate) {
  const units = candidate?.units || [];
  const chunks = (candidate?.chunks || []).map((chunk) => normalizeLatin(chunk)).filter(Boolean);
  if (!units.length || !chunks.length) return 0;

  const direct = romanChunksFitAdjustment(chunks, units);
  if (direct != null) return direct;

  if (chunks.length === 1 && units.length > 1) {
    const joined = bestJoinedRomanFitAdjustment(chunks[0], units);
    if (joined != null) return joined;
  }

  return 0;
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
      const forced = forcedRomanHangulCandidates(chunk);
      const exactSource = forced || contextualGivenRomanCandidates(data.syllableLatinIndex[chunk] || [], chunk);
      const exact = pruneWeakExactSyllableMatches(exactSource, chunk);
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

function parseKanaReverseNieunLiaison(norm, maxUnits = 3) {
  const text = normalizeKana(norm);
  if (!text || maxUnits < 2) return [];
  const results = [];

  for (let split = 1; split < text.length; split += 1) {
    const leftSurface = text.slice(0, split);
    const rightSurface = text.slice(split);
    const restoredRightSurfaces = reverseNieunLiaisonSurfaces(rightSurface);
    if (!restoredRightSurfaces.length) continue;

    const restoredLeftCandidates = lookupKanaChunkCandidates(`${leftSurface}ン`).filter((item) => {
      const parts = decomposeHangulSyllable(item.hangul);
      return parts?.coda === "ㄴ";
    });
    if (!restoredLeftCandidates.length) continue;

    for (const leftCandidate of restoredLeftCandidates.slice(0, 8)) {
      for (const restoredRightSurface of restoredRightSurfaces) {
        for (const tailCandidate of parseSyllablesKana(restoredRightSurface, maxUnits - 1).slice(0, 12)) {
          const units = [leftCandidate.hangul, ...(tailCandidate.units || [])];
          if (units.length < 2 || units.length > maxUnits) continue;
          results.push({
            units,
            score: Number(leftCandidate.score || 0) + Number(tailCandidate.score || 0) * 0.92 + 36,
          });
        }
      }
    }
  }

  return filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(results, 24));
}

function parseGivenLatinTokens(tokens) {
  if (!tokens.length) return [];
  if (tokens.length === 1) {
    const results = [];
    const observed = state.runtime?.givenRomanIndex?.get(normalizeLatin(tokens[0]));
    if (observed) {
      for (const [given, score] of observed.entries()) {
        results.push({
          units: Array.from(given),
          score: Number(score) + 220,
          chunks: [normalizeLatin(tokens[0])],
          observedGiven: true,
        });
      }
    }
    for (const variant of expandRomanTokenVariants(tokens[0])) {
      for (const candidate of parseSyllablesLatin(variant.token, 3)) {
        const knownWholeGivenBoost =
          candidate.units.length <= 2 && hasSupportedWholeGivenName(candidate.units)
            ? 140 + Math.min(80, givenWholeNamePrior(candidate.units) * 0.18)
            : 0;
        results.push({
          units: candidate.units,
          score:
            candidate.score -
            variant.penalty +
            singleTokenRomanChunkAdjustment(variant.token, candidate.chunks || [], candidate.units) +
            knownWholeGivenBoost,
          chunks: candidate.chunks || [],
        });
      }
    }
    return filterEvidenceBackedGivenCandidates(recoverRomanDuumGivenCandidates(dedupeCandidateUnits(results, 24)));
  }
  const perToken = tokens.map((token) => {
    const candidates = [];
    for (const variant of expandRomanTokenVariants(token)) {
      const forced = forcedRomanHangulCandidates(variant.token);
      const exactSource = forced || contextualGivenRomanCandidates(state.data.syllableLatinIndex[variant.token] || [], variant.token);
      const exact = pruneWeakExactSyllableMatches(exactSource, variant.token);
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
    return filterEvidenceBackedGivenCandidates(recoverRomanDuumGivenCandidates(dedupeCandidateUnits(candidates, 12)));
  });
  if (perToken.some((items) => !items.length)) {
    return recoverRomanDuumGivenCandidates(parseSyllablesLatin(tokens.join(""), 3));
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
  return filterEvidenceBackedGivenCandidates(recoverRomanDuumGivenCandidates(combos));
}

function knownGivenCandidatesFromRomanTokens(tokens) {
  const joined = normalizeLatin((tokens || []).join(""));
  if (!joined) return [];
  const observed = state.runtime?.givenRomanIndex?.get(joined);
  if (!observed) return [];
  return [...observed.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([given, score]) => ({
      units: Array.from(given),
      score: Number(score) + 240,
      chunks: [joined],
      observedGiven: true,
    }));
}

function hasKnownRomanGivenTokens(tokens) {
  const joined = normalizeLatin((tokens || []).join(""));
  return !!joined && !!state.runtime?.givenRomanIndex?.has(joined);
}

function pruneRomanSingleTokenGivenCandidates(candidates) {
  if (!candidates.length) return candidates;
  const topCandidate = candidates[0];
  const topTwoUnit = candidates.find((candidate) => candidate.units.length <= 2);
  const topAllowed = candidates.find((candidate) => isFullyAllowedGivenCandidate(candidate));
  const topCompactSinoLike = candidates.find(
    (candidate) => candidate.units.length <= 2 && isSinoLikeRomanGivenCandidate(candidate),
  );
  const topCompactSinoBacked = candidates.find(
    (candidate) => candidate.units.length <= 2 && isSinoBackedGivenCandidate(candidate),
  );
  const topHanjaBackedCompact = candidates.find(
    (candidate) => candidate.units.length <= 2 && candidate.units.every((syllable) => hasHanjaGivenSupport(syllable)),
  );
  if (!topTwoUnit) return candidates;
  return candidates.filter((candidate) => {
    const hasRankedWholeGivenName = hasSupportedWholeGivenName(candidate.units);
    if (
      topCompactSinoLike &&
      !hasRankedWholeGivenName &&
      candidate.units.some((syllable) => !isSinoLikeGivenSyllable(syllable))
    ) {
      return false;
    }
    if (
      topCompactSinoBacked &&
      !hasRankedWholeGivenName &&
      !isSinoBackedGivenCandidate(candidate) &&
      topCompactSinoBacked.score >= candidate.score * 0.6
    ) {
      return false;
    }
    if (topAllowed) {
      if (!isFullyAllowedGivenCandidate(candidate) && !hasRankedWholeGivenName) return false;
      const shorterAllowed = candidates.find(
        (other) => isFullyAllowedGivenCandidate(other) && other.units.length < candidate.units.length,
      );
      if (!hasRankedWholeGivenName && shorterAllowed && shorterAllowed.score >= candidate.score * 0.7) return false;
      return hasRankedWholeGivenName || candidate.score >= topAllowed.score * 0.18;
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

function generateRomanDuumWholeGivenCandidates(norm) {
  const text = normalizeLatin(norm);
  if (!text) return [];
  const matches = [];
  for (const [roman, items] of Object.entries(state.data.syllableLatinIndex || {})) {
    if (!/^[rl]y(?:a|e|o|u|i)/.test(roman)) continue;
    const syllables = (items || []).filter((item) => isPlausibleRecoveredDuumSyllable(item.hangul));
    if (!syllables.length) continue;
    let fromIndex = 0;
    while (fromIndex < text.length) {
      const start = text.indexOf(roman, fromIndex);
      if (start < 0) break;
      const end = start + roman.length;
      const prefix = text.slice(0, start);
      const suffix = text.slice(end);
      const prefixCandidates = prefix ? parseSyllablesLatin(prefix, 2) : [{ units: [], score: 0, chunks: [] }];
      const suffixCandidates = suffix ? parseSyllablesLatin(suffix, 2) : [{ units: [], score: 0, chunks: [] }];
      for (const prefixCandidate of prefixCandidates.slice(0, 8)) {
        for (const syllable of syllables.slice(0, 4)) {
          for (const suffixCandidate of suffixCandidates.slice(0, 8)) {
            const units = [...(prefixCandidate.units || []), syllable.hangul, ...(suffixCandidate.units || [])];
            if (!units.length || units.length > 3) continue;
            const explicitLateralCueBoost =
              start > 0 && units.length <= 2
                ? 680
                : start > 0
                  ? 420
                  : 180;
            matches.push({
              units,
              chunks: [...(prefixCandidate.chunks || []), roman, ...(suffixCandidate.chunks || [])],
              score:
                Number(prefixCandidate.score || 0) +
                Number(syllable.score || 0) +
                Number(suffixCandidate.score || 0) +
                320 +
                explicitLateralCueBoost,
              recoveredRomanDuum: true,
            });
          }
        }
      }
      fromIndex = start + 1;
    }
  }
  return dedupeCandidateUnits(matches, 24);
}

function parseGivenKanaTokens(tokens) {
  if (!tokens.length) return [];
  const joined = normalizeKana(tokens.join(""));
  const exactGivenIndex = state.runtime?.givenKanaIndex?.get(joined);
  const exactGiven = exactGivenIndex
    ? [...exactGivenIndex.entries()].map(([hangul, score]) => ({
      units: Array.from(hangul),
      score: Number(score) + 180,
    }))
    : [];
  if (exactGiven.length) {
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(exactGiven, 24)));
  }
  if (tokens.length === 1) {
    const parsed = parseSyllablesKana(tokens[0], 3).concat(parseKanaReverseNieunLiaison(tokens[0], 3));
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(parsed, 24)));
  }
  const perToken = tokens.map((token) => lookupKanaChunkCandidates(token).map((item) => ({
    units: [item.hangul],
    score: Number(item.score),
  })));
  if (perToken.some((items) => !items.length)) {
    const joinedParsed = parseSyllablesKana(tokens.join(""), 3).concat(parseKanaReverseNieunLiaison(tokens.join(""), 3));
    return pruneKanaSingleTokenGivenCandidates(recoverPronouncedSinoGivenCandidates(dedupeCandidateUnits(joinedParsed, 24)));
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

function kanaJoinedSurnameBoundaryAdjustment(sourceKana, surnameVariant, surnameHangul, givenUnits = []) {
  const normVariant = normalizeKana(surnameVariant);
  const remainder = sourceKana.slice(normVariant.length);
  const carrier = remainder[0] || "";
  const expectedCodas = KANA_CODA_CARRIER_MAP.get(carrier);
  if (!expectedCodas) return 0;

  const surnameLast = Array.from(surnameHangul || "").at(-1);
  const surnameParts = decomposeHangulSyllable(surnameLast);
  if (!surnameParts) return 0;

  const totalLength = (surnameHangul || "").length + (givenUnits || []).length;
  if (expectedCodas.has(surnameParts.coda)) {
    return totalLength <= 3 ? 360 : 180;
  }
  if (!surnameParts.coda && totalLength > 3) {
    return -1500;
  }
  if (totalLength > 3) {
    return -900;
  }
  return -120;
}

function parseGivenHanja(text) {
  const norm = extractHanja(text);
  if (!norm) return [];
  let combos = [{ units: [], score: 0 }];
  for (const char of Array.from(norm)) {
    const items = hanjaGivenReadingCandidates(char);
    if (!items.length) return [];
    const next = [];
    for (const combo of combos) {
      for (const item of items.slice(0, 6)) {
        next.push({ units: combo.units.concat(item.hangul), score: combo.score + Number(item.score) });
      }
    }
    combos = next.sort((a, b) => b.score - a.score).slice(0, 30);
  }
  return filterEvidenceBackedGivenCandidates(dedupeCandidateUnits(combos, 30));
}

function hanjaFallbackReadingScore(hangul) {
  const syllable = state.data?.syllables?.[hangul];
  if (!syllable) return 0.8;
  let score = 1.1;
  if (syllable.sinoAllowed) score += 1.4;
  if (Number(syllable.hanjaGivenCount || 0) > 0) score += Math.min(3.2, Math.log1p(Number(syllable.hanjaGivenCount || 0)) * 1.15);
  score += Math.min(2.2, Math.log1p(Number(syllable.givenCount || 0) + Number(syllable.nameCount || 0)) * 0.28);
  score += Math.min(2.4, Math.log1p(Number(syllable.decadeWeight || 0)) * 0.18);
  return score;
}

function hanjaGivenReadingCandidates(char) {
  const results = [];
  for (const item of state.data?.hanjaGivenIndex?.[char] || []) {
    results.push({ hangul: item.hangul, score: Number(item.score || 0) + 4 });
  }
  for (const hangul of state.data?.hanjaReadingIndex?.[char] || []) {
    if (!hangul || !state.data?.syllables?.[hangul]) continue;
    results.push({ hangul, score: hanjaFallbackReadingScore(hangul) });
  }
  return dedupeScoredByField(results, "hangul", "score", 8);
}

function parseJoinedRomanGivenToken(token) {
  const joined = normalizeLatin(token);
  if (!joined) return [];
  const knownCandidates = knownGivenCandidatesFromRomanTokens([joined]);
  const parsedCandidates = parseGivenLatinTokens([joined]);
  return dedupeCandidateUnits(knownCandidates.concat(parsedCandidates), 24);
}

function hasNonLatinScript(groups) {
  return groups.some((group) => group.type !== "latin");
}

function addLatinFullNameHypotheses(hypotheses, candidateMap) {
  for (const hypothesis of hypotheses) {
    let surnameCandidates = findSurnameCandidatesFromLatin(hypothesis.surnameToken);
    if (hypothesis.requireCompoundSurname) {
      surnameCandidates = surnameCandidates.filter((item) => (item.hangul || "").length === 2 && state.runtime.compoundSurnames.has(item.hangul));
    }
    if (!surnameCandidates.length || !hypothesis.givenTokens.length) continue;
    let givenCandidates = knownGivenCandidatesFromRomanTokens(hypothesis.givenTokens);
    const parsedGivenCandidates = parseGivenLatinTokens(hypothesis.givenTokens);
    givenCandidates = dedupeCandidateUnits(givenCandidates.concat(parsedGivenCandidates), 24);
    if (hypothesis.givenTokens.length === 1) {
      givenCandidates = pruneRomanSingleTokenGivenCandidates(givenCandidates);
    }
    combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, hypothesis.boost, hypothesis.label);
  }
}

function searchHangul(query, candidateMap) {
  const hangul = extractHangul(query);
  if (!hangul || hangul.length < 2) return;
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const givenUnits = Array.from(given);
  if (!state.runtime.surnameByHangul.has(surname) || !isNameLikeGivenUnits(givenUnits)) return;
  let score = 20;
  const surnameData = state.runtime.surnameByHangul.get(surname);
  if (surnameData) score += Math.log1p(Number(surnameData.population || 0));
  for (const syllable of givenUnits) {
    const syllableData = state.data.syllables[syllable];
    if (syllableData) {
      score += Math.log1p(Number(syllableData.givenCount || 0) + Number(syllableData.nameCount || 0));
    }
  }
  addCandidate(candidateMap, hangul, score, "Name-like Hangul parse");
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
    const firstGroupToken = groups[0].join("");
    const lastGroupToken = groups[groups.length - 1].join("");
    const firstLeeCue = isLeeSurnameCue(firstGroupToken);
    const lastLeeCue = isLeeSurnameCue(lastGroupToken);
    const surnameFirstGivenTokens = groups.slice(1).flat();
    const knownSurnameFirstGivenWithLee =
      lastLeeCue &&
      !firstLeeCue &&
      surnameFirstGivenTokens.length >= 2 &&
      hasKnownRomanGivenTokens(surnameFirstGivenTokens);
    const hypotheses = [];
    if (!lastLeeCue || firstLeeCue || knownSurnameFirstGivenWithLee) {
      hypotheses.push({
        surnameToken: firstGroupToken,
        givenTokens: surnameFirstGivenTokens,
        boost: firstLeeCue ? 1.2 : lastLeeCue ? 0.72 : 1.0,
        label: knownSurnameFirstGivenWithLee ? "Latin surname-first parse with ranked Lee-final given name" : "Latin surname-first parse",
      });
    }
    if ((!firstLeeCue || lastLeeCue) && groups[groups.length - 1].length === 1) {
      hypotheses.push({
        surnameToken: groups[groups.length - 1][0],
        givenTokens: groups.slice(0, -1).flat(),
        boost: lastLeeCue ? 1.24 : firstLeeCue ? 0.42 : 0.84,
        label: "Latin surname-last parse",
      });
    }
    if (!lastLeeCue && groups.length >= 3 && groups[0].length === 1 && groups[1].length === 1) {
      hypotheses.push({
        surnameToken: `${groups[0][0]}${groups[1][0]}`,
        givenTokens: groups.slice(2).flat(),
        boost: 1.06,
        label: "Latin compound-surname parse",
        requireCompoundSurname: true,
      });
    }
    if (!firstLeeCue && groups.length >= 3 && groups[groups.length - 2].length === 1 && groups[groups.length - 1].length === 1) {
      hypotheses.push({
        surnameToken: `${groups[groups.length - 2][0]}${groups[groups.length - 1][0]}`,
        givenTokens: groups.slice(0, -2).flat(),
        boost: 0.88,
        label: "Latin compound-surname-last parse",
        requireCompoundSurname: true,
      });
    }
    addLatinFullNameHypotheses(hypotheses, candidateMap);
  } else if (groups.length === 1 && tokens.length >= 2 && hasRomanHyphenBoundary(query)) {
    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];
    const firstLeeCue = isLeeSurnameCue(firstToken);
    const lastLeeCue = isLeeSurnameCue(lastToken);
    const hypotheses = [];

    if (!lastLeeCue || firstLeeCue) {
      hypotheses.push({
        surnameToken: firstToken,
        givenTokens: tokens.slice(1),
        boost: firstLeeCue ? 1.08 : lastLeeCue ? 0.48 : 0.78,
        label: "Latin hyphenated surname-first parse",
      });
    }
    if (!firstLeeCue || lastLeeCue) {
      hypotheses.push({
        surnameToken: lastToken,
        givenTokens: tokens.slice(0, -1),
        boost: lastLeeCue ? 1.16 : firstLeeCue ? 0.38 : 0.86,
        label: "Latin hyphenated surname-last parse",
      });
    }
    if (!lastLeeCue && tokens.length >= 3) {
      hypotheses.push({
        surnameToken: `${tokens[0]}${tokens[1]}`,
        givenTokens: tokens.slice(2),
        boost: 0.96,
        label: "Latin hyphenated compound-surname parse",
        requireCompoundSurname: true,
      });
    }
    if (!firstLeeCue && tokens.length >= 3) {
      hypotheses.push({
        surnameToken: `${tokens[tokens.length - 2]}${tokens[tokens.length - 1]}`,
        givenTokens: tokens.slice(0, -2),
        boost: 0.82,
        label: "Latin hyphenated compound-surname-last parse",
        requireCompoundSurname: true,
      });
    }
    addLatinFullNameHypotheses(hypotheses, candidateMap);
  }

  if (tokens.length <= 1) {
    for (const [variant, surnameCandidates] of Object.entries(state.data.surnameLatinIndex)) {
      if (latin.startsWith(variant) && latin.length !== variant.length) {
        const givenCandidates = parseJoinedRomanGivenToken(latin.slice(variant.length));
        combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, 0.96, "Latin joined-string parse");
      }
      if (latin.endsWith(variant) && latin.length !== variant.length) {
        const givenCandidates = parseJoinedRomanGivenToken(latin.slice(0, -variant.length));
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
    for (const surnameCandidate of surnameCandidates.slice(0, 10)) {
      for (const givenCandidate of givenCandidates.slice(0, 24)) {
        if (!isNameLikeGivenUnits(givenCandidate.units)) continue;
        const givenPrior = givenUnitsNamePrior(givenCandidate.units);
        const boundaryAdjustment = kanaJoinedSurnameBoundaryAdjustment(kana, variant, surnameCandidate.hangul, givenCandidate.units);
        const hangul = `${surnameCandidate.hangul}${givenCandidate.units.join("")}`;
        const score = (Number(surnameCandidate.score) + Number(givenCandidate.score)) * 0.96 + givenPrior + boundaryAdjustment;
        addCandidate(candidateMap, hangul, score, "Kana joined-string parse");
      }
    }
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

function addStandaloneSurnameCandidates(candidateMap, surnameCandidates, evidence, boost = 180) {
  for (const candidate of surnameCandidates.slice(0, 10)) {
    const surnameData = state.runtime?.surnameByHangul?.get(candidate.hangul);
    const score = Number(candidate.score) + boost + Math.log1p(Number(surnameData?.population || 0)) * 8;
    addCandidate(candidateMap, candidate.hangul, score, evidence, { kind: "surname" });
  }
}

function addStandaloneGivenCandidates(candidateMap, givenCandidates, evidence, boost = 180) {
  for (const candidate of givenCandidates.slice(0, 24)) {
    if (!candidate?.units?.length) continue;
    if (!isNameLikeGivenUnits(candidate.units)) continue;
    const hangul = candidate.units.join("");
    const score =
      Number(candidate.score) +
      boost +
      givenUnitsNamePrior(candidate.units) +
      romanGivenChunkFitAdjustment(candidate);
    addCandidate(candidateMap, hangul, score, evidence, { kind: "given" });
  }
}

function searchStandaloneHangul(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (groups.length !== 1 || groups[0].type !== "hangul") return;
  const hangul = extractHangul(query);
  if (!hangul) return;

  const surnameCandidates = findSurnameCandidatesFromHangul(hangul).filter((item) => item.hangul === hangul);
  if (surnameCandidates.length) {
    addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Hangul surname search", 220);
  }

  const wholeGivenCandidates = [];
  if (state.data.givenNames?.[hangul]) {
    wholeGivenCandidates.push({
      units: Array.from(hangul),
      score: givenWholeNamePrior(Array.from(hangul)) + 120,
    });
  } else if (hangul.length <= 3 && Array.from(hangul).every((syllable) => hasGivenSyllableEvidence(syllable))) {
    wholeGivenCandidates.push({
      units: Array.from(hangul),
      score: givenUnitsNamePrior(Array.from(hangul)),
    });
  }
  if (wholeGivenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, wholeGivenCandidates, "Standalone Hangul given-name search", 220);
  }
}

function searchStandaloneLatin(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (!groups.length || groups.some((group) => group.type !== "latin")) return;
  const romanGroups = splitRomanGroups(query);
  const tokens = romanGroups.flat();
  if (!tokens.length) return;

  const joined = tokens.join("");
  if (tokens.length <= 2) {
    const surnameCandidates = findSurnameCandidatesFromLatin(joined);
    if (surnameCandidates.length) {
      addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Roman surname search", 220);
    }
  }

  let givenCandidates = knownGivenCandidatesFromRomanTokens(tokens);
  const parsedGivenCandidates = parseGivenLatinTokens(tokens);
  const romanDuumCandidates = tokens.length === 1 ? generateRomanDuumWholeGivenCandidates(tokens[0]) : [];
  if (romanDuumCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, romanDuumCandidates, "Standalone Roman duum given-name search", 260);
  }
  givenCandidates = dedupeCandidateUnits(givenCandidates.concat(parsedGivenCandidates, romanDuumCandidates), 24);
  if (tokens.length === 1) {
    givenCandidates = pruneRomanSingleTokenGivenCandidates(givenCandidates);
  }
  if (givenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, givenCandidates, "Standalone Roman given-name search", 220);
  }
}

function searchStandaloneKana(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (!groups.length || groups.some((group) => group.type !== "kana")) return;
  const tokens = splitKanaTokens(query);
  if (!tokens.length) return;

  if (tokens.length <= 2) {
    const surnameCandidates = findSurnameCandidatesFromKana(tokens.join(""));
    if (surnameCandidates.length) {
      addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Kana surname search", 210);
    }
  }

  const givenCandidates = parseGivenKanaTokens(tokens);
  if (givenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, givenCandidates, "Standalone Kana given-name search", 210);
  }
}

function searchStandaloneHanja(query, candidateMap) {
  const groups = tokenizeByScript(query);
  if (groups.length !== 1 || groups[0].type !== "hanja") return;
  const hanja = extractHanja(query);
  if (!hanja) return;

  const surnameCandidates = findSurnameCandidatesFromHanja(hanja);
  if (surnameCandidates.length) {
    addStandaloneSurnameCandidates(candidateMap, surnameCandidates, "Standalone Hanja surname search", 210);
  }

  const givenCandidates = parseGivenHanja(hanja);
  if (givenCandidates.length) {
    addStandaloneGivenCandidates(candidateMap, givenCandidates, "Standalone Hanja given-name search", 210);
  }
}

function combineSurnameAndGivenCandidates(surnameCandidates, givenCandidates, candidateMap, boost, label) {
  for (const surnameCandidate of surnameCandidates.slice(0, 10)) {
    for (const givenCandidate of givenCandidates.slice(0, 24)) {
      if (!isNameLikeGivenUnits(givenCandidate.units)) continue;
      const givenPrior = givenUnitsNamePrior(givenCandidate.units);
      const hangul = `${surnameCandidate.hangul}${givenCandidate.units.join("")}`;
      const score =
        (Number(surnameCandidate.score) + Number(givenCandidate.score)) * boost +
        givenPrior +
        romanGivenChunkFitAdjustment(givenCandidate);
      addCandidate(candidateMap, hangul, score, label);
    }
  }
}

function gatherExactRowsForHangul(hangul, candidate) {
  if (candidate.kind === "given") {
    return state.runtime?.fullNameRowsByGiven?.get(hangul) || [];
  }
  if (candidate.kind === "surname") {
    return state.runtime?.fullNameRowsBySurname?.get(hangul) || [];
  }
  const ids = new Set(candidate.exactIds || []);
  const exact = state.data.fullNameExactHangul[hangul] || [];
  for (const id of exact) ids.add(id);
  return [...ids].map((id) => state.data.fullNames[id]);
}

function generateGivenRomanOutputs(hangul) {
  const givenUnits = Array.from(hangul);
  const counter = new Map();
  const add = (text, score) => {
    if (!text) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };

  let givenCombos = [{ text: "", score: 0, parts: [] }];
  for (const [syllableIndex, syllable] of givenUnits.entries()) {
    const syllableData = state.data.syllables[syllable];
    let variants = modernGivenRomanVariantsForOutput(syllable, syllableData?.latin || [{ text: syllable, score: 1 }]).slice(0, 4);
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

  for (const givenCombo of givenCombos) {
    if (!givenCombo.parts.length) continue;
    add(givenCombo.parts.join(" "), givenCombo.score * 0.74);
    add(givenCombo.parts.join("-"), givenCombo.score);
    add(givenCombo.text, givenCombo.score * 0.9);
  }

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function generateSurnameRomanOutputs(hangul) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  return (surnameData?.latin || [])
    .slice(0, 8)
    .map((item) => ({ text: item.text, score: Number(item.score) || 0 }));
}

function generateGivenKanaOutputs(hangul) {
  const givenUnits = Array.from(hangul);
  const counter = new Map();
  const add = (text, score) => {
    if (!text) return;
    if (isBlockedJapaneseKanaSurface(text)) return;
    counter.set(text, Math.max(score, counter.get(text) || 0));
  };
  const givenCombos = buildKanaGivenCombosForUnits(givenUnits);
  for (const combo of givenCombos) {
    const normalizedParts = normalizeKanaPartsForJoin(combo.parts || [], givenUnits);
    for (const surface of generateLiaisonKanaVariants(normalizedParts, givenUnits)) {
      add(surface.text, combo.score * surface.scoreScale);
    }
    for (const voicedSurface of generateVoicedGiyeokKanaVariants(normalizedParts, givenUnits)) {
      add(voicedSurface.parts.join(""), combo.score * voicedSurface.scoreScale);
    }
  }
  for (const pronouncedSurface of generatePronouncedGivenSurfaceVariants(givenUnits)) {
    const pronouncedCombos = buildKanaGivenCombosForUnits(pronouncedSurface.units);
    for (const combo of pronouncedCombos) {
      const normalizedParts = normalizeKanaPartsForJoin(combo.parts || [], pronouncedSurface.units);
      for (const surface of generateLiaisonKanaVariants(normalizedParts, pronouncedSurface.units)) {
        add(surface.text, combo.score * surface.scoreScale * pronouncedSurface.scoreScale);
      }
    }
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([text, score]) => ({ text, score }));
}

function generateSurnameKanaOutputs(hangul) {
  const surnameData = state.runtime?.surnameByHangul?.get(hangul);
  return (surnameData?.kana || [])
    .slice(0, 8)
    .map((item) => ({ text: item.text, score: Number(item.score) || 0 }));
}

function generateOutputsForCandidate(candidate, exactRows) {
  if (candidate.kind === "surname") {
    return {
      romanOutputs: generateSurnameRomanOutputs(candidate.hangul),
      kanaOutputs: generateSurnameKanaOutputs(candidate.hangul),
      hanjaOutputs: hanjaOutputsForCandidate(candidate.hangul, exactRows),
    };
  }
  if (candidate.kind === "given") {
    return {
      romanOutputs: generateGivenRomanOutputs(candidate.hangul),
      kanaOutputs: generateGivenKanaOutputs(candidate.hangul),
      hanjaOutputs: [],
    };
  }
  return {
    romanOutputs: generateRomanOutputs(candidate.hangul, exactRows),
    kanaOutputs: generateKanaOutputs(candidate.hangul, exactRows),
    hanjaOutputs: hanjaOutputsForCandidate(candidate.hangul, exactRows),
  };
}

function candidateSubtitle(candidate, exactRows) {
  if (candidate.kind === "surname") {
    const surnameData = state.runtime?.surnameByHangul?.get(candidate.hangul);
    return `Surname match · population ${Number(surnameData?.population || 0).toLocaleString()} · ${exactRows.length} supporting dataset row(s)`;
  }
  if (candidate.kind === "given") {
    return `${candidate.hangul.length}-syllable given name · ${exactRows.length ? `${exactRows.length} supporting dataset row(s)` : "generated from given-name evidence"}`;
  }
  const { surname, given } = splitNameUnits(candidate.hangul, state.runtime.compoundSurnames);
  return `Surname ${surname} · Given ${given || "—"} · ${exactRows.length ? `${exactRows.length} supporting dataset row(s)` : "synthetic from surname and syllable evidence"}`;
}

function deriveInterpretationText(query, candidateMap) {
  const candidates = [...candidateMap.values()].sort((a, b) => b.score - a.score);
  if (!candidates.length) return `Interpretation: likely neither a surname, given name, nor full name.`;
  const topScore = Number(candidates[0].score) || 0;
  const activeKinds = [...new Set(
    candidates
      .filter((candidate) => Number(candidate.score) >= topScore * 0.7)
      .slice(0, 5)
      .map((candidate) => candidate.kind || "full"),
  )];
  if (!activeKinds.length) {
    return `Interpretation: likely neither a surname, given name, nor full name.`;
  }
  if (activeKinds.length === 1) {
    return `Interpretation: likely ${candidateKindLabel(activeKinds[0])}.`;
  }
  return `Interpretation: ambiguous between ${activeKinds.map(candidateKindLabel).join(", ")}.`;
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
    let variants = modernGivenRomanVariantsForOutput(syllable, syllableData?.latin || [{ text: syllable, score: 1 }]).slice(0, 4);
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
    if (isBlockedJapaneseKanaSurface(text)) return;
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
  const candidates = [...candidateMap.values()].sort((a, b) => candidateRankingScore(b) - candidateRankingScore(a)).slice(0, 16);
  if (!candidates.length) {
    resultsEl.innerHTML = `<div class="empty-state" role="status">No plausible candidates found. Try another spacing style, a different romanization, or a shorter query.</div>`;
    showResultsSection();
    return;
  }

  const candidatePercents = allocatePercentages(candidates, (candidate) => candidateRankingScore(candidate));
  resultsEl.innerHTML = "";
  for (const [index, candidate] of candidates.entries()) {
    const exactRows = gatherExactRowsForHangul(candidate.hangul, candidate);
    const { romanOutputs, kanaOutputs, hanjaOutputs } = generateOutputsForCandidate(candidate, exactRows);
    const plausibility = candidatePercents[index] ?? 0;

    const fragment = resultTemplate.content.cloneNode(true);
    fragment.querySelector(".result-hangul").textContent = candidate.hangul;
    const pronunciationButton = fragment.querySelector(".pronunciation-button");
    const pronunciationLabel = fragment.querySelector(".pronunciation-label");
    if (pronunciationButton && pronunciationLabel) {
      const pronunciationText = candidate.hangul;
      const pronunciationLabelText = `Play Korean pronunciation for ${pronunciationText}`;
      pronunciationButton.dataset.name = pronunciationText;
      pronunciationButton.dataset.state = "idle";
      pronunciationButton.setAttribute("aria-label", pronunciationLabelText);
      pronunciationButton.title = "Play pronunciation";
      pronunciationLabel.textContent = pronunciationLabelText;
      if (supportsAudioPlayback() || supportsSpeechSynthesis()) {
        pronunciationButton.addEventListener("click", () => playKoreanPronunciation(pronunciationText, pronunciationButton));
      } else {
        pronunciationButton.disabled = true;
        pronunciationButton.dataset.state = "unavailable";
        pronunciationButton.title = "Pronunciation unavailable";
      }
    }
    fragment.querySelector(".result-subtitle").textContent = candidateSubtitle(candidate, exactRows);
    fragment.querySelector(".score-value").textContent = `${plausibility}%`;
    fragment.querySelector(".score-bar span").style.width = `${plausibility}%`;

    const romanList = fragment.querySelector(".roman-list");
    const kanaList = fragment.querySelector(".kana-list");
    const hanjaList = fragment.querySelector(".hanja-list");
    fillVariantList(romanList, romanOutputs);
    fillVariantList(kanaList, kanaOutputs);
    fillVariantList(hanjaList, hanjaOutputs, !hanjaOutputs.length ? "No observed Hanja reading in the dataset" : "");

    resultsEl.appendChild(fragment);
  }
  showResultsSection();
}

function pruneImplausibleCandidates(candidateMap) {
  const candidates = [...candidateMap.values()].sort((a, b) => b.score - a.score);
  if (!candidates.length) return candidateMap;
  const bestStandaloneGiven = candidates.find((candidate) => {
    if (candidate.kind !== "given") return false;
    if (isLikelyFullNameMisparsedAsGiven(candidate, candidateMap)) return false;
    const units = candidateGivenUnits(candidate);
    return units.length <= 2 || hasSupportedWholeGivenName(units);
  });
  const bestStandaloneGivenUnits = bestStandaloneGiven ? candidateGivenUnits(bestStandaloneGiven) : [];
  const bestStandaloneGivenWholeSupported = bestStandaloneGiven ? hasSupportedWholeGivenName(bestStandaloneGivenUnits) : false;
  const bestStandaloneCompactGiven =
    bestStandaloneGiven &&
    bestStandaloneGivenWholeSupported &&
    bestStandaloneGivenUnits.length <= 2
      ? bestStandaloneGiven
      : null;

  const bestAllowed = candidates.find((candidate) => {
    if (candidate.kind === "surname") return true;
    return candidateGivenUnits(candidate).every((syllable) => isAllowedNameSyllable(syllable));
  });

  const bestPlausible = candidates.find((candidate) => {
    const units = candidateGivenUnits(candidate);
    if (candidate.kind === "surname") return true;
    return units.length && units.every((syllable) => !isUltraRareGivenSyllable(syllable));
  });
  const plausibilityBaseline = bestPlausible || bestAllowed || candidates[0];
  if (!plausibilityBaseline) return candidateMap;

  const filtered = new Map();
  for (const candidate of candidates) {
    if (isLikelyFullNameMisparsedAsGiven(candidate, candidateMap)) continue;
    const units = candidateGivenUnits(candidate);
    if (
      state.queryMeta?.explicitMedialRomanLateralCue &&
      candidate.kind === "given" &&
      units.length === 2
    ) {
      const secondParts = decomposeHangulSyllable(units[1]);
      if (secondParts && DUUM_RECOVERY_VOWELS.has(secondParts.vowel)) {
        if (secondParts.onset === "ㄹ" && isPlausibleRecoveredDuumSyllable(units[1])) {
          candidate.score += 1800;
        } else if (secondParts.onset === "ㅇ") {
          candidate.score -= 1200;
        }
      }
    }
    const ultraRareCount = units.filter((syllable) => isUltraRareGivenSyllable(syllable)).length;
    const unsupportedCount = units.filter((syllable) => !isAllowedNameSyllable(syllable)).length;
    const unsupportedLongGiven = candidate.kind !== "surname" && units.length >= 3 && !hasSupportedWholeGivenName(units);
    const hasExactEvidence = hasCandidateExactEvidence(candidate);
    if (!hasExactEvidence && !isNameLikeCandidate(candidate)) continue;
    const kanaDerivedOnly = !hasExactEvidence && [...candidate.evidence].some((item) => /Kana/.test(item));
    const singleRomanSyntheticFull =
      state.queryMeta?.isSingleRomanToken &&
      candidate.kind === "full" &&
      !hasExactEvidence &&
      [...candidate.evidence].every((item) => /Latin (joined-string|suffix-surname) parse/.test(item));
    const { surname } = candidate.kind === "full"
      ? splitNameUnits(candidate.hangul, state.runtime?.compoundSurnames)
      : { surname: "" };
    const surnamePopulation = Number(state.runtime?.surnameByHangul?.get(surname)?.population || 0);
    const nonSinoLikeGivenCount = units.filter((syllable) => !isSinoLikeGivenSyllable(syllable)).length;
    if (
      singleRomanSyntheticFull &&
      bestStandaloneCompactGiven &&
      surnamePopulation < 50000 &&
      candidate.score <= bestStandaloneCompactGiven.score * 1.4
    ) {
      continue;
    }
    if (
      singleRomanSyntheticFull &&
      bestStandaloneGiven &&
      bestStandaloneGivenWholeSupported &&
      nonSinoLikeGivenCount > 0
    ) {
      continue;
    }
    if (
      singleRomanSyntheticFull &&
      bestStandaloneGiven &&
      bestStandaloneGivenWholeSupported
    ) {
      const candidateWholeSupported = hasSupportedWholeGivenName(units);
      const unitDelta = Math.max(0, units.length - bestStandaloneGivenUnits.length);
      let singleTokenPenalty = 120 + Math.min(120, givenWholeNamePrior(bestStandaloneGivenUnits) * 0.16);
      if (!candidateWholeSupported) singleTokenPenalty += 140;
      if (nonSinoLikeGivenCount) singleTokenPenalty += 220 * nonSinoLikeGivenCount;
      if (unitDelta) singleTokenPenalty += unitDelta * 90;
      candidate.score -= singleTokenPenalty;
    }
    if (!hasExactEvidence && unsupportedLongGiven) continue;
    if (
      singleRomanSyntheticFull &&
      bestStandaloneGiven &&
      candidate.score < bestStandaloneGiven.score * (nonSinoLikeGivenCount ? 1.35 : 1.12)
    ) {
      continue;
    }
    if (!hasExactEvidence && bestAllowed && unsupportedCount >= 1 && !hasSupportedWholeGivenName(units)) continue;
    if (
      kanaDerivedOnly &&
      unsupportedCount === 0 &&
      ultraRareCount <= 1 &&
      candidate.score >= plausibilityBaseline.score * 0.12
    ) {
      filtered.set(candidateKey(candidate.hangul, candidate.kind), candidate);
      continue;
    }
    if (!hasExactEvidence && ultraRareCount >= 2 && candidate.score < plausibilityBaseline.score * 0.45) continue;
    if (!hasExactEvidence && ultraRareCount >= 1 && candidate.score < plausibilityBaseline.score * 0.28) continue;
    filtered.set(candidateKey(candidate.hangul, candidate.kind), candidate);
  }
  return filtered;
}

function allocatePercentages(items, getWeight = (item) => Number(item.score) || 0) {
  if (!items.length) return [];
  const rawWeights = items.map((item) => Math.max(0, getWeight(item)));
  const total = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const normalized = total > 0 ? rawWeights.map((weight) => (weight / total) * 100) : items.map(() => 100 / items.length);
  const base = normalized.map((value) => Math.floor(value));
  let remainder = 100 - base.reduce((sum, value) => sum + value, 0);
  const rankedRemainders = normalized
    .map((value, index) => ({ index, remainder: value - base[index], weight: rawWeights[index] }))
    .sort((a, b) => b.remainder - a.remainder || b.weight - a.weight || a.index - b.index);
  for (let i = 0; i < rankedRemainders.length && remainder > 0; i += 1) {
    base[rankedRemainders[i].index] += 1;
    remainder -= 1;
  }
  return base;
}

function fillVariantList(listEl, items, emptyText = "No output") {
  listEl.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = emptyText;
    listEl.appendChild(li);
    return;
  }
  const computedPercents = items.some((item) => item.percent != null) ? [] : allocatePercentages(items, (item) => Number(item.score) || 0);
  for (const item of items) {
    const li = document.createElement("li");
    const value = document.createElement("span");
    value.textContent = item.text;
    const score = document.createElement("span");
    score.className = "variant-score";
    const percent = item.percent != null ? item.percent.toFixed(2) : computedPercents.shift();
    score.textContent = ` ${percent}%`;
    li.append(value, score);
    listEl.appendChild(li);
  }
}

function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickRandom(items) {
  if (!items?.length) return null;
  return items[Math.floor(Math.random() * items.length)] || null;
}

function pickWeightedRandom(items, getWeight) {
  const weighted = (items || [])
    .map((item) => ({ item, weight: Math.max(0, Number(getWeight(item)) || 0) }))
    .filter((entry) => entry.weight > 0);
  if (!weighted.length) return pickRandom(items || []);
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return weighted[weighted.length - 1].item;
}

function addExample(pool, seen, text, type) {
  const normalized = text?.trim();
  if (!normalized) return;
  if (type === "kana" && isBlockedJapaneseKanaSurface(normalized)) return;
  const key = `${type}:${normalized}`;
  if (seen.has(key)) return;
  if (!hasSearchableResultsForExample(normalized)) return;
  seen.add(key);
  pool.push({ text: normalized, type });
}

function pickSurnameHanja(surnameData) {
  const entries = (surnameData?.hanjaEntries || []).filter((item) => item.text);
  if (entries.length) {
    return pickWeightedRandom(entries.slice(0, 4), (item) => Number(item.count || 0) || Number(item.percent || 0) || 1)?.text;
  }
  return pickRandom(surnameData?.hanja || []);
}

function pickUsageHanjaForGiven(given) {
  const entries = state.data?.hanjaUsageGivenNames?.[given] || [];
  if (!entries.length) return "";
  return pickWeightedRandom(entries.slice(0, 4), (item) => Math.pow(Math.max(1, Number(item.score || 0)), 1.4))?.hanja || "";
}

function generateHanjaExampleForName(hangul) {
  if (!hangul) return "";
  const { surname, given } = splitNameUnits(hangul, state.runtime.compoundSurnames);
  const surnameData = state.runtime.surnameByHangul.get(surname);
  const surnameHanja = pickSurnameHanja(surnameData);
  if (!surnameHanja) return "";

  const exactUsageGivenHanja = pickUsageHanjaForGiven(given);
  if (exactUsageGivenHanja) return `${surnameHanja}${exactUsageGivenHanja}`;
  return "";
}

function buildGeneratedExampleNames() {
  const pool = [];
  const seen = new Set();
  const surnames = (state.data?.surnames || []).filter((item) => item.hangul && Number(item.population || 0) >= 50000);
  const givenNames = Object.entries(state.data?.givenNames || {})
    .map(([hangul, meta]) => ({
      hangul,
      weight: Number(meta?.totalWeight || 0) + Number(meta?.rowOccurrences || 0) * 25,
    }))
    .filter((item) => item.hangul && Array.from(item.hangul).length === 2 && item.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  if (!surnames.length || !givenNames.length) {
    return (state.data?.fullNames || [])
      .map((row) => row.hangul?.trim())
      .filter(Boolean)
      .map((hangul) => ({ hangul, givenRank: null }));
  }

  const highRankedGivenNames = givenNames.slice(0, 800);
  const broaderGivenNames = givenNames.slice(800, 2500);
  const targetCount = Math.max(exampleChipEls.length * 24, 160);
  let attempts = 0;
  while (pool.length < targetCount && attempts < targetCount * 12) {
    attempts += 1;
    const surname = pickWeightedRandom(surnames, (item) => Math.log1p(Number(item.population || 0)));
    const givenSource =
      Math.random() < 0.82 || !broaderGivenNames.length
        ? highRankedGivenNames
        : broaderGivenNames;
    const given = pickWeightedRandom(givenSource, (item) => Math.log1p(item.weight));
    const hangul = `${surname?.hangul || ""}${given?.hangul || ""}`.trim();
    if (!hangul || seen.has(hangul)) continue;
    const romanOutputs = generateRomanOutputs(hangul, []);
    const kanaOutputs = generateKanaOutputs(hangul, []);
    if (!romanOutputs.length || !kanaOutputs.length) continue;
    seen.add(hangul);
    pool.push({
      hangul,
      givenRank: given?.rank || null,
      roman: pickWeightedRandom(romanOutputs.slice(0, 4), (item) => Number(item.score) || 1)?.text,
      kana: pickWeightedRandom(kanaOutputs.slice(0, 4), (item) => Number(item.score) || 1)?.text?.replace(/\s+/g, "・"),
      hanja: generateHanjaExampleForName(hangul),
    });
  }
  return pool;
}

function buildHangulExamplePool(generatedNames) {
  const pool = [];
  const seen = new Set();
  for (const item of generatedNames || []) {
    addExample(pool, seen, item.hangul, "hangul");
  }
  return pool;
}

function buildRomanExamplePool(generatedNames) {
  const pool = [];
  const seen = new Set();
  for (const item of generatedNames || []) {
    addExample(pool, seen, item.roman, "roman");
  }
  return pool;
}

function buildKanaExamplePool(generatedNames) {
  const pool = [];
  const seen = new Set();
  for (const item of generatedNames || []) {
    addExample(pool, seen, item.kana, "kana");
  }
  return pool;
}

function romanPromptFormats(text) {
  const normalized = text?.trim();
  if (!normalized) return [];
  const formats = [normalized];
  if (/\s/.test(normalized)) {
    formats.push(normalized.replace(/\s+/g, "."));
  }
  return formats;
}

function hangulPromptFormats(hangul) {
  if (!hangul) return [];
  return [hangul];
}

function kanaPromptFormats(text) {
  const normalized = text?.trim();
  if (!normalized) return [];
  const formats = [normalized];
  if (normalized.includes("・")) {
    formats.push(normalized.replace(/・/g, " "));
  }
  return formats;
}

function hanjaPromptFormats(text) {
  const normalized = text?.trim();
  if (!normalized) return [];
  return [normalized];
}

function buildTypewriterPromptSamples(generatedNames) {
  const poolsByType = {
    hangul: [],
    roman: [],
    kana: [],
    hanja: [],
  };
  const seen = new Set();
  const add = (type, text) => {
    const normalized = text?.trim();
    if (!normalized || seen.has(normalized)) return;
    if (!hasSearchableResultsForExample(normalized)) return;
    seen.add(normalized);
    poolsByType[type].push(normalized);
  };

  for (const item of shuffled(generatedNames || [])) {
    for (const format of hangulPromptFormats(item.hangul)) add("hangul", format);
    for (const format of romanPromptFormats(item.roman)) add("roman", format);
    for (const format of kanaPromptFormats(item.kana)) add("kana", format);
    for (const format of hanjaPromptFormats(item.hanja)) add("hanja", format);
  }

  const picks = [];
  const used = new Set();
  const addPick = (text) => {
    if (!text || used.has(text) || picks.length >= TYPEWRITER_EXAMPLE_COUNT) return;
    used.add(text);
    picks.push(text);
  };

  for (const type of ["hangul", "roman", "kana", "hanja"]) {
    addPick(pickRandom(shuffled(poolsByType[type])));
  }

  const punctuatedPool = shuffled(
    [...poolsByType.roman, ...poolsByType.kana, ...poolsByType.hanja].filter((text) => /[.\-・\s]/.test(text)),
  );
  addPick(pickRandom(punctuatedPool));

  const shuffledPools = Object.fromEntries(
    Object.entries(poolsByType).map(([type, pool]) => [type, shuffled(pool)]),
  );
  const cursors = { hangul: 0, roman: 0, kana: 0, hanja: 0 };
  const typeOrder = shuffled(["hangul", "roman", "kana", "hanja"]);

  while (picks.length < TYPEWRITER_EXAMPLE_COUNT) {
    const before = picks.length;
    for (const type of typeOrder) {
      const pool = shuffledPools[type] || [];
      while (cursors[type] < pool.length && used.has(pool[cursors[type]])) {
        cursors[type] += 1;
      }
      addPick(pool[cursors[type]]);
      cursors[type] += 1;
      if (picks.length >= TYPEWRITER_EXAMPLE_COUNT) break;
    }
    if (picks.length === before) break;
  }

  return picks;
}

function setTypewriterText(text) {
  if (!typewriterNameEl) return;
  typewriterNameEl.textContent = text;
}

function startTypewriterAnimation(samples) {
  if (!typewriterNameEl || !samples.length) return;
  if (typewriterTimerId) window.clearTimeout(typewriterTimerId);
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    setTypewriterText(samples[0]);
    return;
  }

  let sampleIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const tick = () => {
    const current = samples[sampleIndex] || "";
    const chars = Array.from(current);
    setTypewriterText(chars.slice(0, charIndex).join(""));

    if (!deleting && charIndex < chars.length) {
      charIndex += 1;
      typewriterTimerId = window.setTimeout(tick, TYPEWRITER_TYPE_DELAY_MS + Math.random() * 28);
      return;
    }

    if (!deleting) {
      deleting = true;
      typewriterTimerId = window.setTimeout(tick, TYPEWRITER_HOLD_DELAY_MS);
      return;
    }

    if (charIndex > 0) {
      charIndex -= 1;
      typewriterTimerId = window.setTimeout(tick, TYPEWRITER_DELETE_DELAY_MS);
      return;
    }

    deleting = false;
    sampleIndex = (sampleIndex + 1) % samples.length;
    typewriterTimerId = window.setTimeout(tick, TYPEWRITER_TYPE_DELAY_MS);
  };

  tick();
}

function hydrateTypewriterPrompt(generatedNames) {
  const samples = buildTypewriterPromptSamples(generatedNames);
  startTypewriterAnimation(samples.length ? samples : ["홍길동"]);
}

function hydrateRandomExamples(generatedNames = null) {
  if (!exampleChipEls.length) return;
  const sourceNames = generatedNames || shuffled(buildGeneratedExampleNames());
  const poolsByType = {
    hangul: shuffled(buildHangulExamplePool(sourceNames)),
    roman: shuffled(buildRomanExamplePool(sourceNames)),
    kana: shuffled(buildKanaExamplePool(sourceNames)),
  };
  const pool = shuffled([...poolsByType.hangul, ...poolsByType.roman, ...poolsByType.kana]);
  if (!pool.length) return;

  const picks = [];
  const used = new Set();

  for (const type of ["hangul", "roman", "kana"]) {
    const item = poolsByType[type].find((candidate) => !used.has(candidate.text));
    if (!item) continue;
    used.add(item.text);
    picks.push(item);
  }

  for (const item of shuffled(pool)) {
    if (picks.length >= exampleChipEls.length) break;
    if (used.has(item.text)) continue;
    used.add(item.text);
    picks.push(item);
  }

  const displayPicks = shuffled(picks);
  exampleChipEls.forEach((button, index) => {
    const item = displayPicks[index];
    if (!item) {
      button.hidden = true;
      return;
    }
    button.hidden = false;
    button.dataset.example = item.text;
    button.textContent = item.text;
  });
}

function hideResultsSection() {
  resultsSectionEl.classList.remove("is-entering", "is-visible");
  resultsSectionEl.classList.add("is-hidden");
  resultsSectionEl.setAttribute("aria-hidden", "true");
  if (interpretationEl) interpretationEl.textContent = "";
}

function showResultsSection() {
  const alreadyVisible = resultsSectionEl.classList.contains("is-visible");
  resultsSectionEl.classList.remove("is-hidden");
  resultsSectionEl.setAttribute("aria-hidden", "false");
  if (alreadyVisible) return;
  resultsSectionEl.classList.add("is-entering");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      resultsSectionEl.classList.remove("is-entering");
      resultsSectionEl.classList.add("is-visible");
    });
  });
}

function collectCandidatesForQuery(query) {
  state.queryMeta = analyzeQueryMeta(query);
  const candidateMap = new Map();
  addExactNameCandidates(query, candidateMap);
  searchStandaloneHangul(query, candidateMap);
  searchStandaloneLatin(query, candidateMap);
  searchStandaloneKana(query, candidateMap);
  searchStandaloneHanja(query, candidateMap);
  searchHangul(query, candidateMap);
  searchLatin(query, candidateMap);
  searchKana(query, candidateMap);
  searchHanja(query, candidateMap);
  searchMixedGroups(query, candidateMap);
  return pruneImplausibleCandidates(candidateMap);
}

function hasSearchableResultsForExample(text) {
  if (!text?.trim()) return false;
  const previousQueryMeta = state.queryMeta;
  const prunedCandidateMap = collectCandidatesForQuery(text);
  state.queryMeta = previousQueryMeta;
  return prunedCandidateMap.size > 0;
}

function search(query) {
  if (!query.trim()) {
    resultsEl.innerHTML = "";
    state.queryMeta = null;
    hideResultsSection();
    return;
  }

  const prunedCandidateMap = collectCandidatesForQuery(query);
  if (interpretationEl) {
    interpretationEl.textContent = deriveInterpretationText(query, prunedCandidateMap);
  }
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
  const [response, hanjaReadingData, hanjaNameCharData, hanjaUsageRankData] = await Promise.all([
    fetch(dataUrl),
    fetchOptionalJson(hanjaReadingUrl),
    fetchOptionalJson(hanjaNameCharUrl),
    fetchOptionalJson(hanjaUsageRankUrl),
  ]);
  state.data = await response.json();
  attachHanjaReadingData(state.data, hanjaReadingData);
  attachHanjaNameCharData(state.data, hanjaNameCharData);
  attachHanjaUsageRankData(state.data, hanjaUsageRankData);
  sanitizeModernKoreanRomanData(state.data);
  state.runtime = buildRuntime(state.data);
  const generatedNames = shuffled(buildGeneratedExampleNames());
  hydrateRandomExamples(generatedNames);
  hydrateTypewriterPrompt(generatedNames);
  resultsEl.innerHTML = "";
  hideResultsSection();
}

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  search(queryEl.value);
});

exampleChipEls.forEach((button) => {
  button.addEventListener("click", () => {
    queryEl.value = button.dataset.example || "";
    search(queryEl.value);
  });
});

init().catch((error) => {
  console.error(error);
  resultsEl.innerHTML = `<div class="empty-state" role="status">Failed to load the search index. Serve the folder over HTTP and reload.</div>`;
  showResultsSection();
});
