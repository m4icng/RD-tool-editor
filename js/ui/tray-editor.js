import { FRUIT_TYPES } from "../core/constants.js";
import {
  applyBlockItemVisual,
  blockItemIdFromFruitType,
  blockColorNameForFruitType,
  blockOptionLabelForFruitType,
  blockVisualMeta
} from "../core/block-visuals.js";
import {
  cellKey,
  getTrayVisualPosition,
  indexToPosition,
  isInsideGrid,
  isTrayVisualInsideGrid,
  positionToIndex,
} from "../utils/grid-utils.js";
import { createId } from "../utils/id-generator.js";

export const TRAY_CAPACITY = 9;

const FRUIT_META = Object.freeze(Object.fromEntries(FRUIT_TYPES.map((type) => [
  type,
  {
    label: blockColorNameForFruitType(type),
    optionLabel: blockOptionLabelForFruitType(type),
    itemId: blockItemIdFromFruitType(type)
  }
])));

function createEmptyRecipe() {
  return Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
}

function trayLayerTotal(layer) {
  const known = FRUIT_TYPES.reduce((sum, type) => sum + (Number(layer?.recipe?.[type]) || 0), 0);
  return known + (layer?.unknownItems ?? []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
}

function selectedTrayLayerBlock(recipe) {
  return FRUIT_TYPES.find((type) => (Number(recipe[type]) || 0) > 0) ?? null;
}

function selectedTrayLayerAmount(recipe) {
  const selected = selectedTrayLayerBlock(recipe);
  return Math.max(0, Number(recipe[selected]) || 0);
}

function selectedTrayLayerBlockId(recipe) {
  const selectedType = selectedTrayLayerBlock(recipe);
  return selectedType ? blockItemIdFromFruitType(selectedType) : null;
}

function blockTypeFromSelectedBlockId(selectedBlockId) {
  if (selectedBlockId == null) return null;
  return FRUIT_TYPES.find((type) => blockItemIdFromFruitType(type) === selectedBlockId) ?? null;
}

function fruitTypeFromBlockId(blockId) {
  const selectedBlockId = Math.floor(Number(blockId));
  if (!Number.isInteger(selectedBlockId)) return null;
  return blockTypeFromSelectedBlockId(selectedBlockId);
}

function normalizeTrayAmount(amount) {
  if (amount === "") return null;
  const value = Math.floor(Number(amount));
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.min(TRAY_CAPACITY, value));
}

function setSingleBlockRecipe(trayLayer, fruitType, amount) {
  const normalizedAmount = normalizeTrayAmount(amount);
  if (normalizedAmount === null) return false;
  trayLayer.recipe = createEmptyRecipe();
  trayLayer.recipe[fruitType] = normalizedAmount;
  return true;
}

function createBlockDropLabel(selectedBlockId) {
  const label = document.createElement("span");
  label.className = `tray-block-drop-label${selectedBlockId == null ? " empty" : ""}`;
  const selectedType = blockTypeFromSelectedBlockId(selectedBlockId);
  if (!selectedType) {
    label.textContent = "Chọn Block";
    return label;
  }
  const swatch = document.createElement("span");
  applyBlockItemVisual(swatch, selectedType);
  const name = document.createElement("strong");
  name.textContent = FRUIT_META[selectedType].label;
  const id = document.createElement("em");
  id.textContent = `ID ${selectedBlockId}`;
  label.append(swatch, name, id);
  return label;
}

export function getSelectedTrayContext(state) {
  const selectedCell = state.selectedCell ?? state.activeTrayCell;
  if (!selectedCell) return null;
  const { x, y } = selectedCell;
  const cell = state.sharedCells?.[cellKey(x, y)];
  if (!cell || !["tray", "truck"].includes(cell.item?.kind)) return null;
  return { cell, item: cell.item, x, y };
}

