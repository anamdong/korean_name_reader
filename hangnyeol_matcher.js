function hanjaCharacters(value) {
  return Array.from(String(value || "")).filter((character) => /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(character));
}

export function clanIdForHangnyeol({ surnameHangul, surnameHanja, bonGwanName, bonGwanHanja = "" }) {
  return [surnameHangul, surnameHanja, bonGwanName, bonGwanHanja].map((value) => String(value || "").trim()).join("|");
}

export function leadingSurnameHanja(queryText, surnameLength) {
  const leading = String(queryText || "").trim().match(/^[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+/)?.[0] || "";
  const characters = hanjaCharacters(leading);
  return characters.length >= surnameLength ? characters.slice(0, surnameLength).join("") : "";
}

export function findHangnyeolMatches(dataset, input) {
  const givenHangul = Array.from(String(input?.givenNameHangul || ""));
  const givenHanja = hanjaCharacters(input?.givenNameHanja);
  if (!dataset?.records?.length || givenHangul.length < 1) return [];

  const matches = dataset.records.flatMap((record) => {
    if (!new Set(["verified", "corroborated"]).has(record.status)) return [];
    if (record.surnameHangul !== input.surnameHangul || record.surnameHanja !== input.surnameHanja) return [];
    const positionIndexes = record.matchedPosition === "given_second"
      ? [givenHangul.length - 1]
      : record.matchedPosition === "either" || record.matchedPosition === "variable"
        ? [...givenHangul.keys()]
        : [0];

    return positionIndexes.flatMap((positionIndex) => {
      if (givenHangul[positionIndex] !== record.matchedCharacterHangul) return [];
      const knownHanja = givenHanja.length > positionIndex ? givenHanja[positionIndex] : "";
      if (knownHanja && record.matchedCharacterHanja && knownHanja !== record.matchedCharacterHanja) return [];
      const evidenceType = knownHanja && record.matchedCharacterHanja ? "exact_hanja" : "hangul_reading";
      return [{
        clanId: record.clanId,
        systemId: record.systemId || "",
        systemName: record.systemName || "",
        scope: record.scope || "unknown",
        branchId: record.branchId || "",
        branchName: record.branchNameHangul || record.branchName || "",
        branchNameHangul: record.branchNameHangul || record.branchName || "",
        branchNameHanja: record.branchNameHanja || "",
        generation: Number.isFinite(Number(record.generation)) ? Number(record.generation) : null,
        generationLabelRaw: record.generationLabelRaw || "",
        matchedCharacterHangul: record.matchedCharacterHangul,
        matchedCharacterHanja: record.matchedCharacterHanja || "",
        matchedPosition: record.matchedPosition,
        patternHangul: record.patternHangul || "",
        patternHanja: record.patternHanja || "",
        evidenceType,
        confidence: evidenceType === "exact_hanja" ? "strong" : "possible",
        sourceIds: [...(record.sourceIds || [])],
      }];
    });
  });
  return matches.sort((left, right) => {
    const strength = (match) => match.evidenceType === "exact_hanja" ? 0 : 1;
    return strength(left) - strength(right)
      || String(left.clanId).localeCompare(String(right.clanId))
      || String(left.systemId).localeCompare(String(right.systemId));
  });
}

export function sourceRecordsForHangnyeolMatch(dataset, match) {
  return (match?.sourceIds || []).map((id) => dataset?.sources?.[id]).filter(Boolean);
}
