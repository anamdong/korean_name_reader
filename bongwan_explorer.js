import { clanIdForHangnyeol } from "./hangnyeol_matcher.js";

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const ONSETS = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const VOWELS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const CODAS = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "p", "l", "l", "l", "p", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "h"];

const FAMILIAR_SURNAME_ROMAN = new Map(Object.entries({
  김: ["kim", "gim"], 이: ["lee", "yi", "i", "rhee"], 박: ["park", "bak", "pak"], 최: ["choi", "choe"],
  정: ["jung", "jeong", "chung"], 조: ["cho", "jo"], 강: ["kang", "gang"], 윤: ["yoon", "yun"],
  장: ["jang", "chang"], 임: ["lim", "im", "yim"], 한: ["han", "hahn"], 오: ["oh", "o"],
  서: ["seo", "suh"], 신: ["shin", "sin"], 권: ["kwon", "gwon", "kweon"], 황: ["hwang"],
  안: ["ahn", "an"], 송: ["song"], 전: ["jeon", "jun", "chun"], 홍: ["hong"], 유: ["yoo", "yu"],
  류: ["ryu", "ryoo", "yoo"], 노: ["noh", "no", "roh"], 차: ["cha"], 문: ["moon", "mun"],
  배: ["bae", "pae"], 백: ["baek", "paek"], 하: ["ha"], 곽: ["kwak", "gwak"], 남: ["nam"],
  심: ["shim", "sim"], 성: ["sung", "seong"], 구: ["koo", "gu", "ku"], 우: ["woo", "u"],
  진: ["jin", "chin"], 나: ["na"], 엄: ["um", "eom"], 원: ["won"], 천: ["cheon", "chun"],
  방: ["bang", "pang"], 공: ["gong", "kong"], 현: ["hyun", "hyeon"], 함: ["ham"], 변: ["byun", "byeon"],
}));

export function normalizeBongwanSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s.\-_'·・氏]/g, "");
}

export function romanizeHangul(value) {
  return Array.from(String(value || "")).map((character) => {
    const code = character.charCodeAt(0);
    if (code < HANGUL_BASE || code > HANGUL_END) return character;
    const offset = code - HANGUL_BASE;
    const onset = Math.floor(offset / 588);
    const vowel = Math.floor((offset % 588) / 28);
    const coda = offset % 28;
    return `${ONSETS[onset]}${VOWELS[vowel]}${CODAS[coda]}`;
  }).join("");
}

function romanAliases(value, isSurname = false) {
  const standard = normalizeBongwanSearchText(romanizeHangul(value));
  const aliases = new Set(standard ? [standard] : []);
  if (isSurname) {
    for (const alias of FAMILIAR_SURNAME_ROMAN.get(value) || []) aliases.add(alias);
  }
  return [...aliases];
}

function placeKey(name, hanja) {
  return `${String(name || "").trim()}|${String(hanja || "").trim()}`;
}

function sortByPopulation(left, right) {
  return Number(right.population || 0) - Number(left.population || 0)
    || left.displayHangul.localeCompare(right.displayHangul, "ko");
}

function makeLocationIndex(geography, coordinateData) {
  const locations = new Map();
  const coordinates = coordinateData?.places || {};
  for (const group of geography?.peninsulaMappings || []) {
    for (const key of group.places || []) {
      const coordinate = coordinates[key];
      const canonicalKey = coordinate?.locationKey || key;
      const [canonicalNameHangul, canonicalNameHanja] = canonicalKey.split("|");
      locations.set(key, {
        locationType: "peninsula",
        regionId: group.regionId,
        mappingConfidence: group.confidence || "medium",
        coordinateKey: coordinate ? canonicalKey : "",
        locationNameHangul: canonicalNameHangul,
        locationNameHanja: canonicalNameHanja || "",
        latitude: Number.isFinite(Number(coordinate?.latitude)) ? Number(coordinate.latitude) : null,
        longitude: Number.isFinite(Number(coordinate?.longitude)) ? Number(coordinate.longitude) : null,
        coordinateConfidence: coordinate?.mappingConfidence || "",
        sourceIds: ["placeIndex"],
      });
    }
  }
  for (const group of geography?.outsidePeninsulaMappings || []) {
    for (const key of group.places || []) {
      locations.set(key, {
        locationType: "outside_peninsula",
        modernNameHangul: group.modernNameHangul || "",
        modernCountry: group.modernCountry || "",
        mappingConfidence: group.confidence || "medium",
        sourceIds: ["placeIndex"],
      });
    }
  }
  return locations;
}