export function addTrayLayer(state) {
  const context = getSelectedTrayContext(state);
  if (!context || context.item.kind !== "tray") return false;
  context.item.trayLayers ??= [];
  const nextLayer = Math.max(-1, ...context.item.trayLayers.map((layer, index) => Number.isInteger(layer.layer) ? layer.layer : index)) + 1;
  context.item.trayLayers.push({ id: createId("tray-layer"), layer: nextLayer, recipe: createEmptyRecipe(), unknownItems: [] });
  return true;
}

export function setTrayVisualIndex(state, index) {
  const context = getSelectedTrayContext(state);
  const value = Math.floor(Number(index));
  if (!context || context.item.kind !== "tray" || !Number.isInteger(value)) return { changed: false, reason: "invalid-index" };
  const total = state.grid.columns * state.grid.rows;
  if (value < 0 || value >= total) return { changed: false, reason: "outside-grid" };
  const trayPosition = indexToPosition(value, state.grid.columns);
  if (!isInsideGrid(state.grid, trayPosition.x, trayPosition.y)) return { changed: false, reason: "outside-grid" };
  if (!isTrayVisualInsideGrid(state.grid, { ...context.item, trayPosition }, context)) return { changed: false, reason: "footprint-outside-grid" };
  const current = getTrayVisualPosition(context.item, context);
  if (current.x === trayPosition.x && current.y === trayPosition.y) return { changed: false, reason: null };
  context.item.trayPosition = trayPosition;
  return { changed: true, reason: null };
}

export function changeTrayLayerRecipe(state, layerIndex, fruitType, delta) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  if (!trayLayer || !FRUIT_TYPES.includes(fruitType) || ![-1, 1].includes(delta)) return false;
  trayLayer.recipe = { ...createEmptyRecipe(), ...(trayLayer.recipe ?? {}) };
  const current = Number(trayLayer.recipe[fruitType]) || 0;
  const total = trayLayerTotal(trayLayer);
  if (delta > 0 && total >= TRAY_CAPACITY) return false;
  if (delta < 0 && current <= 0) return false;
  trayLayer.recipe[fruitType] = current + delta;
  return true;
}

export function setTrayLayerBlock(state, layerIndex, blockId) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  const fruitType = fruitTypeFromBlockId(blockId);
  if (!trayLayer || !FRUIT_TYPES.includes(fruitType)) return false;
  return setSingleBlockRecipe(trayLayer, fruitType, TRAY_CAPACITY);
}

export function setTrayLayerAmount(state, layerIndex, amount) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  if (!trayLayer) return false;
  trayLayer.recipe = { ...createEmptyRecipe(), ...(trayLayer.recipe ?? {}) };
  const selectedType = selectedTrayLayerBlock(trayLayer.recipe);
  if (!selectedType) return false;
  return setSingleBlockRecipe(trayLayer, selectedType, amount);
}

export function removeTrayLayerUnknownItem(state, layerIndex, itemId) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  if (!trayLayer) return false;
  const before = trayLayer.unknownItems?.length ?? 0;
  trayLayer.unknownItems = (trayLayer.unknownItems ?? []).filter((item) => String(item.itemId) !== String(itemId));
  return trayLayer.unknownItems.length !== before;
}

export function moveTrayLayer(state, fromIndex, toIndex) {
  const context = getSelectedTrayContext(state);
  const layers = context?.item?.kind === "tray" ? context.item.trayLayers : null;
  if (!layers || fromIndex < 0 || fromIndex >= layers.length || toIndex < 0 || toIndex >= layers.length || fromIndex === toIndex) return false;
  const layerNumbers = layers.map((layer, index) => Number.isInteger(layer.layer) ? layer.layer : index).sort((a, b) => a - b);
  const [moved] = layers.splice(fromIndex, 1);
  layers.splice(toIndex, 0, moved);
  layers.forEach((layer, index) => { layer.layer = layerNumbers[index]; });
  return true;
}

