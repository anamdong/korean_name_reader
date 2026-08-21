import {
  aggregateMatchesByRegion,
  bongwanSuggestions,
  createBongwanExplorer,
  getBongwanReport,
  heatIntensity,
  searchBongwan,
} from "./bongwan_explorer.js?v=20260821-branch-selector-1";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_REGION_CLANS = 6;
const RESULT_PAGE_SIZE = 16;
const MAX_RESULTS = RESULT_PAGE_SIZE;
const QUERY_HINT_EXAMPLES = ["김", "경주", "金海", "김해 김씨"];

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function geometryPath(geometry) {
  // Preserve the peninsula's tall geographic aspect rather than stretching the SVG.
  const project = ([longitude, latitude]) => [62 + (longitude - 124) * 70, 860 - (latitude - 32.5) * 75];
  const ring = (coordinates) => coordinates.map((coordinate, index) => {
    const [x, y] = project(coordinate);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
  if (geometry?.type === "Polygon") return geometry.coordinates.map(ring).join(" ");
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.flatMap((polygon) => polygon.map(ring)).join(" ");
  return "";
}

function confidenceKey(value) {
  return value === "high" ? "mappingConfidenceHigh" : value === "medium" ? "mappingConfidenceMedium" : "mappingConfidenceLow";
}

function appendText(parent, className, text, tag = "p") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function formatPercent(value, locale) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(Number(value || 0));
}

export function initializeBongwanExplorerUi({ bonGwanData, geography, hangnyeolData, regionGeoJson, t, formatNumber, getLocale }) {
  const elements = {
    panel: document.querySelector("#bongwan-panel"),
    query: document.querySelector("#bongwan-query"),
    queryHint: document.querySelector("#bongwan-query-hint"),
    clear: document.querySelector("#bongwan-search-clear"),
    suggestions: document.querySelector("#bongwan-suggestions"),
    map: document.querySelector("#bongwan-map"),
    mapFrame: document.querySelector("#bongwan-map-frame"),
    popover: document.querySelector("#bongwan-region-popover"),
    regionPanel: document.querySelector("#bongwan-region-panel"),
    resultCount: document.querySelector("#bongwan-results-count"),
    results: document.querySelector("#bongwan-results"),
    outside: document.querySelector("#bongwan-outside"),
    uncertain: document.querySelector("#bongwan-uncertain"),
    report: document.querySelector("#bongwan-report"),
  };
  if (!elements.panel || !elements.query || !elements.map) return null;

  const explorer = createBongwanExplorer({ bonGwanData, geography, hangnyeolData });
  const state = { selectedClanId: "", selectedBranchId: "", selectedRegionId: "", activeQuery: "", lastMatches: explorer.entries.map((entry) => ({ entry, relevance: 1 })), resultLimit: MAX_RESULTS };
  const features = new Map((regionGeoJson?.features || []).map((feature) => [feature.properties?.shapeISO, feature]));
  let queryHintIndex = -1;
  let queryHintTimer = null;
  let queryHintFadeTimer = null;

  function setQueryHint(text, immediate = false) {
    if (!elements.queryHint) return;
    window.clearTimeout(queryHintFadeTimer);
    if (immediate) {
      elements.queryHint.textContent = text;
      elements.queryHint.classList.remove("is-changing");
      return;
    }
    elements.queryHint.classList.add("is-changing");
    queryHintFadeTimer = window.setTimeout(() => {
      elements.queryHint.textContent = text;
      elements.queryHint.classList.remove("is-changing");
    }, 160);
  }

  function stopQueryHintRotation() {
    window.clearTimeout(queryHintTimer);
    queryHintTimer = null;
  }

  function rotateQueryHint() {
    if (elements.query.value.trim()) return;
    queryHintIndex = (queryHintIndex + 1) % QUERY_HINT_EXAMPLES.length;
    setQueryHint(QUERY_HINT_EXAMPLES[queryHintIndex]);
    queryHintTimer = window.setTimeout(rotateQueryHint, 3200);
  }

  function resetQueryHintRotation() {
    stopQueryHintRotation();
    queryHintIndex = -1;
    setQueryHint(t("bongwanSearchPlaceholder"), true);
    if (elements.queryHint) queryHintTimer = window.setTimeout(rotateQueryHint, 1800);
  }

  function syncQueryHint() {
    const hasQuery = Boolean(elements.query.value.trim());
    elements.query.closest(".bongwan-search-row")?.classList.toggle("has-query", hasQuery);
    if (hasQuery) stopQueryHintRotation();
    else if (!queryHintTimer) resetQueryHintRotation();
  }

  function visibleMatches() {
    const result = searchBongwan(explorer, state.activeQuery, 999);
    return state.activeQuery ? result.matches : explorer.entries.map((entry) => ({ entry, relevance: 1 }));
  }

  function selectedRegionData() {
    return aggregateMatchesByRegion(explorer, state.lastMatches).find((region) => region.regionId === state.selectedRegionId) || null;
  }

  function openClan(clanId) {
    state.selectedClanId = clanId;
    state.selectedBranchId = "";
    const entry = explorer.byId.get(clanId);
    state.selectedRegionId = entry?.location?.regionId || "";
    renderAll();
    elements.report?.scrollIntoView({ behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth", block: "start" });
  }

  function makeClanButton(entry, className = "bongwan-clan-row") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.clanId = entry.clanId;
    const heading = document.createElement("span");
    heading.className = "bongwan-clan-name";
    heading.textContent = entry.displayHangul;
    const hanja = document.createElement("span");
    hanja.className = "bongwan-clan-hanja";
    hanja.textContent = entry.displayHanja;
    const meta = document.createElement("span");
    meta.className = "bongwan-clan-meta";
    const origin = entry.location.locationType === "peninsula"
      ? explorer.regions[entry.location.regionId]?.hangul || entry.bonGwanName
      : entry.location.modernNameHangul || entry.bonGwanName;
    meta.textContent = `${t("population")} ${formatNumber(entry.population)} · ${origin}`;
    button.append(heading, hanja, meta);
    button.addEventListener("click", () => openClan(entry.clanId));
    return button;
  }

  function renderSuggestions() {
    const query = elements.query.value.trim();
    elements.clear.hidden = !query;
    elements.suggestions.replaceChildren();
    if (!query) {
      elements.suggestions.hidden = true;
      elements.query.setAttribute("aria-expanded", "false");
      return;
    }
    const suggestions = bongwanSuggestions(explorer, query);
    const groups = [
      ["bongwanSurnames", suggestions.surnames],
      ["bongwanPlaces", suggestions.places],
      ["bongwanClans", suggestions.clans],
    ];
    for (const [titleKey, items] of groups) {
      if (!items.length) continue;
      const group = document.createElement("div");
      group.className = "bongwan-suggestion-group";
      appendText(group, "bongwan-suggestion-label", t(titleKey), "p");
      for (const item of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.role = "option";
        button.className = "bongwan-suggestion";
        const text = item.displayHangul || item.text;
        const hanja = item.displayHanja || item.hanja;
        button.textContent = hanja ? `${text}  ${hanja}` : text;
        button.addEventListener("click", () => {
          if (item.clanId) {
            elements.query.value = item.displayHangul;
            state.activeQuery = item.displayHangul;
            openClan(item.clanId);
          } else {
            const exactQuery = item.hanja || item.text;
            elements.query.value = exactQuery;
            state.activeQuery = exactQuery;
            state.selectedClanId = "";
            state.selectedRegionId = "";
            renderAll();
          }
          elements.query.focus();
        });
        group.append(button);
      }
      elements.suggestions.append(group);
    }
    const hasSuggestions = Boolean(elements.suggestions.childElementCount);
    elements.suggestions.hidden = !hasSuggestions;
    elements.query.setAttribute("aria-expanded", String(hasSuggestions));
  }

  function renderMap() {
    const aggregated = aggregateMatchesByRegion(explorer, state.lastMatches);
    const byRegion = new Map(aggregated.map((region) => [region.regionId, region]));
    const maxPopulation = aggregated[0]?.population || 0;
    elements.map.replaceChildren();
    for (const [regionId, region] of Object.entries(explorer.regions)) {
      const feature = features.get(regionId);
      if (!feature) continue;
      const regionData = byRegion.get(regionId);
      const path = svgElement("path", {
        d: geometryPath(feature.geometry),
        class: "bongwan-region",
        "data-region-id": regionId,
        tabindex: "0",
        role: "button",
        "aria-pressed": String(state.selectedRegionId === regionId),
        "aria-label": `${region.hangul}: ${regionData ? `${formatNumber(regionData.population)} ${t("population")}` : t("noMatchingClans")}`,
      });
      if (regionData) path.style.setProperty("--map-intensity", heatIntensity(regionData.population, maxPopulation).toFixed(3));
      if (state.selectedRegionId === regionId) path.classList.add("is-selected");
      const show = (event) => showRegionPopover(regionId, event);
      path.addEventListener("pointerenter", show);
      path.addEventListener("focus", show);
      path.addEventListener("pointerleave", () => { if (!state.selectedRegionId) hideRegionPopover(); });
      path.addEventListener("click", () => selectRegion(regionId));
      path.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectRegion(regionId);
        }
      });
      elements.map.append(path);
    }
  }

  function regionContent(regionId, persistent = false) {
    const data = aggregateMatchesByRegion(explorer, state.lastMatches).find((region) => region.regionId === regionId);
    const region = explorer.regions[regionId];
    const content = document.createElement("div");
    if (!region) return content;
    appendText(content, "bongwan-region-title", region.hangul, "h3");
    if (!data) {
      appendText(content, "bongwan-region-empty", t("noMatchingClans"));
      return content;
    }
    appendText(content, "bongwan-region-total", `${formatNumber(data.population)} · ${data.entries.length} ${t("bongwanClans")}`);
    appendText(content, "bongwan-region-label", persistent ? t("clansInRegion") : t("matchingClans"));
    const list = document.createElement("div");
    list.className = "bongwan-region-clans";
    for (const entry of data.entries.slice(0, MAX_REGION_CLANS)) list.append(makeClanButton(entry, "bongwan-region-clan"));
    content.append(list);
    if (data.entries.length > MAX_REGION_CLANS) appendText(content, "bongwan-region-more", t("showMore", { count: data.entries.length - MAX_REGION_CLANS }));
    return content;
  }

  function showRegionPopover(regionId, event) {
    const content = regionContent(regionId);
    elements.popover.replaceChildren(content);
    elements.popover.hidden = false;
    const frame = elements.mapFrame.getBoundingClientRect();
    const x = Math.min(Math.max(12, (event?.clientX || frame.left + frame.width / 2) - frame.left + 14), Math.max(12, frame.width - 256));
    const y = Math.min(Math.max(12, (event?.clientY || frame.top + frame.height / 2) - frame.top + 14), Math.max(12, frame.height - 250));
    elements.popover.style.left = `${x}px`;
    elements.popover.style.top = `${y}px`;
  }

  function hideRegionPopover() {
    elements.popover.hidden = true;
  }

  function selectRegion(regionId) {
    state.selectedRegionId = state.selectedRegionId === regionId ? "" : regionId;
    state.selectedClanId = "";
    renderAll();
  }

  function renderRegionPanel() {
    const data = selectedRegionData();
    elements.regionPanel.replaceChildren();
    elements.regionPanel.hidden = !data;
    if (!data) return;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "bongwan-panel-close";
    close.textContent = "×";
    close.setAttribute("aria-label", t("close"));
    close.addEventListener("click", () => { state.selectedRegionId = ""; renderAll(); });
    elements.regionPanel.append(close, regionContent(data.regionId, true));
  }

  function renderResults() {
    const matches = state.lastMatches;
    elements.resultCount.textContent = matches.length ? formatNumber(matches.length) : "";
    elements.results.replaceChildren();
    if (!matches.length) {
      appendText(elements.results, "bongwan-empty", t("noMatchingClans"));
      return;
    }
    const visibleCount = Math.min(state.resultLimit, matches.length);
    for (const { entry } of matches.slice(0, visibleCount)) elements.results.append(makeClanButton(entry));
    if (matches.length <= visibleCount) return;
    const remaining = matches.length - visibleCount;
    const increment = Math.min(RESULT_PAGE_SIZE, remaining);
    const more = document.createElement("button");
    more.type = "button";
    more.className = "bongwan-result-more";
    more.textContent = t("showMore", { count: increment, remaining });
    more.addEventListener("click", () => {
      state.resultLimit += RESULT_PAGE_SIZE;
      renderResults();
    });
    elements.results.append(more);
  }

  function renderSecondarySections() {
    const entries = state.lastMatches.map(({ entry }) => entry);
    const render = (element, titleKey, filter) => {
      const filtered = entries.filter(filter).slice(0, 8);
      element.replaceChildren();
      element.hidden = !filtered.length;
      if (!filtered.length) return;
      appendText(element, "bongwan-secondary-title", t(titleKey), "h2");
      const list = document.createElement("div");
      list.className = "bongwan-secondary-list";
      for (const entry of filtered) list.append(makeClanButton(entry, "bongwan-secondary-row"));
      element.append(list);
    };
    render(elements.outside, "outsidePeninsula", (entry) => entry.location.locationType === "outside_peninsula");
    render(elements.uncertain, "locationUncertain", (entry) => entry.location.locationType === "historical_uncertain");
  }

  function renderReport() {
    const report = getBongwanReport(explorer, state.selectedClanId);
    elements.report.replaceChildren();
    elements.report.hidden = !report;
    if (!report) return;
    const { entry } = report;
    const header = document.createElement("header");
    header.className = "bongwan-report-header";
    appendText(header, "bongwan-report-name", entry.displayHangul, "h2");
    appendText(header, "bongwan-report-hanja", entry.displayHanja);
    elements.report.append(header);
    const stats = document.createElement("dl");
    stats.className = "bongwan-report-stats";
    const addStat = (label, value) => {
      const group = document.createElement("div");
      appendText(group, "", label, "dt");
      appendText(group, "", value, "dd");
      stats.append(group);
    };
    addStat(t("censusPopulation", { year: report.censusYear }), formatNumber(entry.population));
    addStat(t("nationalRank"), `#${formatNumber(report.nationalRank)}`);
    addStat(t("shareOfSurname"), formatPercent(report.surnameShare, getLocale()));
    elements.report.append(stats);
    const origin = document.createElement("section");
    origin.className = "bongwan-report-section";
    appendText(origin, "", t("geographicOrigin"), "h3");
    const location = entry.location;
    const mapped = location.locationType === "peninsula"
      ? explorer.regions[location.regionId]?.hangul
      : location.locationType === "outside_peninsula"
        ? `${location.modernNameHangul} · ${location.modernCountry}`
        : t("locationUncertain");
    appendText(origin, "bongwan-report-origin", `${entry.bonGwanName}${entry.bonGwanHanja ? ` · ${entry.bonGwanHanja}` : ""}${mapped ? ` · ${mapped}` : ""}`);
    if (location.locationType !== "historical_uncertain") appendText(origin, "bongwan-report-confidence", `${t("mappingConfidence")}: ${t(confidenceKey(location.mappingConfidence))}`);
    elements.report.append(origin);
    if (report.branches.length) {
      const branches = document.createElement("section");
      branches.className = "bongwan-report-section";
      appendText(branches, "", t("branches"), "h3");
      const list = document.createElement("div");
      list.className = "bongwan-branch-list";
      for (const branch of report.branches) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bongwan-branch-button";
        button.setAttribute("aria-pressed", String(branch.id === state.selectedBranchId));
        if (branch.id === state.selectedBranchId) button.classList.add("is-selected");
        const name = document.createElement("span");
        name.className = "bongwan-branch-name";
        name.textContent = branch.name;
        button.append(name);
        if (branch.hanja) appendText(button, "bongwan-branch-hanja", branch.hanja, "span");
        button.addEventListener("click", () => {
          state.selectedBranchId = branch.id;
          renderReport();
        });
        list.append(button);
      }
      branches.append(list);
      elements.report.append(branches);
    }
    if (report.generationNames.length) {
      const generations = document.createElement("section");
      generations.className = "bongwan-report-section";
      appendText(generations, "", t("generationNames"), "h3");
      const selectedBranch = report.branches.find((branch) => branch.id === state.selectedBranchId) || null;
      if (report.branches.length && !selectedBranch) {
        appendText(generations, "bongwan-generation-empty", t("selectBranchForGenerationNames"));
      } else {
        if (selectedBranch) appendText(generations, "bongwan-generation-branch", `${selectedBranch.name}${selectedBranch.hanja ? ` · ${selectedBranch.hanja}` : ""}`);
        const table = document.createElement("table");
        table.className = "bongwan-generation-table";
        const body = document.createElement("tbody");
        const rows = selectedBranch ? selectedBranch.records : report.generationNames;
        for (const row of rows.slice(0, 36)) {
          const tr = document.createElement("tr");
          for (const text of [row.generationLabelRaw || row.generation ? `${row.generation || ""}세` : "", row.patternHanja || row.matchedCharacterHanja || row.patternHangul || row.matchedCharacterHangul || "", !selectedBranch && (row.scope === "branch" || row.scope === "subbranch") ? (row.branchNameHangul || row.branchName || "") : ""]) {
            const cell = document.createElement("td");
            cell.textContent = text;
            tr.append(cell);
          }
          body.append(tr);
        }
        table.append(body);
        generations.append(table);
      }
      elements.report.append(generations);
    }
    const sources = document.createElement("details");
    sources.className = "bongwan-report-sources";
    const summary = document.createElement("summary");
    summary.textContent = t("sources");
    const list = document.createElement("ul");
    appendText(list, "", `KOSIS · ${report.censusYear || 2015}`, "li");
    for (const source of Object.values(explorer.geographyMeta?.sources || {})) {
      const li = document.createElement("li");
      if (source.url) {
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = source.title || source.url;
        li.append(link);
      } else li.textContent = source.title || "";
      list.append(li);
    }
    for (const source of report.sources) {
      const li = document.createElement("li");
      if (source.url) {
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = source.title || source.url;
        li.append(link);
      } else li.textContent = source.title || "";
      list.append(li);
    }
    sources.append(summary, list);
    elements.report.append(sources);
  }

  function renderAll() {
    state.activeQuery = elements.query.value.trim();
    elements.query.setAttribute("placeholder", "");
    if (!state.activeQuery && queryHintIndex === -1) setQueryHint(t("bongwanSearchPlaceholder"), true);
    state.lastMatches = visibleMatches();
    renderSuggestions();
    renderMap();
    renderRegionPanel();
    renderResults();
    renderSecondarySections();
    renderReport();
  }

  elements.query.addEventListener("input", () => {
    state.selectedClanId = "";
    state.selectedRegionId = "";
    state.resultLimit = MAX_RESULTS;
    syncQueryHint();
    renderAll();
  });
  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      elements.query.value = "";
      state.selectedClanId = "";
      state.selectedRegionId = "";
      state.resultLimit = MAX_RESULTS;
      resetQueryHintRotation();
      syncQueryHint();
      renderAll();
    }
  });
  elements.clear.addEventListener("click", () => {
    elements.query.value = "";
    state.selectedClanId = "";
    state.selectedRegionId = "";
    state.resultLimit = MAX_RESULTS;
    resetQueryHintRotation();
    syncQueryHint();
    renderAll();
    elements.query.focus();
  });
  document.addEventListener("click", (event) => {
    if (elements.suggestions.hidden || elements.query.closest(".bongwan-search-wrap")?.contains(event.target)) return;
    elements.suggestions.hidden = true;
    elements.query.setAttribute("aria-expanded", "false");
  });
  resetQueryHintRotation();
  renderAll();
  return { render: renderAll, explorer };
}