function scoreEntry(entry, query) {
  if (!query) return 1;
  const fields = entry.searchFields;
  if (fields.fullExact.has(query)) return 1200;
  if (fields.surnameExact.has(query) || fields.placeExact.has(query)) return 1000;
  if (fields.fullPrefix.some((value) => value.startsWith(query))) return 740;
  if (fields.surnamePrefix.some((value) => value.startsWith(query)) || fields.placePrefix.some((value) => value.startsWith(query))) return 680;
  if (fields.fullContains.some((value) => value.includes(query))) return 380;
  return 0;
}

function exactFieldMatches(entries, field, query) {
  return entries.filter((entry) => entry.searchFields[field].has(query));
}

function uniqueBy(items, keyFor) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeSearchFields(entry) {
  const surnameRoman = romanAliases(entry.surnameHangul, true);
  const placeRoman = romanAliases(entry.bonGwanName);
  const fullRoman = new Set();
  for (const place of placeRoman) {
    for (const surname of surnameRoman) {
      fullRoman.add(`${place}${surname}`);
      fullRoman.add(`${surname}${place}`);
    }
  }
  const full = new Set([
    `${entry.bonGwanName}${entry.surnameHangul}`,
    `${entry.bonGwanName}${entry.surnameHangul}씨`,
    `${entry.bonGwanHanja}${entry.surnameHanja}`,
    `${entry.bonGwanHanja}${entry.surnameHanja}氏`,
    ...fullRoman,
  ].map(normalizeBongwanSearchText));
  const surname = new Set([entry.surnameHangul, entry.surnameHanja, ...surnameRoman].map(normalizeBongwanSearchText));
  const place = new Set([entry.bonGwanName, entry.bonGwanHanja, ...placeRoman].map(normalizeBongwanSearchText));
  return {
    fullExact: full,
    surnameExact: surname,
    placeExact: place,
    fullPrefix: [...full],
    surnamePrefix: [...surname],
    placePrefix: [...place],
    fullContains: [...new Set([...full, ...surname, ...place])],
  };
}

export function createBongwanExplorer({ bonGwanData, geography, hangnyeolData, placeCoordinates }) {
  const locationIndex = makeLocationIndex(geography, placeCoordinates);
  const surnameTotals = new Map();
  const entries = [];
  for (const [surnameKey, surnameRecord] of Object.entries(bonGwanData?.surnames || {})) {
    surnameTotals.set(surnameKey, Number(surnameRecord.total || 0));
    for (const clan of surnameRecord.clans || []) {
      if (clan.otherCombined) continue;
      const clanId = clanIdForHangnyeol({
        surnameHangul: surnameRecord.hangul,
        surnameHanja: surnameRecord.hanja,
        bonGwanName: clan.name,
        bonGwanHanja: clan.hanja || "",
      });
      const entry = {
        clanId,
        surnameKey,
        surnameHangul: surnameRecord.hangul,
        surnameHanja: surnameRecord.hanja,
        bonGwanName: clan.name,
        bonGwanHanja: clan.hanja || "",
        population: Number(clan.count || 0),
        displayHangul: `${clan.name} ${surnameRecord.hangul}씨`,
        displayHanja: `${clan.hanja || ""} ${surnameRecord.hanja}氏`.trim(),
        location: {
          originNameHangul: clan.name,
          originNameHanja: clan.hanja || "",
          locationType: "historical_uncertain",
          mappingConfidence: "low",
          sourceIds: [],
          ...(locationIndex.get(placeKey(clan.name, clan.hanja)) || {}),
        },
      };
      entry.searchFields = makeSearchFields(entry);
      entries.push(entry);
    }
  }
  const dedupedEntries = uniqueBy(entries, (entry) => entry.clanId).sort(sortByPopulation);
  const byId = new Map(dedupedEntries.map((entry) => [entry.clanId, entry]));
  const regionEntries = new Map();
  const locationEntries = new Map();
  for (const entry of dedupedEntries) {
    if (entry.location.locationType !== "peninsula" || !entry.location.regionId) continue;
    const list = regionEntries.get(entry.location.regionId) || [];
    list.push(entry);
    regionEntries.set(entry.location.regionId, list);
    if (!entry.location.coordinateKey) continue;
    const locations = locationEntries.get(entry.location.coordinateKey) || [];
    locations.push(entry);
    locationEntries.set(entry.location.coordinateKey, locations);
  }
  for (const list of regionEntries.values()) list.sort(sortByPopulation);
  for (const list of locationEntries.values()) list.sort(sortByPopulation);
  const recordsByClan = new Map();
  for (const record of hangnyeolData?.records || []) {
    if (!new Set(["verified", "corroborated"]).has(record.status)) continue;
    const list = recordsByClan.get(record.clanId) || [];
    list.push(record);
    recordsByClan.set(record.clanId, list);
  }
  return {
    entries: dedupedEntries,
    byId,
    regionEntries,
    locationEntries,
    regions: geography?.regions || {},
    geographyMeta: geography?.meta || {},
    hangnyeolSources: hangnyeolData?.sources || {},
    surnameTotals,
    recordsByClan,
    censusYear: bonGwanData?.meta?.year || null,
  };
}