export function removeTrayLayer(state, layerIndex) {
  const context = getSelectedTrayContext(state);
  const layers = context?.item?.kind === "tray" ? context.item.trayLayers : null;
  if (!layers || layerIndex < 0 || layerIndex >= layers.length) return false;
  layers.splice(layerIndex, 1);
  layers.forEach((layer, index) => { layer.layer = index; });
  return true;
}

export function convertLegacyTruckToTray(state) {
  const context = getSelectedTrayContext(state);
  if (!context || context.item.kind !== "truck") return false;
  const legacyFruit = FRUIT_TYPES.includes(context.item.fruitType) ? context.item.fruitType : "apple";
  const recipe = createEmptyRecipe();
  recipe[legacyFruit] = TRAY_CAPACITY;
  context.cell.item = {
    id: context.item.id ?? "tray-empty",
    trayId: context.item.trayId,
    kind: "tray",
    category: "item",
    label: "Khay chứa",
    icon: "🧺",
    capacity: TRAY_CAPACITY,
    trayPosition: getTrayVisualPosition(context.item, context),
    trayLayers: [{ id: createId("tray-layer"), recipe }]
  };
  return true;
}

function trayEntries(state) {
  return Object.entries(state.sharedCells ?? {})
    .filter(([, cell]) => ["tray", "truck"].includes(cell.item?.kind))
    .map(([key, cell]) => {
      const [x, y] = key.split(",").map(Number);
      return { key, cell, x, y };
    });
}

function createTrayList(trays, selectedCell, width) {
  const list = document.createElement("div");
  list.className = "tray-list";
  trays.forEach((tray, index) => {
    const selected = selectedCell?.x === tray.x && selectedCell?.y === tray.y;
    const row = document.createElement("button");
    row.type = "button";
    row.className = `tray-row${selected ? " active" : ""}`;
    row.dataset.trayX = String(tray.x);
    row.dataset.trayY = String(tray.y);
    row.innerHTML = '<span class="tray-row-icon"></span><span class="tray-row-copy"><strong></strong><span></span></span><span class="tray-row-order"></span>';
    row.children[0].textContent = tray.cell.item.icon ?? "🧺";
    row.children[1].children[0].textContent = tray.cell.item.kind === "truck" ? `${tray.cell.item.label} · cũ` : "Khay chứa";
    const count = tray.cell.item.trayLayers?.length ?? 0;
    const visual = getTrayVisualPosition(tray.cell.item, tray);
    row.children[1].children[1].textContent = `deliver ${positionToIndex(tray.x, tray.y, width)} · visual ${positionToIndex(visual.x, visual.y, width)} · ${count} layer`;
    row.children[2].textContent = `ID ${tray.cell.item.trayId}`;
    list.appendChild(row);
  });
  return list;
}

