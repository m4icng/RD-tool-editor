import { FRUIT_TYPES } from "../core/constants.js";
import { BLOCK_ITEM_GLYPH, applyBlockItemVisual, blockLabelForFruitType, createBlockSwatch } from "../core/block-visuals.js";
import { positionToIndex } from "../utils/grid-utils.js";

const DATA_FRUIT_META = Object.freeze(Object.fromEntries(FRUIT_TYPES.map((type) => [
  type,
  { label: blockLabelForFruitType(type), icon: BLOCK_ITEM_GLYPH }
])));

function emptyFruitCounts() {
  return Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
}

function addFruitCounts(target, source) {
  FRUIT_TYPES.forEach((type) => { target[type] += Number(source?.[type]) || 0; });
}

function fruitCountsFromCells(cells) {
  const counts = emptyFruitCounts();
  Object.values(cells ?? {}).forEach((cell) => {
    if (cell.item?.kind === "fruit" && FRUIT_TYPES.includes(cell.item.fruitType)) counts[cell.item.fruitType] += 1;
  });
  return counts;
}

function countFruitItems(counts) {
  return FRUIT_TYPES.reduce((sum, type) => sum + counts[type], 0);
}

function countFruitKinds(counts) {
  return FRUIT_TYPES.filter((type) => counts[type] > 0).length;
}

function trayRecipeSummary(item) {
  const counts = emptyFruitCounts();
  if (item.kind === "truck") {
    if (FRUIT_TYPES.includes(item.fruitType)) counts[item.fruitType] = Number(item.capacity) || 0;
    const target = Number(item.capacity) || 0;
    return { counts, configured: target, target, layerCount: 1 };
  }
  const layers = item.trayLayers ?? [];
  const issues = [];
  layers.forEach((layer) => addFruitCounts(counts, layer.recipe));
  layers.forEach((layer, index) => {
    const hasSelectedBlock = FRUIT_TYPES.some((type) => (Number(layer.recipe?.[type]) || 0) > 0);
    if (!hasSelectedBlock) issues.push(`Tray #${item.trayId ?? "?"} - Layer ${layer.layer ?? index} chưa chọn Block`);
  });
  const unknownCount = layers.reduce((sum, layer) => sum + (layer.unknownItems ?? []).reduce((layerSum, entry) => layerSum + (Number(entry.count) || 0), 0), 0);
  return {
    counts,
    configured: countFruitItems(counts) + unknownCount,
    target: Math.max(1, layers.length) * 9,
    layerCount: layers.length,
    issues
  };
}

export function collectEditorDataSummary(state) {
  const layers = (state.layers ?? []).map((layer, index) => {
    const counts = fruitCountsFromCells(layer.cells);
    return {
      id: layer.id,
      name: layer.name ?? `Layer ${String(index + 1).padStart(2, "0")}`,
      counts,
      total: countFruitItems(counts),
      kinds: countFruitKinds(counts)
    };
  });
  const mapCounts = emptyFruitCounts();
  layers.forEach((layer) => addFruitCounts(mapCounts, layer.counts));

  const trays = Object.entries(state.sharedCells ?? {}).flatMap(([key, cell]) => {
    if (!["tray", "truck"].includes(cell.item?.kind)) return [];
    const [x, y] = key.split(",").map(Number);
    return [{ key, x, y, index: positionToIndex(x, y, state.grid.columns), item: cell.item, ...trayRecipeSummary(cell.item) }];
  });
  const requiredCounts = emptyFruitCounts();
  trays.forEach((tray) => addFruitCounts(requiredCounts, tray.counts));

  return {
    layers,
    trays,
    mapCounts,
    requiredCounts,
    fruitKinds: countFruitKinds(mapCounts),
    totalFruits: countFruitItems(mapCounts),
    trayConfigured: trays.reduce((sum, tray) => sum + tray.configured, 0),
    trayTarget: trays.reduce((sum, tray) => sum + tray.target, 0),
    trayIssues: trays.flatMap((tray) => tray.issues ?? [])
  };
}