export function searchBongwan(explorer, value, limit = 80) {
  const query = normalizeBongwanSearchText(value);
  // A one-syllable surname must not be widened to a longer Bon-gwan place that
  // happens to contain the same syllable or Hanja. Exact surname intent wins,
  // followed by exact place intent, before general full-name matching.
  const exactSurnameMatches = query ? exactFieldMatches(explorer.entries, "surnameExact", query) : [];
  const exactPlaceMatches = !exactSurnameMatches.length && query
    ? exactFieldMatches(explorer.entries, "placeExact", query)
    : [];
  const candidates = exactSurnameMatches.length ? exactSurnameMatches
    : exactPlaceMatches.length ? exactPlaceMatches
      : explorer.entries;
  const matches = candidates
    .map((entry) => ({ entry, relevance: scoreEntry(entry, query) }))
    .filter((match) => match.relevance > 0)
    .sort((left, right) => right.relevance - left.relevance || sortByPopulation(left.entry, right.entry));
  return { query, matches: matches.slice(0, limit), total: matches.length };
}

export function bongwanSuggestions(explorer, value, limit = 8) {
  const result = searchBongwan(explorer, value, 120);
  const surnames = new Map();
  const places = new Map();
  for (const { entry, relevance } of result.matches) {
    const surnameKey = `${entry.surnameHangul}|${entry.surnameHanja}`;
    const placeKeyValue = `${entry.bonGwanName}|${entry.bonGwanHanja}`;
    const surname = surnames.get(surnameKey) || { kind: "surname", text: entry.surnameHangul, hanja: entry.surnameHanja, relevance, population: 0 };
    surname.relevance = Math.max(surname.relevance, relevance);
    surname.population += entry.population;
    surnames.set(surnameKey, surname);
    const place = places.get(placeKeyValue) || { kind: "place", text: entry.bonGwanName, hanja: entry.bonGwanHanja, relevance, population: 0 };
    place.relevance = Math.max(place.relevance, relevance);
    place.population += entry.population;
    places.set(placeKeyValue, place);
  }
  const sort = (left, right) => right.relevance - left.relevance || right.population - left.population || left.text.localeCompare(right.text, "ko");
  return {
    clans: result.matches.slice(0, limit).map(({ entry }) => entry),
    surnames: [...surnames.values()].sort(sort).slice(0, 2),
    places: [...places.values()].sort(sort).slice(0, 3),
  };
}

export function aggregateMatchesByRegion(explorer, matches) {
  const regionMap = new Map();
  const seen = new Set();
  for (const item of matches || []) {
    const entry = item.entry || item;
    if (!entry?.clanId || seen.has(entry.clanId)) continue;
    seen.add(entry.clanId);
    const regionId = entry.location?.locationType === "peninsula" ? entry.location.regionId : "";
    if (!regionId) continue;
    const region = regionMap.get(regionId) || { regionId, population: 0, clanIds: [], entries: [] };
    region.population += Number(entry.population || 0);
    region.clanIds.push(entry.clanId);
    region.entries.push(entry);
    regionMap.set(regionId, region);
  }
  return [...regionMap.values()].map((region) => ({
    ...region,
    entries: region.entries.sort(sortByPopulation),
  })).sort((left, right) => right.population - left.population);
}

