import { FRUIT_TYPES } from "../core/constants.js";
import { positionToIndex } from "../utils/grid-utils.js";

const DATA_FRUIT_META = Object.freeze({
  apple: { label: "Táo", icon: "🍎" },
  banana: { label: "Chuối", icon: "🍌" },
  grape: { label: "Nho", icon: "🍇" },
  eggplant: { label: "Cà tím", icon: "🍆" }
});

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
  layers.forEach((layer) => addFruitCounts(counts, layer.recipe));
  const unknownCount = layers.reduce((sum, layer) => sum + (layer.unknownItems ?? []).reduce((layerSum, entry) => layerSum + (Number(entry.count) || 0), 0), 0);
  return {
    counts,
    configured: countFruitItems(counts) + unknownCount,
    target: Math.max(1, layers.length) * 9,
    layerCount: layers.length
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
    trayTarget: trays.reduce((sum, tray) => sum + tray.target, 0)
  };
}

function createFruitChips(counts, { includeZero = false } = {}) {
  const chips = document.createElement("div");
  chips.className = "data-fruit-chips";
  const types = FRUIT_TYPES.filter((type) => includeZero || counts[type] > 0);
  if (types.length === 0) {
    const empty = document.createElement("span");
    empty.className = "data-fruit-chip empty";
    empty.textContent = "Chưa có fruit";
    chips.appendChild(empty);
    return chips;
  }
  types.forEach((type) => {
    const chip = document.createElement("span");
    chip.className = `data-fruit-chip${counts[type] === 0 ? " empty" : ""}`;
    chip.textContent = `${DATA_FRUIT_META[type].icon} ${counts[type]}`;
    chip.title = `${DATA_FRUIT_META[type].label}: ${counts[type]}`;
    chips.appendChild(chip);
  });
  return chips;
}

function createSummaryCard(title, badge) {
  const card = document.createElement("section");
  card.className = "data-summary-card";
  const header = document.createElement("header");
  const heading = document.createElement("h3");
  const count = document.createElement("span");
  heading.textContent = title;
  count.textContent = badge;
  header.append(heading, count);
  const list = document.createElement("div");
  list.className = "data-summary-list";
  card.append(header, list);
  return { card, list };
}

function renderFruitBalance(summary) {
  const { card, list } = createSummaryCard("Fruit trên map / khay cần", `${summary.fruitKinds}/${FRUIT_TYPES.length} loại`);
  FRUIT_TYPES.forEach((type) => {
    const current = summary.mapCounts[type];
    const required = summary.requiredCounts[type];
    const row = document.createElement("div");
    row.className = `fruit-balance-row${current === required ? " balanced" : ""}`;
    const icon = document.createElement("i");
    const copy = document.createElement("span");
    const label = document.createElement("strong");
    const note = document.createElement("small");
    const value = document.createElement("span");
    icon.textContent = DATA_FRUIT_META[type].icon;
    label.textContent = DATA_FRUIT_META[type].label;
    note.textContent = current === required ? "Đã cân bằng" : current < required ? `Thiếu ${required - current}` : `Dư ${current - required}`;
    value.className = "fruit-balance-value";
    value.textContent = `${current}/${required}`;
    value.title = `${current} fruit trên map / ${required} fruit khay cần`;
    copy.append(label, note);
    row.append(icon, copy, value);
    list.appendChild(row);
  });
  return card;
}

function renderTrayDetails(summary) {
  const { card, list } = createSummaryCard("Chi tiết khay", `${summary.trays.length} khay`);
  if (summary.trays.length === 0) {
    const row = document.createElement("div");
    row.className = "data-detail-row";
    row.textContent = "Chưa có khay trên map.";
    list.appendChild(row);
  }
  summary.trays.forEach((tray, index) => {
    const row = document.createElement("div");
    row.className = "data-detail-row";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const note = document.createElement("small");
    const total = document.createElement("span");
    copy.className = "data-detail-copy";
    title.textContent = `Khay ID ${tray.item.trayId ?? index}`;
    note.textContent = `Index ${tray.index} · ${tray.layerCount} layer`;
    total.className = "data-detail-total";
    total.textContent = `${tray.configured}/${tray.target} item`;
    total.title = "Số item đã setup / số item cần setup";
    copy.append(title, note);
    row.append(copy, total, createFruitChips(tray.counts));
    list.appendChild(row);
  });
  return card;
}

function renderLayerDetails(summary) {
  const { card, list } = createSummaryCard("Fruit theo layer", `${summary.layers.length} layer`);
  summary.layers.forEach((layer, index) => {
    const row = document.createElement("div");
    row.className = "data-detail-row";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const note = document.createElement("small");
    const total = document.createElement("span");
    copy.className = "data-detail-copy";
    title.textContent = layer.name || `Layer ${String(index + 1).padStart(2, "0")}`;
    note.textContent = `${layer.kinds} loại fruit`;
    total.className = "data-detail-total";
    total.textContent = `${layer.total} quả`;
    copy.append(title, note);
    row.append(copy, total, createFruitChips(layer.counts));
    list.appendChild(row);
  });
  return card;
}

export function renderDataSummary(container, state) {
  const summary = collectEditorDataSummary(state);
  container.innerHTML = "";
  container.append(renderFruitBalance(summary), renderTrayDetails(summary), renderLayerDetails(summary));
  return summary;
}