// ---------------------------------------------------------------------------
// Render — Item Balance section
// ---------------------------------------------------------------------------

function renderItemBalance(summary) {
  const visibleTypes = FRUIT_TYPES.filter((type) => summary.mapCounts[type] > 0 || summary.requiredCounts[type] > 0);
  const section = document.createElement("section");
  section.className = "data-summary-card";

  // Header
  const header = document.createElement("header");
  const heading = document.createElement("h3");
  heading.textContent = "Item Balance";
  const badge = document.createElement("span");
  badge.textContent = `${visibleTypes.length} loại`;
  header.append(heading, badge);
  section.appendChild(header);

  // Body
  const list = document.createElement("div");
  list.className = "data-summary-list";

  if (visibleTypes.length === 0) {
    const row = document.createElement("div");
    row.className = "item-balance-empty";
    row.textContent = "Chưa có item trên map hoặc requirement trong khay.";
    list.appendChild(row);
    section.appendChild(list);
    return { element: section, issues: [] };
  }

  const issues = [];

  visibleTypes.forEach((type) => {
    const mapCount = summary.mapCounts[type];
    const trayCount = summary.requiredCounts[type];
    const diff = mapCount - trayCount;
    const balanced = diff === 0;

    const row = document.createElement("div");
    row.className = `item-balance-row${balanced ? " balanced" : ""}`;

    // Color swatch
    const swatch = createBlockSwatch(type);
    swatch.className = "item-balance-swatch";
    applyBlockItemVisual(swatch, type);

    // Label
    const label = document.createElement("span");
    label.className = "item-balance-label";
    label.textContent = DATA_FRUIT_META[type].label;

    // Map count
    const mapEl = document.createElement("span");
    mapEl.className = "item-balance-count";
    mapEl.innerHTML = `<small>MAP</small> ${mapCount}`;

    // Tray count
    const trayEl = document.createElement("span");
    trayEl.className = "item-balance-count";
    trayEl.innerHTML = `<small>TRAY</small> ${trayCount}`;

    // Status
    const status = document.createElement("span");
    status.className = "item-balance-status";

    if (balanced) {
      status.textContent = "✓";
      status.classList.add("ok");
    } else {
      const warningText = diff > 0 ? `Khay thiếu ${diff}` : `Map thiếu ${Math.abs(diff)}`;
      status.textContent = `⚠ ${warningText}`;
      status.classList.add("warn");
      issues.push(`${DATA_FRUIT_META[type].label}: ${warningText}`);
    }

    row.append(swatch, label, mapEl, trayEl, status);
    list.appendChild(row);
  });

  section.appendChild(list);
  return { element: section, issues };
}

// ---------------------------------------------------------------------------
// Render — Level Check section
// ---------------------------------------------------------------------------

function renderLevelCheck(issues) {
  const section = document.createElement("section");
  section.className = "data-summary-card level-check-card";

  const header = document.createElement("header");
  const heading = document.createElement("h3");
  heading.textContent = "Level Check";
  header.appendChild(heading);
  section.appendChild(header);

  const body = document.createElement("div");
  body.className = "level-check-body";

  if (issues.length === 0) {
    const ok = document.createElement("div");
    ok.className = "level-check-status ok";
    ok.textContent = "✓ Level hợp lệ";
    body.appendChild(ok);
  } else {
    const warn = document.createElement("div");
    warn.className = "level-check-status warn";
    warn.textContent = `⚠ ${issues.length} vấn đề`;
    body.appendChild(warn);

    const list = document.createElement("ul");
    list.className = "level-check-issues";
    issues.forEach((issue) => {
      const li = document.createElement("li");
      li.textContent = issue;
      list.appendChild(li);
    });
    body.appendChild(list);
  }

  section.appendChild(body);
  return section;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderDataSummary(container, state) {
  const summary = collectEditorDataSummary(state);
  container.innerHTML = "";
  const { element: balanceEl, issues } = renderItemBalance(summary);
  container.appendChild(balanceEl);
  container.appendChild(renderLevelCheck([...summary.trayIssues, ...issues]));
  return summary;
}
