import {
  aggregateMatchesByLocation,
  bongwanSuggestions,
  createBongwanExplorer,
  getBongwanReport,
  searchBongwan,
} from "./bongwan_explorer.js?v=20260821-branch-selector-1";

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_REGION_CLANS = 6;
const RESULT_PAGE_SIZE = 16;
const MAX_RESULTS = RESULT_PAGE_SIZE;
const QUERY_HINT_EXAMPLES = ["김", "경주", "金海", "김해 김씨"];
const MAP_GRID_STEP = 17;
const MAP_GRID_RADIUS = 5.4;
const MAP_VIEWBOX_WIDTH = 720;
const MAP_VIEWBOX_HEIGHT = 900;
const MAP_MAX_ZOOM = 4.5;
const MAP_PROJECTION_ORIGIN_X = 104;
const MAP_REFERENCE_ISLANDS = [
  { id: "ulleungdo", longitude: 130.905, latitude: 37.485 },
  { id: "ulleungdo-east", longitude: 130.925, latitude: 37.485 },
  { id: "dokdo", longitude: 131.867, latitude: 37.242 },
];

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function projectCoordinate([longitude, latitude]) {
  return [MAP_PROJECTION_ORIGIN_X + (longitude - 124) * 70, 860 - (latitude - 32.5) * 75];
}

