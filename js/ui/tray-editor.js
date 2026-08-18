import { FRUIT_TYPES } from "../core/constants.js";
import { BLOCK_ITEM_GLYPH, applyBlockItemVisual, blockLabelForFruitType } from "../core/block-visuals.js";
import {
  cellKey,
  getTrayVisualDirection,
  getTrayVisualPosition,
  isInsideGrid,
  positionToIndex,
  TRAY_VISUAL_DIRECTIONS
} from "../utils/grid-utils.js";
import { createId } from "../utils/id-generator.js";

export const TRAY_CAPACITY = 9;

const FRUIT_META = Object.freeze(Object.fromEntries(FRUIT_TYPES.map((type) => [
  type,
  { label: blockLabelForFruitType(type), icon: BLOCK_ITEM_GLYPH }
])));

const TRAY_DIRECTION_META = Object.freeze({
  up: "↑ Phía trên",
  right: "→ Bên phải",
  down: "↓ Phía dưới",
  left: "← Bên trái"
});

function createEmptyRecipe() {
  return Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
}

function trayLayerTotal(layer) {
  const known = FRUIT_TYPES.reduce((sum, type) => sum + (Number(layer?.recipe?.[type]) || 0), 0);
  return known + (layer?.unknownItems ?? []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
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

export function setTrayVisualDirection(state, direction) {
  const context = getSelectedTrayContext(state);
  const vector = TRAY_VISUAL_DIRECTIONS[direction];
  if (!context || context.item.kind !== "tray" || !vector) return { changed: false, reason: "invalid-direction" };
  const trayPosition = { x: context.x + vector.x, y: context.y + vector.y };
  if (!isInsideGrid(state.grid, trayPosition.x, trayPosition.y)) return { changed: false, reason: "outside-grid" };
  const visualKey = cellKey(trayPosition.x, trayPosition.y);
  const visualShared = state.sharedCells?.[visualKey];
  const visualFruit = (state.layers ?? []).some((layer) => layer.cells?.[visualKey]?.item);
  const overlapsOtherTray = Object.entries(state.sharedCells ?? {}).some(([key, cell]) => {
    if (key === cellKey(context.x, context.y) || !["tray", "truck"].includes(cell.item?.kind)) return false;
    const [x, y] = key.split(",").map(Number);
    const visual = getTrayVisualPosition(cell.item, { x, y });
    return visual.x === trayPosition.x && visual.y === trayPosition.y;
  });
  if (visualShared?.path || visualShared?.item || visualShared?.element || visualFruit || overlapsOtherTray) {
    return { changed: false, reason: "occupied" };
  }
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

export function selectTrayLayerFruit(state, layerIndex, fruitType) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  if (!trayLayer || !FRUIT_TYPES.includes(fruitType)) return false;
  trayLayer.recipe = { ...createEmptyRecipe(), ...(trayLayer.recipe ?? {}) };
  if ((Number(trayLayer.recipe[fruitType]) || 0) > 0) return false;
  const total = trayLayerTotal(trayLayer);
  const remaining = TRAY_CAPACITY - total;
  if (remaining <= 0) return false;
  trayLayer.recipe[fruitType] = remaining;
  return true;
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

function createRecipeControl(type, amount, total, layerIndex) {
  const meta = FRUIT_META[type];
  const row = document.createElement("div");
  row.className = "tray-recipe-row";
  row.innerHTML = '<span class="tray-fruit-icon"></span><span class="tray-fruit-name"></span><span class="tray-counter"><button type="button">−</button><output></output><button type="button">+</button></span>';
  applyBlockItemVisual(row.children[0], type);
  row.children[1].textContent = meta.label;
  const [decrease, output, increase] = row.children[2].children;
  decrease.dataset.recipeStep = "-1";
  increase.dataset.recipeStep = "1";
  decrease.dataset.trayLayerIndex = String(layerIndex);
  increase.dataset.trayLayerIndex = String(layerIndex);
  decrease.dataset.fruitType = type;
  increase.dataset.fruitType = type;
  decrease.disabled = amount <= 0;
  increase.disabled = total >= TRAY_CAPACITY;
  decrease.setAttribute("aria-label", `Giảm ${meta.label} ở layer ${layerIndex + 1}`);
  increase.setAttribute("aria-label", `Tăng ${meta.label} ở layer ${layerIndex + 1}`);
  output.textContent = String(amount);
  output.setAttribute("aria-label", `${meta.label}: ${amount}`);
  return row;
}

function createLayerCard(trayLayer, index, count) {
  const recipe = { ...createEmptyRecipe(), ...(trayLayer.recipe ?? {}) };
  const total = trayLayerTotal({ ...trayLayer, recipe });
  const card = document.createElement("article");
  card.className = `tray-layer-card${total === TRAY_CAPACITY ? " valid" : " invalid"}`;
  card.draggable = true;
  card.dataset.trayLayerIndex = String(index);

  const header = document.createElement("header");
  header.className = "tray-layer-header";
  header.innerHTML = '<span class="drag-handle" aria-hidden="true">⠿</span><span class="tray-layer-title"><strong></strong><small></small></span><span class="tray-layer-total"></span><span class="tray-layer-actions"><button type="button">↑</button><button type="button">↓</button><button type="button" class="danger">×</button></span>';
  header.children[1].children[0].textContent = `Layer ${trayLayer.layer ?? index}`;
  header.children[1].children[1].textContent = total === TRAY_CAPACITY ? "Recipe hợp lệ" : `Còn thiếu ${TRAY_CAPACITY - total}`;
  header.children[2].textContent = `${total}/${TRAY_CAPACITY}`;
  const [up, down, remove] = header.children[3].children;
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
  recipeGrid.className = "tray-recipe-grid";
  const selectedTypes = FRUIT_TYPES.filter((type) => (Number(recipe[type]) || 0) > 0);
  const availableTypes = FRUIT_TYPES.filter((type) => !selectedTypes.includes(type));
  const picker = document.createElement("label");
  picker.className = "tray-fruit-picker";
  picker.innerHTML = '<span>Loại quả trong layer</span><select data-tray-fruit-picker><option value="">＋ Chọn loại quả</option></select><small></small>';
  const select = picker.children[1];
  select.dataset.trayLayerIndex = String(index);
  availableTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = `${FRUIT_META[type].icon} ${FRUIT_META[type].label}`;
    select.appendChild(option);
  });
  select.disabled = total >= TRAY_CAPACITY || availableTypes.length === 0;
  picker.children[2].textContent = total >= TRAY_CAPACITY
    ? "Đã đủ 9/9 · giảm một loại để thêm loại khác"
    : `Loại mới sẽ tự nhận ${TRAY_CAPACITY - total} chỗ còn lại`;
  recipeGrid.appendChild(picker);
  if (selectedTypes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "tray-recipe-empty";
    empty.textContent = "Chưa chọn loại quả cho layer này.";
    recipeGrid.appendChild(empty);
  } else {
    selectedTypes.forEach((type) => recipeGrid.appendChild(createRecipeControl(type, Number(recipe[type]) || 0, total, index)));
  }
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

function createTrayEditor(context, trayIndex, width) {
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
  positionControl.innerHTML = '<span><strong>trayPosition</strong><small></small></span><select data-tray-position-direction aria-label="Hướng đặt visual khay"></select>';
  const trayPosition = getTrayVisualPosition(context.item, context);
  positionControl.children[0].children[1].textContent = `Index ${positionToIndex(trayPosition.x, trayPosition.y, width)} · +1 so với Deliver Point`;
  const directionSelect = positionControl.children[1];
  const currentDirection = getTrayVisualDirection(context.item, context);
  Object.entries(TRAY_DIRECTION_META).forEach(([direction, label]) => {
    const option = document.createElement("option");
    option.value = direction;
    option.textContent = label;
    if (direction === currentDirection) option.setAttribute("selected", "");
    directionSelect.appendChild(option);
  });
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

export function createTrayInspectorCard(context, width) {
  const card = document.createElement("article");
  card.className = "inspector-card tray-inspector-card";
  card.innerHTML = '<header><span class="inspector-card-icon"></span><h3>Khay chứa</h3></header>';
  card.querySelector(".inspector-card-icon").textContent = context.item.icon ?? "🧺";
  card.appendChild(createTrayEditor(context, 0, width));

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
  container.appendChild(createTrayEditor(context, Math.max(0, trayIndex), state.grid.columns));
}