function createLayerCard(trayLayer, index, count) {
  const recipe = { ...createEmptyRecipe(), ...(trayLayer.recipe ?? {}) };
  const selectedBlockId = selectedTrayLayerBlockId(recipe);
  const selectedType = blockTypeFromSelectedBlockId(selectedBlockId);
  const selectedAmount = selectedTrayLayerAmount(recipe);
  const card = document.createElement("article");
  card.className = `tray-layer-card ${selectedType ? "valid has-block" : "invalid"}`;
  card.draggable = true;
  card.dataset.trayLayerIndex = String(index);
  if (selectedType) card.style.setProperty("--tray-layer-block-color", blockVisualMeta(selectedType).color);

  const header = document.createElement("header");
  header.className = "tray-layer-header";
  header.innerHTML = '<span class="drag-handle" aria-hidden="true">⠿</span><span class="tray-layer-title"><strong></strong><small></small></span><span class="tray-layer-block-icon"></span><span class="tray-layer-total"></span><span class="tray-layer-actions"><button type="button">↑</button><button type="button">↓</button><button type="button" class="danger">×</button></span>';
  header.children[1].children[0].textContent = `Layer ${trayLayer.layer ?? index}`;
  header.children[1].children[1].textContent = selectedType ? `Block: ${FRUIT_META[selectedType].optionLabel}` : "Block: Chọn Block";
  header.children[2].textContent = "";
  if (selectedType) applyBlockItemVisual(header.children[2], selectedType);
  else header.children[2].textContent = "□";
  header.children[3].textContent = selectedType ? String(selectedAmount) : "--";
  const [up, down, remove] = header.children[4].children;
  up.dataset.trayLayerMove = "-1";
  down.dataset.trayLayerMove = "1";
  remove.dataset.trayLayerDelete = "true";
  [up, down, remove].forEach((button) => { button.dataset.trayLayerIndex = String(index); });
  up.disabled = index === 0;
  down.disabled = index === count - 1;
  up.setAttribute("aria-label", `Đưa layer ${index + 1} lên`);
  down.setAttribute("aria-label", `Đưa layer ${index + 1} xuống`);
  remove.setAttribute("aria-label", `Xóa layer ${index + 1}`);
  card.appendChild(header);

  const recipeGrid = document.createElement("div");
  recipeGrid.className = "tray-block-layer-grid";
  const picker = document.createElement("label");
  picker.className = "tray-block-picker";
  picker.innerHTML = '<span>Block</span><span class="tray-block-select-wrap"></span>';
  const selectWrap = picker.children[1];
  const select = document.createElement("select");
  select.dataset.trayBlockPicker = "true";
  select.setAttribute("aria-label", `Block layer ${index + 1}`);
  select.dataset.trayLayerIndex = String(index);
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Chọn Block";
  placeholder.selected = !selectedType;
  placeholder.disabled = true;
  select.appendChild(placeholder);
  FRUIT_TYPES.forEach((type) => {
    const option = document.createElement("option");
    option.value = String(FRUIT_META[type].itemId);
    option.textContent = FRUIT_META[type].optionLabel;
    option.selected = FRUIT_META[type].itemId === selectedBlockId;
    select.appendChild(option);
  });
  select.value = selectedBlockId == null ? "" : String(selectedBlockId);
  select.dataset.selectedBlockId = selectedBlockId == null ? "" : String(selectedBlockId);
  selectWrap.append(createBlockDropLabel(selectedBlockId), select);
  recipeGrid.appendChild(picker);

  const amount = document.createElement("label");
  amount.className = "tray-block-amount";
  amount.innerHTML = '<span>Amount</span><input data-tray-layer-amount type="number" min="1" max="9" step="1">';
  const amountInput = amount.children[1];
  amountInput.dataset.trayLayerIndex = String(index);
  amountInput.setAttribute("value", selectedType ? String(selectedAmount) : "");
  amountInput.setAttribute("placeholder", "--");
  amountInput.setAttribute("aria-label", `Amount layer ${index + 1}`);
  amountInput.disabled = !selectedType;
  recipeGrid.appendChild(amount);

  (trayLayer.unknownItems ?? []).filter((item) => Number(item.count) > 0).forEach((item) => {
    const unknown = document.createElement("div");
    unknown.className = "tray-unknown-row";
    unknown.innerHTML = '<span>❓</span><strong></strong><button type="button" class="danger">Xóa</button>';
    unknown.children[1].textContent = `Unknown #${item.itemId} × ${item.count}`;
    unknown.children[2].dataset.removeUnknownItem = String(item.itemId);
    unknown.children[2].dataset.trayLayerIndex = String(index);
    recipeGrid.appendChild(unknown);
  });
  card.appendChild(recipeGrid);
  return card;
}