export function aggregateMatchesByLocation(explorer, matches) {
  const locationMap = new Map();
  const seen = new Set();
  for (const item of matches || []) {
    const entry = item.entry || item;
    const location = entry?.location;
    if (!entry?.clanId || seen.has(entry.clanId) || !location?.coordinateKey) continue;
    seen.add(entry.clanId);
    const locationKey = location.coordinateKey;
    const value = locationMap.get(locationKey) || {
      locationKey,
      name: location.locationNameHangul || location.originNameHangul,
      hanja: location.locationNameHanja || location.originNameHanja,
      latitude: location.latitude,
      longitude: location.longitude,
      population: 0,
      clanIds: [],
      entries: [],
    };
    value.population += Number(entry.population || 0);
    value.clanIds.push(entry.clanId);
    value.entries.push(entry);
    locationMap.set(locationKey, value);
  }
  return [...locationMap.values()].map((location) => ({
    ...location,
    entries: location.entries.sort(sortByPopulation),
  })).sort((left, right) => right.population - left.population || left.name.localeCompare(right.name, "ko"));
}

export function heatIntensity(population, maxPopulation) {
  if (!population || !maxPopulation) return 0;
  return Math.max(0.14, Math.min(1, Math.sqrt(population) / Math.sqrt(maxPopulation)));
}

export function getBongwanReport(explorer, clanId) {
  const entry = explorer.byId.get(clanId);
  if (!entry) return null;
  const allByPopulation = explorer.entries.slice().sort(sortByPopulation);
  const surnameTotal = explorer.surnameTotals.get(entry.surnameKey) || 0;
  const records = (explorer.recordsByClan.get(clanId) || []).slice().sort((left, right) => {
    return String(left.scope || "").localeCompare(String(right.scope || ""))
      || String(left.branchNameHangul || left.branchName || "").localeCompare(String(right.branchNameHangul || right.branchName || ""), "ko")
      || Number(left.generation || 0) - Number(right.generation || 0);
  });
  const branchesById = new Map();
  for (const record of records) {
    if (!new Set(["branch", "subbranch"]).has(record.scope) || !(record.branchNameHangul || record.branchName)) continue;
    const id = record.branchId || record.systemId || `${record.branchNameHangul || record.branchName}|${record.branchNameHanja || ""}`;
    const branch = branchesById.get(id) || {
      id,
      name: record.branchNameHangul || record.branchName,
      hanja: record.branchNameHanja || "",
      scope: record.scope,
      records: [],
    };
    if (!branch.hanja && record.branchNameHanja) branch.hanja = record.branchNameHanja;
    branch.records.push(record);
    branchesById.set(id, branch);
  }
  const branches = [...branchesById.values()].sort((left, right) => {
    return left.name.localeCompare(right.name, "ko")
      || left.hanja.localeCompare(right.hanja, "ko")
      || left.id.localeCompare(right.id, "ko");
  });
  const sources = uniqueBy(records.flatMap((record) => (record.sourceIds || []).map((id) => explorer.hangnyeolSources?.[id] || null)).filter(Boolean), (source) => source.url || source.title);
  return {
    entry,
    nationalRank: allByPopulation.findIndex((item) => item.clanId === clanId) + 1,
    surnameTotal,
    surnameShare: surnameTotal ? entry.population / surnameTotal : 0,
    branches,
    generationNames: records,
    sources,
    censusYear: explorer.censusYear,
  };
}

export function getBongwanExplorerCoverage(explorer) {
  const counts = { peninsula: 0, northKorea: 0, outside: 0, uncertain: 0 };
  for (const entry of explorer.entries) {
    if (entry.location.locationType === "peninsula") {
      counts.peninsula += 1;
      if (String(entry.location.regionId || "").startsWith("KP")) counts.northKorea += 1;
    } else if (entry.location.locationType === "outside_peninsula") counts.outside += 1;
    else counts.uncertain += 1;
  }
  return counts;
}