function geometryPath(geometry) {
  const ring = (coordinates) => coordinates.map((coordinate, index) => {
    const [x, y] = projectCoordinate(coordinate);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ") + " Z";
  if (geometry?.type === "Polygon") return geometry.coordinates.map(ring).join(" ");
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.flatMap((polygon) => polygon.map(ring)).join(" ");
  return "";
}

function pointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;
  let previous = ring[ring.length - 1];
  for (const current of ring) {
    const [currentX, currentY] = current;
    const [previousX, previousY] = previous;
    if ((currentY > y) !== (previousY > y) && x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX) inside = !inside;
    previous = current;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  const polygons = geometry?.type === "MultiPolygon" ? geometry.coordinates : geometry?.type === "Polygon" ? [geometry.coordinates] : [];
  return polygons.some((polygon) => polygon.length && pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

function buildDotGrid(features) {
  const grid = [];
  for (let y = 52, row = 0; y <= 868; y += MAP_GRID_STEP, row += 1) {
    for (let x = 45 + (row % 2 ? MAP_GRID_STEP / 2 : 0); x <= 690; x += MAP_GRID_STEP) {
      const geographicPoint = [124 + (x - MAP_PROJECTION_ORIGIN_X) / 70, 32.5 + (860 - y) / 75];
      if (features.some((feature) => pointInGeometry(geographicPoint, feature.geometry))) grid.push({ id: `${x.toFixed(1)}:${y.toFixed(1)}`, x, y });
    }
  }
  for (const island of MAP_REFERENCE_ISLANDS) {
    const [x, y] = projectCoordinate([island.longitude, island.latitude]);
    grid.push({ id: island.id, x, y });
  }
  return grid;
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

export function initializeBongwanExplorerUi({ bonGwanData, geography, hangnyeolData, placeCoordinates, regionGeoJson, t, formatNumber, getLocale }) {
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
    resultsSection: document.querySelector("#bongwan-results-section"),
    resultCount: document.querySelector("#bongwan-results-count"),
    results: document.querySelector("#bongwan-results"),
    outside: document.querySelector("#bongwan-outside"),
    uncertain: document.querySelector("#bongwan-uncertain"),
    report: document.querySelector("#bongwan-report"),
  };
  if (!elements.panel || !elements.query || !elements.map) return null;

  const explorer = createBongwanExplorer({ bonGwanData, geography, hangnyeolData, placeCoordinates });
  const state = { selectedClanId: "", selectedBranchId: "", selectedLocationKey: "", activeQuery: "", lastMatches: explorer.entries.map((entry) => ({ entry, relevance: 1 })), resultLimit: MAX_RESULTS };
  const features = regionGeoJson?.features || [];
  const dotGrid = buildDotGrid(features);
  const mapEntryBounds = dotGrid.reduce((bounds, dot) => ({
    minX: Math.min(bounds.minX, dot.x),
    maxX: Math.max(bounds.maxX, dot.x),
    minY: Math.min(bounds.minY, dot.y),
    maxY: Math.max(bounds.maxY, dot.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const mapEntryWidth = Math.max(1, mapEntryBounds.maxX - mapEntryBounds.minX);
  const mapEntryHeight = Math.max(1, mapEntryBounds.maxY - mapEntryBounds.minY);
  const mapEntryProgress = (dot) => Math.min(1, (
    ((dot.x - mapEntryBounds.minX) / mapEntryWidth +
      (dot.y - mapEntryBounds.minY) / mapEntryHeight) / 2
  ));
  const mapEntryFinalDotId = dotGrid.reduce((lastDot, dot) => (
    !lastDot || mapEntryProgress(dot) > mapEntryProgress(lastDot) ? dot : lastDot
  ), null)?.id || "";
  const mapViewport = { scale: 1, centerX: MAP_VIEWBOX_WIDTH / 2, centerY: MAP_VIEWBOX_HEIGHT / 2 };
  const mapViewportTarget = { ...mapViewport };
  const mapPointers = new Map();
  let lastPinch = null;
  let suppressMapClickUntil = 0;
  let queryHintIndex = -1;
  let queryHintTimer = null;
  let queryHintFadeTimer = null;
  let mapViewportAnimationFrame = 0;
  let wheelZoomAnimationFrame = 0;
  let pendingWheelZoom = null;
  let mapRenderKey = null;
  const scrollbarFadeTimers = new WeakMap();

  function setConditionalSectionVisibility(element, show) {
    if (!element || element.hidden === !show) return;
    element.hidden = !show;
    if (!show || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.classList.remove("is-entering");
    void element.offsetWidth;
    element.classList.add("is-entering");
    element.addEventListener("animationend", () => element.classList.remove("is-entering"), { once: true });
  }

  function viewportBoundsFor(viewport) {
    const width = MAP_VIEWBOX_WIDTH / viewport.scale;
    const height = MAP_VIEWBOX_HEIGHT / viewport.scale;
    return { width, height, left: viewport.centerX - width / 2, top: viewport.centerY - height / 2 };
  }

  function viewportBounds() {
    return viewportBoundsFor(mapViewport);
  }

  function constrainMapViewport(viewport = mapViewport) {
    const { width, height } = viewportBoundsFor(viewport);
    viewport.centerX = Math.max(width / 2, Math.min(MAP_VIEWBOX_WIDTH - width / 2, viewport.centerX));
    viewport.centerY = Math.max(height / 2, Math.min(MAP_VIEWBOX_HEIGHT - height / 2, viewport.centerY));
  }

  function updateMapViewport() {
    constrainMapViewport();
    const { left, top, width, height } = viewportBounds();
    elements.map.setAttribute("viewBox", `${left.toFixed(2)} ${top.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`);
  }

  function mapPointFromClient(clientX, clientY, viewport = mapViewport) {
    const bounds = elements.map.getBoundingClientRect();
    const boundsForViewport = viewportBoundsFor(viewport);
    return {
      x: boundsForViewport.left + (clientX - bounds.left) / bounds.width * boundsForViewport.width,
      y: boundsForViewport.top + (clientY - bounds.top) / bounds.height * boundsForViewport.height,
    };
  }

  function cancelMapViewportAnimation({ keepTarget = false } = {}) {
    if (mapViewportAnimationFrame) cancelAnimationFrame(mapViewportAnimationFrame);
    mapViewportAnimationFrame = 0;
    if (!keepTarget) Object.assign(mapViewportTarget, mapViewport);
  }

  function animateMapViewport(target) {
    constrainMapViewport(target);
    cancelMapViewportAnimation({ keepTarget: true });
    Object.assign(mapViewportTarget, target);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      Object.assign(mapViewport, target);
      updateMapViewport();
      return;
    }
    const start = { ...mapViewport };
    const startedAt = performance.now();
    const duration = 180;
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      mapViewport.scale = start.scale + (target.scale - start.scale) * eased;
      mapViewport.centerX = start.centerX + (target.centerX - start.centerX) * eased;
      mapViewport.centerY = start.centerY + (target.centerY - start.centerY) * eased;
      updateMapViewport();
      if (progress < 1) mapViewportAnimationFrame = requestAnimationFrame(step);
      else mapViewportAnimationFrame = 0;
    };
    mapViewportAnimationFrame = requestAnimationFrame(step);
  }

  function zoomMapAt(point, factor, { animate = true } = {}) {
    const source = animate ? mapViewportTarget : mapViewport;
    const previous = viewportBoundsFor(source);
    const nextScale = Math.max(1, Math.min(MAP_MAX_ZOOM, source.scale * factor));
    if (nextScale === source.scale) return;
    const relativeX = (point.x - previous.left) / previous.width;
    const relativeY = (point.y - previous.top) / previous.height;
    const target = { scale: nextScale, centerX: source.centerX, centerY: source.centerY };
    const next = viewportBoundsFor(target);
    target.centerX = point.x - relativeX * next.width + next.width / 2;
    target.centerY = point.y - relativeY * next.height + next.height / 2;
    if (animate) animateMapViewport(target);
    else {
      cancelMapViewportAnimation();
      Object.assign(mapViewport, target);
      Object.assign(mapViewportTarget, target);
      updateMapViewport();
    }
  }

  function initializeMapGestures() {
    updateMapViewport();
    elements.map.addEventListener("wheel", (event) => {
      event.preventDefault();
      const point = mapPointFromClient(event.clientX, event.clientY, mapViewportTarget);
      const deltaY = Math.max(-160, Math.min(160, event.deltaY));
      if (pendingWheelZoom) {
        pendingWheelZoom.point = point;
        pendingWheelZoom.deltaY = Math.max(-240, Math.min(240, pendingWheelZoom.deltaY + deltaY));
      } else {
        pendingWheelZoom = { point, deltaY };
      }
      if (wheelZoomAnimationFrame) return;
      wheelZoomAnimationFrame = requestAnimationFrame(() => {
        wheelZoomAnimationFrame = 0;
        const pending = pendingWheelZoom;
        pendingWheelZoom = null;
        if (!pending) return;
        zoomMapAt(pending.point, Math.exp(-pending.deltaY * 0.0012));
      });
    }, { passive: false });
    elements.map.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      mapPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY, moved: false });
      if (event.pointerType !== "mouse") elements.map.setPointerCapture?.(event.pointerId);
    });
    elements.map.addEventListener("pointermove", (event) => {
      const previous = mapPointers.get(event.pointerId);
      if (!previous) return;
      const next = { clientX: event.clientX, clientY: event.clientY, moved: previous.moved };
      mapPointers.set(event.pointerId, next);
      const pointers = [...mapPointers.values()];
      if (pointers.length >= 2) {
        const [first, second] = pointers;
        const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
        const midpoint = { clientX: (first.clientX + second.clientX) / 2, clientY: (first.clientY + second.clientY) / 2 };
        if (lastPinch && distance > 0) {
          zoomMapAt(mapPointFromClient(midpoint.clientX, midpoint.clientY), distance / lastPinch.distance, { animate: false });
          next.moved = true;
        }
        lastPinch = { distance, midpoint };
        return;
      }
      lastPinch = null;
      const bounds = elements.map.getBoundingClientRect();
      const viewport = viewportBounds();
      const distanceX = event.clientX - previous.clientX;
      const distanceY = event.clientY - previous.clientY;
      if (Math.hypot(distanceX, distanceY) < 2) return;
      next.moved = true;
      elements.map.classList.add("is-dragging");
      cancelMapViewportAnimation();
      mapViewport.centerX -= distanceX / bounds.width * viewport.width;
      mapViewport.centerY -= distanceY / bounds.height * viewport.height;
      updateMapViewport();
      Object.assign(mapViewportTarget, mapViewport);
    });
    const endGesture = (event) => {
      const pointer = mapPointers.get(event.pointerId);
      if (pointer?.moved || mapPointers.size > 1) suppressMapClickUntil = Date.now() + 250;
      mapPointers.delete(event.pointerId);
      if (!mapPointers.size) elements.map.classList.remove("is-dragging");
      lastPinch = null;
    };
    elements.map.addEventListener("pointerup", endGesture);
    elements.map.addEventListener("pointercancel", endGesture);
  }

  function initializeFadingPanelScrollbars() {
    for (const panel of [elements.regionPanel, elements.report]) {
      if (!panel) continue;
      panel.addEventListener("scroll", () => {
        panel.classList.add("is-scrolling");
        window.clearTimeout(scrollbarFadeTimers.get(panel));
        scrollbarFadeTimers.set(panel, window.setTimeout(() => {
          panel.classList.remove("is-scrolling");
          scrollbarFadeTimers.delete(panel);
        }, 700));
      }, { passive: true });
    }
  }

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

  function selectedLocationData() {
    return aggregateMatchesByLocation(explorer, state.lastMatches).find((location) => location.locationKey === state.selectedLocationKey) || null;
  }

  function morphReportFrom(sourceBounds) {
    if (!sourceBounds || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.requestAnimationFrame(() => {
      const report = elements.report;
      if (!report || report.hidden) return;
      const targetBounds = report.getBoundingClientRect();
      if (!targetBounds.width || !targetBounds.height) return;
      const translateX = sourceBounds.left - targetBounds.left;
      const translateY = sourceBounds.top - targetBounds.top;
      const scaleX = Math.max(0.18, sourceBounds.width / targetBounds.width);
      const scaleY = Math.max(0.18, sourceBounds.height / targetBounds.height);
      report.classList.add("is-morphing");
      report.style.transformOrigin = "top left";
      report.style.transition = "none";
      report.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
      report.style.opacity = "0.86";
      void report.offsetWidth;
      window.requestAnimationFrame(() => {
        report.style.transition = "transform 300ms cubic-bezier(0.2, 0, 0, 1), opacity 220ms ease-out";
        report.style.transform = "translate(0, 0) scale(1, 1)";
        report.style.opacity = "1";
      });
      const cleanup = () => {
        report.classList.remove("is-morphing");
        report.style.removeProperty("transform-origin");
        report.style.removeProperty("transition");
        report.style.removeProperty("transform");
        report.style.removeProperty("opacity");
      };
      window.setTimeout(cleanup, 340);
    });
  }

  function openClan(clanId) {
    const sourceBounds = elements.regionPanel && !elements.regionPanel.hidden
      ? elements.regionPanel.getBoundingClientRect()
      : null;
    state.selectedClanId = clanId;
    state.selectedBranchId = "";
    const entry = explorer.byId.get(clanId);
    state.selectedLocationKey = entry?.location?.coordinateKey || "";
    renderAll();
    morphReportFrom(sourceBounds);
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
    const origin = entry.location.coordinateKey
      ? entry.bonGwanName
      : entry.location.locationType === "peninsula"
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
            state.selectedLocationKey = "";
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

  function updateMapSelection() {
    const dimOtherLocations = Boolean(state.selectedLocationKey);
    for (const marker of elements.map.querySelectorAll(".bongwan-heat-dot, .bongwan-location-pulse")) {
      const selected = marker.dataset.locationKeys?.split("\u001f").includes(state.selectedLocationKey) || false;
      marker.classList.toggle("is-selected", selected);
      marker.classList.toggle("is-dimmed", dimOtherLocations && !selected);
    }
    for (const hit of elements.map.querySelectorAll(".bongwan-location-hit")) {
      const selected = hit.dataset.locationKeys?.split("\u001f").includes(state.selectedLocationKey) || false;
      hit.classList.toggle("is-selected", selected);
      hit.setAttribute("aria-pressed", String(selected));
    }
  }

  function renderMap() {
    elements.map.classList.toggle("has-active-query", Boolean(state.activeQuery));
    const renderKey = state.lastMatches.map(({ entry }) => entry.clanId).join("\u001f");
    if (renderKey === mapRenderKey) {
      updateMapSelection();
      return;
    }
    mapRenderKey = renderKey;
    const locations = aggregateMatchesByLocation(explorer, state.lastMatches).map((location) => {
      const [x, y] = projectCoordinate([location.longitude, location.latitude]);
      return { ...location, x, y, weight: 0.8 + Math.log10(Math.max(1, location.population)) };
    });
    const pointBuckets = new Map();
    for (const location of locations) {
      let nearest = null;
      let distanceSquared = Infinity;
      for (const dot of dotGrid) {
        const candidateDistance = (dot.x - location.x) ** 2 + (dot.y - location.y) ** 2;
        if (candidateDistance < distanceSquared) {
          nearest = dot;
          distanceSquared = candidateDistance;
        }
      }
      if (nearest) {
        const bucket = pointBuckets.get(nearest.id) || [];
        bucket.push(location);
        pointBuckets.set(nearest.id, bucket);
      }
    }
    const maxHeat = Math.max(1, ...dotGrid.map((dot) => locations.reduce((sum, location) => {
      const distanceSquared = (dot.x - location.x) ** 2 + (dot.y - location.y) ** 2;
      return sum + location.weight * Math.exp(-distanceSquared / 1250);
    }, 0)));
    elements.map.replaceChildren();
    for (const dot of dotGrid) {
      const bucket = pointBuckets.get(dot.id);
      const heat = locations.reduce((sum, location) => {
        const distanceSquared = (dot.x - location.x) ** 2 + (dot.y - location.y) ** 2;
        return sum + location.weight * Math.exp(-distanceSquared / 1250);
      }, 0) / maxHeat;
      const circle = svgElement("circle", {
        cx: dot.x.toFixed(1), cy: dot.y.toFixed(1), r: MAP_GRID_RADIUS,
        "class": `bongwan-heat-dot${bucket?.length ? " is-selectable" : ""}`,
      });
      circle.dataset.locationKeys = bucket?.map((location) => location.locationKey).join("\u001f") || "";
      circle.style.setProperty("--heat-intensity", heat.toFixed(3));
      const pinDelay = 0.04 + mapEntryProgress(dot) * 0.72;
      circle.style.setProperty("--map-pin-delay", `${pinDelay.toFixed(3)}s`);
      if (dot.id === mapEntryFinalDotId) circle.dataset.mapEntryFinalPin = "true";
      elements.map.append(circle);
      if (!bucket?.length) continue;
      const pulse = svgElement("circle", {
        cx: dot.x.toFixed(1), cy: dot.y.toFixed(1), r: "10",
        "class": "bongwan-location-pulse",
        "aria-hidden": "true",
      });
      pulse.dataset.locationKeys = bucket.map((location) => location.locationKey).join("\u001f");
      pulse.style.setProperty("--pulse-delay", `${-((dot.x + dot.y) / MAP_GRID_STEP % 7) * 0.3}s`);
      elements.map.append(pulse);
      const selected = bucket.some((location) => location.locationKey === state.selectedLocationKey);
      const hit = svgElement("circle", {
        cx: dot.x.toFixed(1), cy: dot.y.toFixed(1), r: "10",
        "class": `bongwan-location-hit${selected ? " is-selected" : ""}`,
        tabindex: "0", role: "button", "aria-pressed": String(selected),
        "aria-label": bucket.map((location) => `${location.name} ${location.hanja}`).join(", "),
      });
      hit.dataset.locationKeys = bucket.map((location) => location.locationKey).join("\u001f");
      const show = (event) => {
        if (!state.selectedLocationKey) showLocationPopover(bucket, event);
      };
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("focus", show);
      hit.addEventListener("pointerleave", () => { if (!state.selectedLocationKey) hideRegionPopover(); });
      hit.addEventListener("click", () => {
        if (Date.now() >= suppressMapClickUntil) selectLocation(bucket[0].locationKey);
      });
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectLocation(bucket[0].locationKey);
        }
      });
      elements.map.append(hit);
    }
    updateMapSelection();
  }

  function locationContent(location, persistent = false) {
    const content = document.createElement("div");
    if (!location) return content;
    appendText(content, "bongwan-region-title", `${location.name} ${location.hanja}`.trim(), "h3");
    if (!location.entries.length) {
      appendText(content, "bongwan-region-empty", t("noMatchingClans"));
      return content;
    }
    appendText(content, "bongwan-region-total", `${formatNumber(location.population)} · ${location.entries.length} ${t("bongwanClans")}`);
    appendText(content, "bongwan-region-label", t("matchingClans"));
    const list = document.createElement("div");
    list.className = "bongwan-region-clans";
    for (const entry of location.entries.slice(0, MAX_REGION_CLANS)) list.append(makeClanButton(entry, "bongwan-region-clan"));
    content.append(list);
    if (location.entries.length > MAX_REGION_CLANS) appendText(content, "bongwan-region-more", t("showMore", { count: location.entries.length - MAX_REGION_CLANS }));
    return content;
  }

  function showLocationPopover(locations, event) {
    const content = document.createElement("div");
    content.className = "bongwan-popover-locations";
    for (const location of locations) content.append(locationContent(location));
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

  function selectLocation(locationKey) {
    hideRegionPopover();
    state.selectedLocationKey = state.selectedLocationKey === locationKey ? "" : locationKey;
    state.selectedClanId = "";
    renderAll();
  }

  function renderRegionPanel() {
    const data = selectedLocationData();
    elements.regionPanel.replaceChildren();
    elements.regionPanel.hidden = !data || Boolean(state.selectedClanId);
    if (!data || state.selectedClanId) return;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "bongwan-panel-close";
    close.textContent = "×";
    close.setAttribute("aria-label", t("close"));
    close.addEventListener("click", () => { state.selectedLocationKey = ""; renderAll(); });
    elements.regionPanel.append(close, locationContent(data, true));
  }

  function renderResults() {
    const shouldShow = Boolean(state.activeQuery && !state.selectedClanId && elements.suggestions.hidden);
    setConditionalSectionVisibility(elements.resultsSection, shouldShow);
    if (!shouldShow) {
      elements.resultCount.textContent = "";
      elements.results.replaceChildren();
      return;
    }
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
      const shouldShow = Boolean(state.activeQuery) && filtered.length > 0;
      setConditionalSectionVisibility(element, shouldShow);
      if (!shouldShow) return;
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
    const close = document.createElement("button");
    close.type = "button";
    close.className = "bongwan-report-close";
    close.textContent = "×";
    close.setAttribute("aria-label", t("close"));
    close.addEventListener("click", () => {
      state.selectedClanId = "";
      state.selectedBranchId = "";
      renderAll();
    });
    appendText(header, "bongwan-report-name", entry.displayHangul, "h2");
    appendText(header, "bongwan-report-hanja", entry.displayHanja);
    header.append(close);
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
    state.selectedLocationKey = "";
    state.resultLimit = MAX_RESULTS;
    syncQueryHint();
    renderAll();
  });
  elements.query.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      elements.query.value = "";
      state.selectedClanId = "";
      state.selectedLocationKey = "";
      state.resultLimit = MAX_RESULTS;
      resetQueryHintRotation();
      syncQueryHint();
      renderAll();
    }
  });
  elements.clear.addEventListener("click", () => {
    elements.query.value = "";
    state.selectedClanId = "";
    state.selectedLocationKey = "";
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
    renderResults();
  });
  resetQueryHintRotation();
  initializeMapGestures();
  initializeFadingPanelScrollbars();
  renderAll();
  return { render: renderAll, openClan, explorer };
}