function createTrayEditor(context, trayIndex, grid) {
  const width = grid.columns;
  const editor = document.createElement("section");
  editor.className = "tray-config";

  const header = document.createElement("header");
  header.className = "tray-config-header";
  header.innerHTML = '<span><strong></strong><small></small></span><button class="btn btn-primary" type="button" data-tray-add-layer>＋ Layer</button>';
  header.children[0].children[0].textContent = `Khay ID ${context.item.trayId}`;
  header.children[0].children[1].textContent = `Deliver Point · Index ${positionToIndex(context.x, context.y, width)}`;
  editor.appendChild(header);

  if (context.item.kind === "truck") {
    header.children[1].remove();
    const legacy = document.createElement("div");
    legacy.className = "tray-legacy";
    legacy.innerHTML = '<strong>Dữ liệu xe phiên bản cũ</strong><span>Chuyển thành khay sức chứa 9 để setup recipe và layer.</span><button class="btn btn-primary" type="button" data-convert-truck>Chuyển sang khay mới</button>';
    editor.appendChild(legacy);
    return editor;
  }

  const positionControl = document.createElement("label");
  positionControl.className = "tray-position-picker";
  positionControl.innerHTML = '<span><strong>trayPosition</strong><small></small></span><input data-tray-position-index type="number" min="0" step="1" aria-label="Index trayPosition bottom center">';
  const trayPosition = getTrayVisualPosition(context.item, context);
  const trayPositionIndex = positionToIndex(trayPosition.x, trayPosition.y, width);
  positionControl.children[0].children[1].textContent = `Conveyor bottom-center · Deliver Point giữ Index ${positionToIndex(context.x, context.y, width)}`;
  const indexInput = positionControl.children[1];
  indexInput.setAttribute("max", String((grid.columns * grid.rows) - 1));
  indexInput.setAttribute("value", String(trayPositionIndex));
  editor.appendChild(positionControl);

  const layers = context.item.trayLayers ?? [];
  if (layers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tray-config-empty";
    empty.innerHTML = '<strong>Khay đang trống</strong><span>Thêm layer đầu tiên, sau đó phân bổ đủ 9 item vào recipe.</span>';
    editor.appendChild(empty);
    return editor;
  }
  const list = document.createElement("div");
  list.className = "tray-layer-list";
  layers.forEach((layer, index) => list.appendChild(createLayerCard(layer, index, layers.length)));
  editor.appendChild(list);
  return editor;
}

export function createTrayContextAt(state, x, y) {
  const cell = state.sharedCells?.[cellKey(x, y)];
  if (!cell || !["tray", "truck"].includes(cell.item?.kind)) return null;
  return { cell, item: cell.item, x, y };
}

export function createTrayInspectorCard(context, grid) {
  const card = document.createElement("article");
  card.className = "inspector-card tray-inspector-card";
  card.innerHTML = '<header><span class="inspector-card-icon"></span><h3>Khay chứa</h3></header>';
  card.querySelector(".inspector-card-icon").textContent = context.item.icon ?? "🧺";
  card.appendChild(createTrayEditor(context, 0, grid));

  const deleteButton = document.createElement("button");
  deleteButton.className = "inspector-link danger";
  deleteButton.type = "button";
  deleteButton.dataset.inspectorDelete = "tray";
  deleteButton.textContent = "Xóa Tray";
  card.appendChild(deleteButton);
  return card;
}

export function renderTrayEditor(container, state) {
  const trays = trayEntries(state);
  const activeTrayCell = state.activeTrayCell ?? state.selectedCell;
  container.innerHTML = "";
  if (trays.length === 0) {
    container.innerHTML = '<div class="empty-state">Chưa có khay chứa trên map. Chọn <strong>Khay chứa</strong> trong tab Item để đặt một khay trống.</div>';
    return;
  }
  container.appendChild(createTrayList(trays, activeTrayCell, state.grid.columns));
  const context = getSelectedTrayContext(state);
  if (!context) {
    const hint = document.createElement("div");
    hint.className = "tray-setup-hint";
    hint.textContent = "Click một khay trên map hoặc trong danh sách để setup queue layer và recipe của riêng khay đó.";
    container.appendChild(hint);
    return;
  }
  const trayIndex = trays.findIndex((tray) => tray.x === context.x && tray.y === context.y);
  container.appendChild(createTrayEditor(context, Math.max(0, trayIndex), state.grid));
}
