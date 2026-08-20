/*
 * AUTO-GENERATED FILE — do not edit directly.
 * Run: npm run build
 * Source: ES modules under js/.
 */
(() => {
"use strict";

// ---- js/core/constants.js ----
const STORAGE_KEY = "railwaydash-level-editor-v04";
const LEGACY_STORAGE_KEYS = [];
const SCHEMA_VERSION = 3;
const MAX_HISTORY = 50;
const BASE_MAP_SIZE = Object.freeze({ columns: 17, rows: 28 });

const TOOL_LABELS = Object.freeze({
  path: "Vẽ đường",
  item: "Đặt item",
  terrain: "Chỉnh terrain",
  select: "Chọn ô",
  erase: "Xóa"
});

const ERASE_MODE_LABELS = Object.freeze({
  smart: "Smart",
  select: "Select"
});

const TERRAIN_ASSET_IDS = Object.freeze({
  GRASS: "terrain-grass",
  EMPTY: "terrain-empty",
  PRIORITY_POINT: "priority-point"
});

const BRIDGE_ASSET_ID = "bridge";
const BRIDGE_AXES = Object.freeze({
  HORIZONTAL: 0,
  VERTICAL: 1
});

const GATE_ASSET_ID = "gate";
const GATE_DIRECTIONS = Object.freeze({
  UP: 0,
  DOWN: 1,
  RIGHT: 2,
  LEFT: 3
});

const MYSTERY_FRUIT_ASSET_ID = "mystery-fruit";
const COUNT_BARRIER_ASSET_ID = "count-barrier";
const TUNNEL_ASSET_ID = "tunnel";
const ONE_WAY_ASSET_ID = "one-way";

const FRUIT_TYPES = Object.freeze(["apple", "banana", "grape", "eggplant", "block5", "block6", "block7"]);
const FRUIT_SHORT = Object.freeze({ apple: "B1", banana: "B2", grape: "B3", eggplant: "B4", block5: "B5", block6: "B6", block7: "B7" });
const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
});


// ---- js/core/event-bus.js ----
class EventBus {
  #listeners = new Map();

  on(eventName, listener) {
    const listeners = this.#listeners.get(eventName) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(eventName, listeners);
    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    this.#listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, payload) {
    this.#listeners.get(eventName)?.forEach((listener) => listener(payload));
  }

  clear() {
    this.#listeners.clear();
  }
}


// ---- js/core/history-manager.js ----
class HistoryManager {
  #past = [];
  #future = [];

  constructor(limit = 50) {
    this.limit = limit;
  }

  push(snapshot) {
    this.#past.push(structuredClone(snapshot));
    if (this.#past.length > this.limit) this.#past.shift();
    this.#future.length = 0;
  }

  undo(currentSnapshot) {
    if (!this.canUndo) return null;
    this.#future.push(structuredClone(currentSnapshot));
    return this.#past.pop();
  }

  redo(currentSnapshot) {
    if (!this.canRedo) return null;
    this.#past.push(structuredClone(currentSnapshot));
    return this.#future.pop();
  }

  clear() {
    this.#past.length = 0;
    this.#future.length = 0;
  }

  get canUndo() { return this.#past.length > 0; }
  get canRedo() { return this.#future.length > 0; }
}


// ---- js/core/visual-scale.js ----
const VISUAL_SCALE = Object.freeze({
  fruit: 0.72,
  mysteryFruit: 0.72,
  bridge: 0.9,
  gate: 0.75,
  tunnel: 0.78,
  oneWayArrow: 0.6,
  barrier: 0.85,
  spawn: 0.7,
  priorityPoint: 0.5,
  tray: 0.72,
  deliverPoint: 0.28
});

const CSS_VARIABLES = Object.freeze({
  fruit: "--visual-fruit",
  mysteryFruit: "--visual-mystery-fruit",
  bridge: "--visual-bridge",
  gate: "--visual-gate",
  tunnel: "--visual-tunnel",
  oneWayArrow: "--visual-one-way",
  barrier: "--visual-barrier",
  spawn: "--visual-spawn",
  priorityPoint: "--visual-priority-point",
  tray: "--visual-tray",
  deliverPoint: "--visual-deliver-point"
});

function applyVisualScaleConfig(container) {
  Object.entries(CSS_VARIABLES).forEach(([key, variable]) => {
    container.style.setProperty(variable, `${VISUAL_SCALE[key] * 100}%`);
  });
}


// ---- js/core/player-head-layer-rule.js ----
function isPlayerHeadItem(item) {
  return item?.kind === "snake";
}

function activeLayerIndex(level, layerId = level?.activeLayerId) {
  const layers = Array.isArray(level?.layers) ? level.layers : [];
  if (layers.length === 0) return -1;
  const index = layers.findIndex((layer) => layer.id === layerId);
  return index >= 0 ? index : 0;
}

function isPlayerHeadLayer(level, layerId = level?.activeLayerId) {
  return activeLayerIndex(level, layerId) === 0;
}

function isSharedItemVisibleForLayer(item, level, layerId = level?.activeLayerId) {
  return !isPlayerHeadItem(item) || isPlayerHeadLayer(level, layerId);
}

function visibleSharedItemForLayer(item, level, layerId = level?.activeLayerId) {
  return isSharedItemVisibleForLayer(item, level, layerId) ? item : null;
}


// ---- js/utils/id-generator.js ----
let sequence = 0;

function createId(prefix = "id") {
  sequence += 1;
  const randomPart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${sequence}`;
  return `${prefix}-${randomPart}`;
}


// ---- js/utils/grid-utils.js ----




const cellKey = (x, y) => `${x},${y}`;

const TRAY_VISUAL_DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
});

function positionToIndex(x, y, width) {
  return (y * width) + x;
}

function indexToPosition(index, width) {
  return { x: index % width, y: Math.floor(index / width) };
}

function parseCellKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function getTrayVisualPosition(item, deliverPoint) {
  const stored = item?.trayPosition;
  if (Number.isInteger(stored?.x) && Number.isInteger(stored?.y)) return { x: stored.x, y: stored.y };
  return { x: deliverPoint.x, y: deliverPoint.y - 1 };
}

function getTrayVisualCells(item, deliverPoint) {
  const conveyor = getTrayVisualPosition(item, deliverPoint);
  const cells = [];
  for (let row = 0; row < 3; row += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const slotIndex = row * 3 + (dx + 1);
      cells.push({
        x: conveyor.x + dx,
        y: conveyor.y - 3 + row,
        role: "main",
        center: dx === 0 && row === 1,
        slotIndex
      });
    }
  }
  cells.push({ x: conveyor.x, y: conveyor.y, role: "conveyor", center: false, slotIndex: null });
  return cells;
}

function getTrayVisualBounds(item, deliverPoint) {
  const conveyor = getTrayVisualPosition(item, deliverPoint);
  return {
    left: conveyor.x - 1,
    right: conveyor.x + 1,
    top: conveyor.y - 3,
    bottom: conveyor.y
  };
}

function isTrayVisualInsideGrid(grid, item, deliverPoint) {
  return getTrayVisualCells(item, deliverPoint).every((cell) => isInsideGrid(grid, cell.x, cell.y));
}

function getTrayVisualDirection(item, deliverPoint) {
  const visual = getTrayVisualPosition(item, deliverPoint);
  return Object.entries(TRAY_VISUAL_DIRECTIONS)
    .find(([, vector]) => deliverPoint.x + vector.x === visual.x && deliverPoint.y + vector.y === visual.y)?.[0] ?? "up";
}

function createFullGrassCells(grid, excludedKeys = new Set()) {
  const cells = {};
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      const key = cellKey(x, y);
      if (!excludedKeys.has(key)) cells[key] = true;
    }
  }
  return cells;
}

function ensureTerrainState(state) {
  if (!Number.isInteger(state.selectedBridgeAxis)) state.selectedBridgeAxis = 0;
  if (!Number.isInteger(state.selectedGateDirection)) state.selectedGateDirection = 0;
  state.selectedCountBarrierCount = normalizeCountBarrierCount(state.selectedCountBarrierCount);
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  state.tunnelDraft = normalizeTunnelDraft(state.tunnelDraft);
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  state.oneWayDraft = normalizeOneWayDraft(state.oneWayDraft);
  if (!Number.isInteger(state.nextBarrierId) || state.nextBarrierId < 0) {
    state.nextBarrierId = nextCountBarrierSequence(state.countBarrierElement);
  }
  if (state.nextBarrierId < nextCountBarrierSequence(state.countBarrierElement)) {
    state.nextBarrierId = nextCountBarrierSequence(state.countBarrierElement);
  }
  const activeBarrierExists = state.countBarrierElement.some((entry) => entry.barrierId === state.activeBarrierId);
  const activeBarrierIsPending = Number.isInteger(state.activeBarrierId) && state.activeBarrierId >= 0 && state.activeBarrierId < state.nextBarrierId;
  if (!Number.isInteger(state.activeBarrierId) || (!activeBarrierExists && !activeBarrierIsPending)) {
    state.activeBarrierId = null;
  }
  if (!Number.isInteger(state.drawingCountBarrierId)) state.drawingCountBarrierId = null;
  if (!Number.isInteger(state.nextTunnelId) || state.nextTunnelId < 0) {
    state.nextTunnelId = nextTunnelSequence(state.tunnelElement);
  }
  if (state.nextTunnelId < nextTunnelSequence(state.tunnelElement)) {
    state.nextTunnelId = nextTunnelSequence(state.tunnelElement);
  }
  const activeTunnelExists = state.tunnelElement.some((entry) => entry.tunnelId === state.activeTunnelId);
  const activeTunnelIsPending = Number.isInteger(state.activeTunnelId) && state.activeTunnelId >= 0 && state.activeTunnelId < state.nextTunnelId;
  if (!Number.isInteger(state.activeTunnelId) || (!activeTunnelExists && !activeTunnelIsPending)) {
    state.activeTunnelId = null;
  }
  if (!Number.isInteger(state.nextOneWayId) || state.nextOneWayId < 0) {
    state.nextOneWayId = nextOneWaySequence(state.oneWayElement);
  }
  if (state.nextOneWayId < nextOneWaySequence(state.oneWayElement)) {
    state.nextOneWayId = nextOneWaySequence(state.oneWayElement);
  }
  const activeOneWayExists = state.oneWayElement.some((entry) => entry.oneWayId === state.activeOneWayId);
  const activeOneWayIsPending = Number.isInteger(state.activeOneWayId) && state.activeOneWayId >= 0 && state.activeOneWayId < state.nextOneWayId;
  if (!Number.isInteger(state.activeOneWayId) || (!activeOneWayExists && !activeOneWayIsPending)) {
    state.activeOneWayId = null;
  }
  if (!Array.isArray(state.mysteryFruitElement)) state.mysteryFruitElement = [];
  state.mysteryFruitElement = normalizeMysteryFruitElement(state.mysteryFruitElement);
  state.mysteryFruitDebug = Boolean(state.mysteryFruitDebug);
  Object.values(state.sharedCells ?? {}).forEach((cell) => {
    if (cell.element?.kind === "bridge" && !Number.isInteger(cell.element.axis) && Number.isInteger(cell.element.direction)) {
      cell.element.axis = cell.element.direction;
      delete cell.element.direction;
    }
  });
  if (!state.grassCells) {
    const pathKeys = new Set(Object.entries(state.sharedCells ?? {}).filter(([, cell]) => cell.path).map(([key]) => key));
    state.grassCells = createFullGrassCells(state.grid, pathKeys);
  }
  if (!state.priorityPoints) {
    const merged = createMergedLayer(state);
    state.priorityPoints = Object.fromEntries(Object.keys(merged.cells ?? {})
      .filter((key) => {
        const { x, y } = parseCellKey(key);
        return isPathJunction(merged, x, y);
      })
      .map((key) => [key, "auto"]));
  }
  return state;
}

function normalizeMysteryFruitElement(entries = []) {
  if (!Array.isArray(entries)) return [];
  const groups = new Map();
  entries.forEach((entry) => {
    const layer = Number(entry?.layer);
    if (!Number.isInteger(layer) || layer < 0) return;
    const indexes = Array.isArray(entry?.index) ? entry.index : [];
    const group = groups.get(layer) ?? new Set();
    indexes.forEach((index) => {
      const value = Number(index);
      if (Number.isInteger(value) && value >= 0) group.add(value);
    });
    groups.set(layer, group);
  });
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([layer, indexes]) => ({ layer, index: [...indexes].sort((a, b) => a - b) }))
    .filter((entry) => entry.index.length > 0);
}

function isMysteryFruitAt(state, layerNumber, index) {
  return normalizeMysteryFruitElement(state?.mysteryFruitElement)
    .some((entry) => entry.layer === layerNumber && entry.index.includes(index));
}

function setMysteryFruitAt(state, layerNumber, index, hidden) {
  state.mysteryFruitElement = normalizeMysteryFruitElement(state.mysteryFruitElement);
  const current = state.mysteryFruitElement.find((entry) => entry.layer === layerNumber);
  const indexes = new Set(current?.index ?? []);
  const hadValue = indexes.has(index);
  if (hidden) indexes.add(index);
  else indexes.delete(index);
  state.mysteryFruitElement = [
    ...state.mysteryFruitElement.filter((entry) => entry.layer !== layerNumber),
    ...(indexes.size > 0 ? [{ layer: layerNumber, index: [...indexes] }] : [])
  ];
  state.mysteryFruitElement = normalizeMysteryFruitElement(state.mysteryFruitElement);
  return hidden ? !hadValue : hadValue;
}

function isGrassAt(state, x, y) {
  ensureTerrainState(state);
  return Boolean(state.grassCells[cellKey(x, y)]);
}

function isPriorityPointAt(state, x, y) {
  ensureTerrainState(state);
  return Boolean(state.priorityPoints[cellKey(x, y)]);
}

function isInsideGrid(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.columns && y < grid.rows;
}

function getCell(layer, x, y) {
  return layer.cells[cellKey(x, y)] ?? { path: false, item: null };
}

function getMergedCell(level, x, y, layerId = level.activeLayerId) {
  const key = cellKey(x, y);
  const layer = level.layers?.find((candidate) => candidate.id === layerId) ?? level.layers?.[0];
  if (!level.sharedCells) return getCell(layer ?? { cells: {} }, x, y);
  const shared = level.sharedCells[key] ?? { path: false, item: null, element: null };
  const layerCell = layer?.cells?.[key] ?? {};
  const sharedItem = visibleSharedItemForLayer(shared.item, level, layer?.id);
  return {
    path: Boolean(shared.path),
    element: shared.element ?? null,
    item: sharedItem ?? layerCell.item ?? null,
    layerItem: layerCell.item ?? null,
    sharedItem
  };
}

function createMergedLayer(level, layerId = level.activeLayerId) {
  if (!level.sharedCells) return level.layers?.find((layer) => layer.id === layerId) ?? level.layers?.[0] ?? { cells: {} };
  const layer = level.layers?.find((candidate) => candidate.id === layerId) ?? level.layers?.[0];
  const keys = new Set([...Object.keys(level.sharedCells), ...Object.keys(layer?.cells ?? {})]);
  const cells = {};
  keys.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    const cell = getMergedCell(level, x, y, layer?.id);
    if (cell.path || cell.item || cell.element) cells[key] = cell;
  });
  return { ...(layer ?? {}), cells };
}

function trimCells(cells, grid) {
  return Object.fromEntries(Object.entries(cells).filter(([key]) => {
    const { x, y } = parseCellKey(key);
    return isInsideGrid(grid, x, y);
  }));
}

function adjacentPositions(position) {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y }
  ];
}

function countPathNeighbors(layer, x, y) {
  return adjacentPositions({ x, y }).filter((position) =>
    Boolean(getCell(layer, position.x, position.y).path)
  ).length;
}

function isPathJunction(layer, x, y) {
  return getCell(layer, x, y).path && countPathNeighbors(layer, x, y) >= 3;
}

function isPathTurnpoint(layer, x, y) {
  if (!getCell(layer, x, y).path) return false;
  const neighbors = adjacentPositions({ x, y }).filter((position) => Boolean(getCell(layer, position.x, position.y).path));
  if (neighbors.length >= 3) return true;
  if (neighbors.length !== 2) return false;
  const [first, second] = neighbors;
  return first.x !== second.x && first.y !== second.y;
}


// ---- js/utils/math-utils.js ----
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function samePosition(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}


// ---- js/utils/file-utils.js ----
function stringifyJson(data) {
  const compactIndexArrays = [];
  const formatted = JSON.stringify(data, (key, value) => {
    if (key !== "index" || !Array.isArray(value)) return value;
    const token = `__RD_COMPACT_INDEX_${compactIndexArrays.length}__`;
    compactIndexArrays.push(JSON.stringify(value));
    return token;
  }, 2);
  return formatted.replace(/"__RD_COMPACT_INDEX_(\d+)__"/g, (_match, position) => compactIndexArrays[Number(position)]);
}

function downloadJson(data, filename = "snacky-level.json") {
  const blob = new Blob([stringifyJson(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readJsonFile(file) {
  return JSON.parse(await file.text());
}


// ---- js/objects/path-object.js ----
function createPathCell(item = null) {
  return { path: true, item };
}


// ---- js/objects/fruit-object.js ----
const FRUIT_ITEM_IDS = Object.freeze({
  apple: 1,
  banana: 2,
  grape: 3,
  eggplant: 4,
  block5: 5,
  block6: 6,
  block7: 7
});

function createFruit(fruitType, label, icon) {
  return { id: FRUIT_ITEM_IDS[fruitType] ?? String(fruitType), kind: "fruit", category: "item", fruitType, label, icon };
}


// ---- js/core/block-visuals.js ----


const TRAIN_HEAD_ICON = "🚂";
const BLOCK_ITEM_GLYPH = "■";

const BLOCK_ITEM_COLORS = Object.freeze({
  1: "#e53935",
  2: "#f6d33f",
  3: "#2f7eea",
  4: "#f062a7",
  5: "#8e44ad",
  6: "#34a853",
  7: "#f28c28"
});

const BLOCK_ITEM_LABELS = Object.freeze({
  1: "Block đỏ",
  2: "Block vàng",
  3: "Block xanh biển",
  4: "Block hồng",
  5: "Block tím",
  6: "Block xanh lá",
  7: "Block cam"
});

const BLOCK_ITEM_ENGLISH_LABELS = Object.freeze({
  1: "Red",
  2: "Yellow",
  3: "Blue",
  4: "Pink",
  5: "Purple",
  6: "Green",
  7: "Orange"
});

const BLOCK_ITEM_COLOR_NAMES = Object.freeze({
  1: "Đỏ",
  2: "Vàng",
  3: "Xanh biển",
  4: "Hồng",
  5: "Tím",
  6: "Xanh lá",
  7: "Cam"
});

const BLOCK_ITEM_EMOJIS = Object.freeze({
  1: "🟥",
  2: "🟨",
  3: "🟦",
  4: "🩷",
  5: "🟪",
  6: "🟩",
  7: "🟧"
});

function blockItemIdFromFruitType(fruitType) {
  return Number(FRUIT_ITEM_IDS[fruitType]) || null;
}

function blockItemIdFromItem(itemOrType) {
  if (typeof itemOrType === "string" && FRUIT_TYPES.includes(itemOrType)) return blockItemIdFromFruitType(itemOrType);
  const directId = Number(itemOrType?.itemId ?? itemOrType?.id);
  if (Number.isInteger(directId) && directId > 0) return directId;
  return blockItemIdFromFruitType(itemOrType?.fruitType);
}

function blockVisualMeta(itemOrType) {
  const itemId = blockItemIdFromItem(itemOrType);
  return {
    itemId,
    color: BLOCK_ITEM_COLORS[itemId] ?? "#94a3b8",
    label: BLOCK_ITEM_LABELS[itemId] ?? `Block #${itemId ?? "?"}`
  };
}

function blockLabelForFruitType(fruitType) {
  return blockVisualMeta(fruitType).label;
}

function blockEnglishLabelForFruitType(fruitType) {
  const itemId = blockItemIdFromFruitType(fruitType);
  return BLOCK_ITEM_ENGLISH_LABELS[itemId] ?? `Block #${itemId ?? "?"}`;
}

function blockColorNameForFruitType(fruitType) {
  const itemId = blockItemIdFromFruitType(fruitType);
  return BLOCK_ITEM_COLOR_NAMES[itemId] ?? `Block #${itemId ?? "?"}`;
}

function blockEmojiForFruitType(fruitType) {
  const itemId = blockItemIdFromFruitType(fruitType);
  return BLOCK_ITEM_EMOJIS[itemId] ?? BLOCK_ITEM_GLYPH;
}

function blockOptionLabelForFruitType(fruitType) {
  const itemId = blockItemIdFromFruitType(fruitType);
  return `${blockColorNameForFruitType(fruitType)} ID ${itemId ?? "?"}`;
}

function applyBlockItemVisual(element, itemOrType, { mystery = false } = {}) {
  element.classList.add("block-item-visual");
  if (mystery) {
    element.classList.add("mystery-fruit-preview");
    element.textContent = "❓";
    element.title = "Mystery Item";
    element.removeAttribute("data-item-id");
    element.style.removeProperty("--block-color");
    return element;
  }
  const meta = blockVisualMeta(itemOrType);
  element.classList.remove("mystery-fruit-preview");
  element.textContent = "";
  element.title = meta.label;
  element.dataset.itemId = String(meta.itemId ?? "");
  element.style.setProperty("--block-color", meta.color);
  return element;
}

function createBlockSwatch(itemOrType, className = "block-swatch") {
  const swatch = document.createElement("span");
  swatch.className = className;
  applyBlockItemVisual(swatch, itemOrType);
  return swatch;
}


// ---- js/objects/truck-object.js ----
function createTruck(fruitType, label, icon, capacity = 3) {
  return { id: `truck-${fruitType}`, kind: "truck", fruitType, label, icon, capacity };
}


// ---- js/objects/tray-object.js ----
function createEmptyTray() {
  return {
    id: "tray-empty",
    kind: "tray",
    category: "item",
    label: "Khay chứa",
    icon: "🧺",
    capacity: 9,
    trayPosition: null,
    trayLayers: []
  };
}


// ---- js/objects/tray-position-sync.js ----

function deliverPointFromTrayPosition(trayPosition) {
  return { x: trayPosition.x, y: trayPosition.y + 1 };
}

function trayPositionFromDeliverPoint(deliverPoint) {
  return { x: deliverPoint.x, y: deliverPoint.y - 1 };
}

function trayPairIndexes(trayPosition, width) {
  const deliverPoint = deliverPointFromTrayPosition(trayPosition);
  return {
    trayPositionIndex: positionToIndex(trayPosition.x, trayPosition.y, width),
    deliverPointIndex: positionToIndex(deliverPoint.x, deliverPoint.y, width)
  };
}

function validateTrayPair(grid, item, trayPosition) {
  const deliverPoint = deliverPointFromTrayPosition(trayPosition);
  if (!isInsideGrid(grid, trayPosition.x, trayPosition.y)) return { valid: false, reason: "tray-position-outside-grid" };
  if (!isInsideGrid(grid, deliverPoint.x, deliverPoint.y)) return { valid: false, reason: "deliver-point-outside-grid" };
  if (!isTrayVisualInsideGrid(grid, { ...item, trayPosition }, deliverPoint)) return { valid: false, reason: "footprint-outside-grid" };
  return { valid: true, trayPosition, deliverPoint };
}

function moveTrayItemToDeliverPoint(state, context, deliverPoint) {
  const oldKey = cellKey(context.x, context.y);
  const newKey = cellKey(deliverPoint.x, deliverPoint.y);
  if (oldKey === newKey) return true;
  state.sharedCells ??= {};
  const oldShared = state.sharedCells[oldKey];
  if (!oldShared || oldShared.item !== context.item) return false;
  const nextShared = state.sharedCells[newKey] ?? { path: false, item: null, element: null };
  if (nextShared.item && nextShared.item !== context.item) return false;
  oldShared.item = null;
  if (!oldShared.path && !oldShared.element) delete state.sharedCells[oldKey];
  nextShared.item = context.item;
  state.sharedCells[newKey] = nextShared;
  context.x = deliverPoint.x;
  context.y = deliverPoint.y;
  context.cell = nextShared;
  state.selectedCell = { x: deliverPoint.x, y: deliverPoint.y };
  state.activeTrayCell = { x: deliverPoint.x, y: deliverPoint.y };
  return true;
}

function moveTrayByTrayPosition(state, context, trayPosition) {
  if (!context || !["tray", "truck"].includes(context.item?.kind)) return { changed: false, reason: "invalid-tray" };
  const validation = validateTrayPair(state.grid, context.item, trayPosition);
  if (!validation.valid) return { changed: false, reason: validation.reason };
  const currentTrayPosition = getTrayVisualPosition(context.item, context);
  const sameTrayPosition = currentTrayPosition.x === trayPosition.x && currentTrayPosition.y === trayPosition.y;
  const sameDeliverPoint = context.x === validation.deliverPoint.x && context.y === validation.deliverPoint.y;
  if (sameTrayPosition && sameDeliverPoint) return { changed: false, reason: null };
  if (!moveTrayItemToDeliverPoint(state, context, validation.deliverPoint)) return { changed: false, reason: "deliver-point-occupied" };
  context.item.trayPosition = { x: trayPosition.x, y: trayPosition.y };
  return { changed: true, reason: null };
}

function moveTrayByTrayPositionIndex(state, context, index) {
  const value = Math.floor(Number(index));
  if (!Number.isInteger(value)) return { changed: false, reason: "invalid-index" };
  const total = state.grid.columns * state.grid.rows;
  if (value < 0 || value >= total) return { changed: false, reason: "tray-position-outside-grid" };
  return moveTrayByTrayPosition(state, context, indexToPosition(value, state.grid.columns));
}

function moveTrayByDeliverPointIndex(state, context, index) {
  const value = Math.floor(Number(index));
  if (!Number.isInteger(value)) return { changed: false, reason: "invalid-index" };
  const total = state.grid.columns * state.grid.rows;
  if (value < 0 || value >= total) return { changed: false, reason: "deliver-point-outside-grid" };
  const deliverPoint = indexToPosition(value, state.grid.columns);
  return moveTrayByTrayPosition(state, context, trayPositionFromDeliverPoint(deliverPoint));
}


// ---- js/objects/obstacle-object.js ----
function createObstacle(type = "rock", label = "Chướng ngại", icon = "🪨") {
  return { id: `obstacle-${type}`, kind: "obstacle", obstacleType: type, label, icon };
}


// ---- js/objects/bridge-object.js ----

function createBridge(axis = BRIDGE_AXES.HORIZONTAL) {
  return {
    id: BRIDGE_ASSET_ID,
    kind: "bridge",
    category: "element",
    label: "Bridge",
    icon: "🟰",
    axis
  };
}

function isBridgeElement(element) {
  return element?.kind === "bridge";
}

function normalizeBridgeAxis(value) {
  const axis = Number(value);
  return axis === BRIDGE_AXES.VERTICAL ? BRIDGE_AXES.VERTICAL : BRIDGE_AXES.HORIZONTAL;
}

function bridgeAxisLabel(axis) {
  return normalizeBridgeAxis(axis) === BRIDGE_AXES.VERTICAL ? "Vertical" : "Horizontal";
}

function bridgeAxisFromDirection(direction) {
  if (direction === "left" || direction === "right") return BRIDGE_AXES.HORIZONTAL;
  if (direction === "up" || direction === "down") return BRIDGE_AXES.VERTICAL;
  return null;
}

function bridgeSegmentAxis(body, segmentIndex, fallbackDirection = null) {
  const segment = body?.[segmentIndex];
  if (!segment) return null;
  const neighbors = [body[segmentIndex - 1], body[segmentIndex + 1]].filter(Boolean);
  for (const neighbor of neighbors) {
    if (neighbor.y === segment.y && neighbor.x !== segment.x) return BRIDGE_AXES.HORIZONTAL;
    if (neighbor.x === segment.x && neighbor.y !== segment.y) return BRIDGE_AXES.VERTICAL;
  }
  return bridgeAxisFromDirection(fallbackDirection);
}

function bridgeAllowsDifferentAxisOverlap(layer, snake, position, movingDirection) {
  const cell = layer?.cells?.[`${position.x},${position.y}`];
  if (!isBridgeElement(cell?.element)) return false;
  const movingAxis = bridgeAxisFromDirection(movingDirection);
  if (movingAxis === null) return false;
  return snake.body
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => part.x === position.x && part.y === position.y)
    .every(({ index }) => bridgeSegmentAxis(snake.body, index, snake.direction) !== movingAxis);
}


// ---- js/objects/gate-object.js ----

const GATE_DIRECTION_META = Object.freeze({
  [GATE_DIRECTIONS.UP]: { key: "up", label: "Up", className: "up" },
  [GATE_DIRECTIONS.DOWN]: { key: "down", label: "Down", className: "down" },
  [GATE_DIRECTIONS.RIGHT]: { key: "right", label: "Right", className: "right" },
  [GATE_DIRECTIONS.LEFT]: { key: "left", label: "Left", className: "left" }
});

function createGate(direction = GATE_DIRECTIONS.UP) {
  return {
    id: GATE_ASSET_ID,
    kind: "gate",
    category: "element",
    label: "Gate",
    icon: ">",
    direction: normalizeGateDirection(direction)
  };
}

function isGateElement(element) {
  return element?.kind === "gate";
}

function normalizeGateDirection(value) {
  const direction = Number(value);
  return Object.hasOwn(GATE_DIRECTION_META, direction) ? direction : GATE_DIRECTIONS.UP;
}

function isValidGateDirection(value) {
  return Number.isInteger(value) && Object.hasOwn(GATE_DIRECTION_META, value);
}

function gateDirectionLabel(direction) {
  return GATE_DIRECTION_META[normalizeGateDirection(direction)].label;
}

function gateDirectionClass(direction) {
  return GATE_DIRECTION_META[normalizeGateDirection(direction)].className;
}

function gateDirectionFromMovement(direction) {
  const entry = Object.entries(GATE_DIRECTION_META).find(([, meta]) => meta.key === direction);
  return entry ? Number(entry[0]) : null;
}


// ---- js/objects/element-placement-rules.js ----


const PLACEMENT_MESSAGES = Object.freeze({
  "bridge-needs-crossroad": "Bridge chỉ được đặt tại ngã 4",
  "bridge-outside-grid": "Bridge cần đủ 3 ô ngang",
  "bridge-item-overlap": "Bridge không cho phép Item trong vùng 1 ô xung quanh",
  "gate-needs-priority-point": "Gate phải đứng trước PriorityPoint",
  "tunnel-needs-dead-end": "Tunnel chỉ được đặt tại Dead End"
});

const ELEMENT_DIRECTIONS = Object.freeze([
  { key: "up", x: 0, y: -1, direction: GATE_DIRECTIONS.UP },
  { key: "right", x: 1, y: 0, direction: GATE_DIRECTIONS.RIGHT },
  { key: "down", x: 0, y: 1, direction: GATE_DIRECTIONS.DOWN },
  { key: "left", x: -1, y: 0, direction: GATE_DIRECTIONS.LEFT }
]);

function sharedPathAt(state, x, y) {
  if (!isInsideGrid(state.grid, x, y)) return false;
  return Boolean(state.sharedCells?.[cellKey(x, y)]?.path);
}

function pathConnectionsAt(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  return ELEMENT_DIRECTIONS
    .filter((direction) => sharedPathAt(state, position.x + direction.x, position.y + direction.y))
    .map((direction) => direction.direction);
}

function bridgeVisualCells(state, index) {
  const center = indexToPosition(index, state.grid.columns);
  return [
    { x: center.x - 1, y: center.y },
    center,
    { x: center.x + 1, y: center.y }
  ].map((position) => ({
    ...position,
    index: isInsideGrid(state.grid, position.x, position.y)
      ? positionToIndex(position.x, position.y, state.grid.columns)
      : null
  }));
}

function bridgeItemBlockCells(state, index) {
  const center = indexToPosition(index, state.grid.columns);
  const cells = [];
  for (let y = center.y - 1; y <= center.y + 1; y += 1) {
    for (let x = center.x - 1; x <= center.x + 1; x += 1) {
      cells.push({
        x,
        y,
        index: isInsideGrid(state.grid, x, y) ? positionToIndex(x, y, state.grid.columns) : null
      });
    }
  }
  return cells;
}

function hasItemBlockAt(state, x, y) {
  const key = cellKey(x, y);
  return (state.layers ?? []).some((layer) => layer.cells?.[key]?.item?.kind === "fruit");
}

function validateBridgePlacement(state, index) {
  const cells = bridgeVisualCells(state, index);
  if (cells.some((position) => !isInsideGrid(state.grid, position.x, position.y))) {
    return { valid: false, reason: "bridge-outside-grid" };
  }
  const connections = new Set(pathConnectionsAt(state, index));
  const required = [GATE_DIRECTIONS.UP, GATE_DIRECTIONS.DOWN, GATE_DIRECTIONS.LEFT, GATE_DIRECTIONS.RIGHT];
  if (!required.every((direction) => connections.has(direction))) {
    return { valid: false, reason: "bridge-needs-crossroad" };
  }
  if (bridgeItemBlockCells(state, index).some((position) => hasItemBlockAt(state, position.x, position.y))) {
    return { valid: false, reason: "bridge-item-overlap" };
  }
  return { valid: true, axis: BRIDGE_AXES.HORIZONTAL };
}

function findGatePriorityDirection(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  return ELEMENT_DIRECTIONS.find((direction) => (
    state.priorityPoints?.[cellKey(position.x + direction.x, position.y + direction.y)]
  ))?.direction ?? null;
}

function validateGatePlacement(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  if (!sharedPathAt(state, position.x, position.y)) return { valid: false, reason: "gate-needs-priority-point" };
  const direction = findGatePriorityDirection(state, index);
  if (direction === null) return { valid: false, reason: "gate-needs-priority-point" };
  return { valid: true, direction };
}

function findTunnelPathDirection(state, index) {
  const connections = pathConnectionsAt(state, index);
  return connections.length === 1 ? connections[0] : null;
}

function validateTunnelPointPlacement(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  if (!sharedPathAt(state, position.x, position.y)) return { valid: false, reason: "tunnel-needs-dead-end" };
  const direction = findTunnelPathDirection(state, index);
  if (direction === null) return { valid: false, reason: "tunnel-needs-dead-end" };
  return { valid: true, direction };
}

function bridgeOccupiesIndex(state, index) {
  return Object.entries(state.sharedCells ?? {}).some(([key, cell]) => {
    if (cell?.element?.kind !== "bridge") return false;
    const centerPosition = parseCellKey(key);
    const center = positionToIndex(centerPosition.x, centerPosition.y, state.grid.columns);
    return bridgeItemBlockCells(state, center).some((position) => position.index === index);
  });
}


// ---- js/objects/count-barrier-object.js ----

function createCountBarrierTool() {
  return {
    id: COUNT_BARRIER_ASSET_ID,
    kind: "count-barrier",
    category: "element",
    label: "Count Barrier",
    icon: "#"
  };
}

function isCountBarrierTool(object) {
  return object?.kind === "count-barrier" || object?.id === COUNT_BARRIER_ASSET_ID;
}

function normalizeCountBarrierCount(value) {
  const count = Math.floor(Number(value));
  return Number.isInteger(count) && count > 0 ? count : 1;
}

function normalizeCountBarrierElement(entries = []) {
  if (!Array.isArray(entries)) return [];
  const usedIds = new Set();
  let nextId = 0;
  return entries.flatMap((entry) => {
    const indexes = new Set();
    (Array.isArray(entry?.index) ? entry.index : []).forEach((rawIndex) => {
      const index = Number(rawIndex);
      if (Number.isInteger(index) && index >= 0) indexes.add(index);
    });

    const rawStart = Number(entry?.startIndex);
    const rawEnd = Number(entry?.endIndex);
    if (Number.isInteger(rawStart) && rawStart >= 0) indexes.add(rawStart);
    if (Number.isInteger(rawEnd) && rawEnd >= 0) indexes.add(rawEnd);
    if (indexes.size === 0) return [];

    let barrierId = Number(entry?.barrierId);
    if (!Number.isInteger(barrierId) || barrierId < 0 || usedIds.has(barrierId)) {
      while (usedIds.has(nextId)) nextId += 1;
      barrierId = nextId;
    }
    usedIds.add(barrierId);

    const index = [...indexes].sort((a, b) => a - b);
    const startIndex = Number.isInteger(rawStart) && rawStart >= 0 ? rawStart : index[0];
    const endIndex = Number.isInteger(rawEnd) && rawEnd >= 0 ? rawEnd : index[index.length - 1];
    return [{
      barrierId,
      count: normalizeCountBarrierCount(entry?.count),
      startIndex,
      endIndex,
      index
    }];
  }).sort((a, b) => a.barrierId - b.barrierId);
}

function nextCountBarrierId(entries = []) {
  const used = new Set(normalizeCountBarrierElement(entries).map((entry) => entry.barrierId));
  let barrierId = 0;
  while (used.has(barrierId)) barrierId += 1;
  return barrierId;
}

function nextCountBarrierSequence(entries = []) {
  const ids = normalizeCountBarrierElement(entries).map((entry) => entry.barrierId);
  return ids.length > 0 ? Math.max(...ids) + 1 : 0;
}

function createNewActiveCountBarrier(state) {
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  if (!Number.isInteger(state.nextBarrierId) || state.nextBarrierId < 0) {
    state.nextBarrierId = nextCountBarrierSequence(state.countBarrierElement);
  }
  const barrierId = state.nextBarrierId;
  state.activeBarrierId = barrierId;
  state.nextBarrierId += 1;
  state.drawingCountBarrierId = null;
  return barrierId;
}

function findCountBarrierAtIndex(state, index) {
  return normalizeCountBarrierElement(state?.countBarrierElement)
    .find((entry) => entry.index.includes(index)) ?? null;
}

function findCountBarrierById(state, barrierId) {
  return normalizeCountBarrierElement(state?.countBarrierElement)
    .find((entry) => Number(entry.barrierId) === Number(barrierId)) ?? null;
}

function removeCountBarrierAtIndex(state, index) {
  const barrier = findCountBarrierAtIndex(state, index);
  if (!barrier) return false;
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement)
    .filter((entry) => entry.barrierId !== barrier.barrierId);
  if (state.activeBarrierId === barrier.barrierId) state.activeBarrierId = null;
  if (state.drawingCountBarrierId === barrier.barrierId) state.drawingCountBarrierId = null;
  return true;
}

function removeCountBarrierById(state, barrierId) {
  const before = normalizeCountBarrierElement(state.countBarrierElement);
  state.countBarrierElement = before.filter((entry) => Number(entry.barrierId) !== Number(barrierId));
  if (state.activeBarrierId === Number(barrierId)) state.activeBarrierId = null;
  if (state.drawingCountBarrierId === Number(barrierId)) state.drawingCountBarrierId = null;
  return before.length !== state.countBarrierElement.length;
}

function removeCountBarrierCell(state, barrierId, index) {
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  const barrier = state.countBarrierElement.find((entry) => Number(entry.barrierId) === Number(barrierId));
  if (!barrier || !barrier.index.includes(index)) return false;
  barrier.index = barrier.index.filter((entryIndex) => entryIndex !== index);
  if (barrier.index.length < 2) {
    state.countBarrierElement = state.countBarrierElement.filter((entry) => entry.barrierId !== barrier.barrierId);
    if (state.activeBarrierId === barrier.barrierId) state.activeBarrierId = null;
    return true;
  }
  if (barrier.startIndex === index) barrier.startIndex = barrier.index[0];
  if (barrier.endIndex === index) barrier.endIndex = barrier.index[barrier.index.length - 1];
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  return true;
}

function remapCountBarrierIndexes(entries = [], fromWidth, toWidth) {
  if (!Number.isInteger(fromWidth) || fromWidth < 1 || !Number.isInteger(toWidth) || toWidth < 1) {
    return normalizeCountBarrierElement(entries);
  }
  return normalizeCountBarrierElement(entries).map((entry) => {
    const remap = (index) => {
      const x = index % fromWidth;
      const y = Math.floor(index / fromWidth);
      return (y * toWidth) + x;
    };
    return {
      ...entry,
      startIndex: remap(entry.startIndex),
      endIndex: remap(entry.endIndex),
      index: [...new Set(entry.index.map(remap))].sort((a, b) => a - b)
    };
  });
}


// ---- js/objects/tunnel-object.js ----

const TUNNEL_DIRECTION_META = Object.freeze({
  [GATE_DIRECTIONS.UP]: { key: "up", label: "Up", className: "up", icon: "↑" },
  [GATE_DIRECTIONS.DOWN]: { key: "down", label: "Down", className: "down", icon: "↓" },
  [GATE_DIRECTIONS.RIGHT]: { key: "right", label: "Right", className: "right", icon: "→" },
  [GATE_DIRECTIONS.LEFT]: { key: "left", label: "Left", className: "left", icon: "←" }
});

const TUNNEL_COLORS = Object.freeze(["#3268f5", "#d45b8c", "#1c9b6a", "#d88b12", "#7a56d9", "#238aa6"]);

function createTunnelTool() {
  return {
    id: TUNNEL_ASSET_ID,
    kind: "tunnel",
    category: "element",
    label: "Tunnel",
    icon: "⏭"
  };
}

function isTunnelTool(object) {
  return object?.kind === "tunnel" || object?.id === TUNNEL_ASSET_ID;
}

function normalizeTunnelDirection(value) {
  const direction = Number(value);
  return Object.hasOwn(TUNNEL_DIRECTION_META, direction) ? direction : GATE_DIRECTIONS.RIGHT;
}

function isValidTunnelDirection(value) {
  return Number.isInteger(value) && Object.hasOwn(TUNNEL_DIRECTION_META, value);
}

function tunnelDirectionLabel(direction) {
  return TUNNEL_DIRECTION_META[normalizeTunnelDirection(direction)].label;
}

function tunnelDirectionClass(direction) {
  return TUNNEL_DIRECTION_META[normalizeTunnelDirection(direction)].className;
}

function tunnelDirectionKey(direction) {
  return TUNNEL_DIRECTION_META[normalizeTunnelDirection(direction)].key;
}

function tunnelDirectionAxis(direction) {
  return [GATE_DIRECTIONS.LEFT, GATE_DIRECTIONS.RIGHT].includes(normalizeTunnelDirection(direction)) ? "horizontal" : "vertical";
}

function tunnelDirectionIcon(direction) {
  return "⏭";
}

function tunnelColor(tunnelId) {
  return TUNNEL_COLORS[Math.abs(Number(tunnelId) || 0) % TUNNEL_COLORS.length];
}

function normalizeTunnelElement(entries = []) {
  if (!Array.isArray(entries)) return [];
  const usedIds = new Set();
  let nextId = 0;
  return entries.flatMap((entry) => {
    const points = Array.isArray(entry?.entryPoints) ? entry.entryPoints.slice(0, 2) : [];
    if (points.length !== 2) return [];
    const entryPoints = points.map((point) => ({
      index: Math.floor(Number(point?.index)),
      direction: normalizeTunnelDirection(point?.direction)
    }));
    if (entryPoints.some((point) => !Number.isInteger(point.index) || point.index < 0)) return [];

    let tunnelId = Number(entry?.tunnelId);
    if (!Number.isInteger(tunnelId) || tunnelId < 0 || usedIds.has(tunnelId)) {
      while (usedIds.has(nextId)) nextId += 1;
      tunnelId = nextId;
    }
    usedIds.add(tunnelId);
    return [{ tunnelId, entryPoints }];
  }).sort((a, b) => a.tunnelId - b.tunnelId);
}

function nextTunnelSequence(entries = []) {
  const ids = normalizeTunnelElement(entries).map((entry) => entry.tunnelId);
  return ids.length > 0 ? Math.max(...ids) + 1 : 0;
}

function findTunnelById(state, tunnelId) {
  return normalizeTunnelElement(state?.tunnelElement)
    .find((entry) => Number(entry.tunnelId) === Number(tunnelId)) ?? null;
}

function findTunnelAtIndex(state, index) {
  return normalizeTunnelElement(state?.tunnelElement)
    .find((entry) => entry.entryPoints.some((point) => point.index === Number(index))) ?? null;
}

function findTunnelEntryAtIndex(state, index) {
  const tunnel = findTunnelAtIndex(state, index);
  if (!tunnel) return null;
  const entryIndex = tunnel.entryPoints.findIndex((point) => point.index === Number(index));
  return { tunnel, entryIndex, entryPoint: tunnel.entryPoints[entryIndex] };
}

function otherTunnelEntry(tunnel, entryIndex) {
  if (!tunnel || ![0, 1].includes(entryIndex)) return null;
  return tunnel.entryPoints[entryIndex === 0 ? 1 : 0] ?? null;
}

function usedTunnelIndexes(state, excludeTunnelId = null) {
  const used = new Set();
  normalizeTunnelElement(state?.tunnelElement).forEach((tunnel) => {
    if (Number(tunnel.tunnelId) === Number(excludeTunnelId)) return;
    tunnel.entryPoints.forEach((point) => used.add(point.index));
  });
  return used;
}

function normalizeTunnelDraft(draft) {
  if (!draft || typeof draft !== "object") return null;
  const tunnelId = Number(draft.tunnelId);
  if (!Number.isInteger(tunnelId) || tunnelId < 0) return null;
  const allowedSteps = new Set(["direction-a", "point-b", "direction-b"]);
  const step = allowedSteps.has(draft.step) ? draft.step : "direction-a";
  const rawPoints = Array.isArray(draft.entryPoints) ? draft.entryPoints.slice(0, 2) : [];
  const entryPoints = rawPoints.flatMap((point) => {
    const index = Math.floor(Number(point?.index));
    if (!Number.isInteger(index) || index < 0) return [];
    return [{
      index,
      direction: point?.direction === null || point?.direction === undefined ? null : normalizeTunnelDirection(point.direction)
    }];
  });
  if (entryPoints.length === 0) return null;
  if (step === "direction-a") return { tunnelId, step, entryPoints: entryPoints.slice(0, 1) };
  if (step === "point-b") {
    if (!Number.isInteger(entryPoints[0].direction)) return { tunnelId, step: "direction-a", entryPoints: entryPoints.slice(0, 1) };
    return { tunnelId, step, entryPoints: entryPoints.slice(0, 1) };
  }
  if (entryPoints.length < 2) return { tunnelId, step: "point-b", entryPoints: entryPoints.slice(0, 1) };
  return { tunnelId, step, entryPoints };
}

function findTunnelDraftEntryAtIndex(state, index) {
  const draft = normalizeTunnelDraft(state?.tunnelDraft);
  if (!draft) return null;
  const entryIndex = draft.entryPoints.findIndex((point) => point.index === Number(index));
  if (entryIndex < 0) return null;
  return { draft, entryIndex, entryPoint: draft.entryPoints[entryIndex] };
}

function draftUsesIndex(state, index) {
  return normalizeTunnelDraft(state?.tunnelDraft)?.entryPoints.some((point) => point.index === Number(index)) ?? false;
}

function startTunnelDraftAt(state, index) {
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  if (usedTunnelIndexes(state).has(Number(index))) return { changed: false, reason: "tunnel-overlap" };
  if (!Number.isInteger(state.nextTunnelId) || state.nextTunnelId < 0) {
    state.nextTunnelId = nextTunnelSequence(state.tunnelElement);
  }
  state.tunnelDraft = {
    tunnelId: state.nextTunnelId,
    step: "direction-a",
    entryPoints: [{ index: Number(index), direction: null }]
  };
  state.activeTunnelId = null;
  return { changed: true, action: "tunnel-point-a-selected", tunnelId: state.nextTunnelId };
}

function placeTunnelDraftPointB(state, index) {
  const draft = normalizeTunnelDraft(state.tunnelDraft);
  if (!draft || draft.step !== "point-b") return { changed: false, reason: "tunnel-needs-direction-a" };
  if (draft.entryPoints[0].index === Number(index)) return { changed: false, reason: "tunnel-same-point" };
  if (usedTunnelIndexes(state).has(Number(index)) || draftUsesIndex(state, index)) return { changed: false, reason: "tunnel-overlap" };
  state.tunnelDraft = {
    ...draft,
    step: "direction-b",
    entryPoints: [...draft.entryPoints, { index: Number(index), direction: null }]
  };
  return { changed: true, action: "tunnel-point-b-selected", tunnelId: draft.tunnelId };
}

function setTunnelDraftDirection(state, direction) {
  const draft = normalizeTunnelDraft(state.tunnelDraft);
  if (!draft) return { changed: false, reason: "tunnel-draft-missing" };
  if (draft.step === "direction-a") {
    state.tunnelDraft = {
      ...draft,
      step: "point-b",
      entryPoints: [{ ...draft.entryPoints[0], direction: normalizeTunnelDirection(direction) }]
    };
    return { changed: true, action: "tunnel-direction-a-selected", tunnelId: draft.tunnelId };
  }
  if (draft.step !== "direction-b" || draft.entryPoints.length !== 2) return { changed: false, reason: "tunnel-needs-point-b" };
  const tunnel = {
    tunnelId: draft.tunnelId,
    entryPoints: [
      { ...draft.entryPoints[0], direction: normalizeTunnelDirection(draft.entryPoints[0].direction) },
      { ...draft.entryPoints[1], direction: normalizeTunnelDirection(direction) }
    ]
  };
  state.tunnelElement = [...normalizeTunnelElement(state.tunnelElement), tunnel];
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  state.activeTunnelId = tunnel.tunnelId;
  state.nextTunnelId = Math.max(Number(state.nextTunnelId) || 0, tunnel.tunnelId + 1, nextTunnelSequence(state.tunnelElement));
  state.tunnelDraft = null;
  return { changed: true, action: "tunnel-created", tunnelId: tunnel.tunnelId };
}

function cancelTunnelDraft(state) {
  const changed = Boolean(state.tunnelDraft);
  state.tunnelDraft = null;
  return changed;
}

function setTunnelEntryIndex(state, tunnelId, entryIndex, index) {
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  const tunnel = state.tunnelElement.find((entry) => entry.tunnelId === Number(tunnelId));
  if (!tunnel || ![0, 1].includes(Number(entryIndex))) return false;
  const duplicate = tunnel.entryPoints.some((point, pointIndex) => pointIndex !== Number(entryIndex) && point.index === Number(index));
  if (duplicate || usedTunnelIndexes(state, tunnel.tunnelId).has(Number(index))) return false;
  tunnel.entryPoints[Number(entryIndex)].index = Number(index);
  state.activeTunnelId = tunnel.tunnelId;
  return true;
}

function setTunnelEntryDirection(state, tunnelId, entryIndex, direction) {
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  const tunnel = state.tunnelElement.find((entry) => entry.tunnelId === Number(tunnelId));
  if (!tunnel || ![0, 1].includes(Number(entryIndex))) return false;
  tunnel.entryPoints[Number(entryIndex)].direction = normalizeTunnelDirection(direction);
  state.activeTunnelId = tunnel.tunnelId;
  return true;
}

function removeTunnelById(state, tunnelId) {
  const before = normalizeTunnelElement(state.tunnelElement);
  state.tunnelElement = before.filter((entry) => Number(entry.tunnelId) !== Number(tunnelId));
  if (state.activeTunnelId === Number(tunnelId)) state.activeTunnelId = null;
  return before.length !== state.tunnelElement.length;
}

function removeTunnelAtIndex(state, index) {
  const tunnel = findTunnelAtIndex(state, index);
  return tunnel ? removeTunnelById(state, tunnel.tunnelId) : false;
}

function remapTunnelIndexes(entries = [], fromWidth, toWidth) {
  if (!Number.isInteger(fromWidth) || fromWidth < 1 || !Number.isInteger(toWidth) || toWidth < 1) {
    return normalizeTunnelElement(entries);
  }
  return normalizeTunnelElement(entries).map((entry) => ({
    ...entry,
    entryPoints: entry.entryPoints.map((point) => {
      const x = point.index % fromWidth;
      const y = Math.floor(point.index / fromWidth);
      return { ...point, index: (y * toWidth) + x };
    })
  }));
}


// ---- js/objects/one-way-object.js ----

const ONE_WAY_DIRECTION_META = Object.freeze({
  [GATE_DIRECTIONS.UP]: { key: "up", label: "Up", className: "up", icon: "▲" },
  [GATE_DIRECTIONS.DOWN]: { key: "down", label: "Down", className: "down", icon: "▼" },
  [GATE_DIRECTIONS.RIGHT]: { key: "right", label: "Right", className: "right", icon: "▶" },
  [GATE_DIRECTIONS.LEFT]: { key: "left", label: "Left", className: "left", icon: "◀" }
});

const ONE_WAY_COLORS = Object.freeze(["#d44f3a", "#1d8f78", "#7357d8", "#c48612", "#2673c7", "#b84f90"]);

function createOneWayTool() {
  return {
    id: ONE_WAY_ASSET_ID,
    kind: "one-way",
    category: "element",
    label: "One Way",
    icon: "▲"
  };
}

function isOneWayTool(object) {
  return object?.kind === "one-way" || object?.id === ONE_WAY_ASSET_ID;
}

function normalizeOneWayDirection(value) {
  const direction = Number(value);
  return Object.hasOwn(ONE_WAY_DIRECTION_META, direction) ? direction : GATE_DIRECTIONS.UP;
}

function isValidOneWayDirection(value) {
  return Number.isInteger(value) && Object.hasOwn(ONE_WAY_DIRECTION_META, value);
}

function oneWayDirectionLabel(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].label;
}

function oneWayDirectionClass(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].className;
}

function oneWayDirectionKey(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].key;
}

function oneWayDirectionIcon(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].icon;
}

function reverseOneWayDirection(direction) {
  return {
    [GATE_DIRECTIONS.UP]: GATE_DIRECTIONS.DOWN,
    [GATE_DIRECTIONS.DOWN]: GATE_DIRECTIONS.UP,
    [GATE_DIRECTIONS.RIGHT]: GATE_DIRECTIONS.LEFT,
    [GATE_DIRECTIONS.LEFT]: GATE_DIRECTIONS.RIGHT
  }[normalizeOneWayDirection(direction)];
}

function oneWayColor(oneWayId) {
  return ONE_WAY_COLORS[Math.abs(Number(oneWayId) || 0) % ONE_WAY_COLORS.length];
}

function normalizeOneWayElement(entries = []) {
  if (!Array.isArray(entries)) return [];
  const usedIds = new Set();
  let nextId = 0;
  return entries.flatMap((entry) => {
    const points = Array.isArray(entry?.entryPoints) ? entry.entryPoints.slice(0, 2) : [];
    if (points.length !== 2) return [];
    const entryPoints = points.map((point) => ({
      index: Math.floor(Number(point?.index)),
      direction: normalizeOneWayDirection(point?.direction)
    }));
    if (entryPoints.some((point) => !Number.isInteger(point.index) || point.index < 0)) return [];

    let oneWayId = Number(entry?.oneWayId);
    if (!Number.isInteger(oneWayId) || oneWayId < 0 || usedIds.has(oneWayId)) {
      while (usedIds.has(nextId)) nextId += 1;
      oneWayId = nextId;
    }
    usedIds.add(oneWayId);
    return [{ oneWayId, entryPoints }];
  }).sort((a, b) => a.oneWayId - b.oneWayId);
}

function nextOneWaySequence(entries = []) {
  const ids = normalizeOneWayElement(entries).map((entry) => entry.oneWayId);
  return ids.length > 0 ? Math.max(...ids) + 1 : 0;
}

function findOneWayById(state, oneWayId) {
  return normalizeOneWayElement(state?.oneWayElement)
    .find((entry) => Number(entry.oneWayId) === Number(oneWayId)) ?? null;
}

function findOneWayAtIndex(state, index) {
  return normalizeOneWayElement(state?.oneWayElement)
    .find((entry) => entry.entryPoints.some((point) => point.index === Number(index))) ?? null;
}

function findOneWayEntryAtIndex(state, index) {
  const oneWay = findOneWayAtIndex(state, index);
  if (!oneWay) return null;
  const entryIndex = oneWay.entryPoints.findIndex((point) => point.index === Number(index));
  return { oneWay, entryIndex, entryPoint: oneWay.entryPoints[entryIndex] };
}

function usedOneWayIndexes(state, excludeOneWayId = null) {
  const used = new Set();
  normalizeOneWayElement(state?.oneWayElement).forEach((oneWay) => {
    if (Number(oneWay.oneWayId) === Number(excludeOneWayId)) return;
    oneWay.entryPoints.forEach((point) => used.add(point.index));
  });
  return used;
}

function normalizeOneWayDraft(draft) {
  if (!draft || typeof draft !== "object") return null;
  const oneWayId = Number(draft.oneWayId);
  if (!Number.isInteger(oneWayId) || oneWayId < 0) return null;
  const allowedSteps = new Set(["direction-a", "point-b", "direction-b"]);
  const step = allowedSteps.has(draft.step) ? draft.step : "direction-a";
  const rawPoints = Array.isArray(draft.entryPoints) ? draft.entryPoints.slice(0, 2) : [];
  const entryPoints = rawPoints.flatMap((point) => {
    const index = Math.floor(Number(point?.index));
    if (!Number.isInteger(index) || index < 0) return [];
    return [{
      index,
      direction: point?.direction === null || point?.direction === undefined ? null : normalizeOneWayDirection(point.direction)
    }];
  });
  if (entryPoints.length === 0) return null;
  if (step === "direction-a") return { oneWayId, step, entryPoints: entryPoints.slice(0, 1) };
  if (step === "point-b") {
    if (!Number.isInteger(entryPoints[0].direction)) return { oneWayId, step: "direction-a", entryPoints: entryPoints.slice(0, 1) };
    return { oneWayId, step, entryPoints: entryPoints.slice(0, 1) };
  }
  if (entryPoints.length < 2) return { oneWayId, step: "point-b", entryPoints: entryPoints.slice(0, 1) };
  return { oneWayId, step, entryPoints };
}

function findOneWayDraftEntryAtIndex(state, index) {
  const draft = normalizeOneWayDraft(state?.oneWayDraft);
  if (!draft) return null;
  const entryIndex = draft.entryPoints.findIndex((point) => point.index === Number(index));
  if (entryIndex < 0) return null;
  return { draft, entryIndex, entryPoint: draft.entryPoints[entryIndex] };
}

function draftUsesIndex(state, index) {
  return normalizeOneWayDraft(state?.oneWayDraft)?.entryPoints.some((point) => point.index === Number(index)) ?? false;
}

function startOneWayDraftAt(state, index) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  if (usedOneWayIndexes(state).has(Number(index))) return { changed: false, reason: "one-way-overlap" };
  if (!Number.isInteger(state.nextOneWayId) || state.nextOneWayId < 0) {
    state.nextOneWayId = nextOneWaySequence(state.oneWayElement);
  }
  state.oneWayDraft = {
    oneWayId: state.nextOneWayId,
    step: "direction-a",
    entryPoints: [{ index: Number(index), direction: null }]
  };
  state.activeOneWayId = null;
  return { changed: true, action: "one-way-point-a-selected", oneWayId: state.nextOneWayId };
}

function placeOneWayDraftPointB(state, index) {
  const draft = normalizeOneWayDraft(state.oneWayDraft);
  if (!draft || draft.step !== "point-b") return { changed: false, reason: "one-way-needs-direction-a" };
  if (draft.entryPoints[0].index === Number(index)) return { changed: false, reason: "one-way-same-point" };
  if (usedOneWayIndexes(state).has(Number(index)) || draftUsesIndex(state, index)) return { changed: false, reason: "one-way-overlap" };
  state.oneWayDraft = {
    ...draft,
    step: "direction-b",
    entryPoints: [...draft.entryPoints, { index: Number(index), direction: null }]
  };
  return { changed: true, action: "one-way-point-b-selected", oneWayId: draft.oneWayId };
}

function setOneWayDraftDirection(state, direction) {
  const draft = normalizeOneWayDraft(state.oneWayDraft);
  if (!draft) return { changed: false, reason: "one-way-draft-missing" };
  if (draft.step === "direction-a") {
    state.oneWayDraft = {
      ...draft,
      step: "point-b",
      entryPoints: [{ ...draft.entryPoints[0], direction: normalizeOneWayDirection(direction) }]
    };
    return { changed: true, action: "one-way-direction-a-selected", oneWayId: draft.oneWayId };
  }
  if (draft.step !== "direction-b" || draft.entryPoints.length !== 2) return { changed: false, reason: "one-way-needs-point-b" };
  const oneWay = {
    oneWayId: draft.oneWayId,
    entryPoints: [
      { ...draft.entryPoints[0], direction: normalizeOneWayDirection(draft.entryPoints[0].direction) },
      { ...draft.entryPoints[1], direction: normalizeOneWayDirection(direction) }
    ]
  };
  state.oneWayElement = [...normalizeOneWayElement(state.oneWayElement), oneWay];
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  state.activeOneWayId = oneWay.oneWayId;
  state.nextOneWayId = Math.max(Number(state.nextOneWayId) || 0, oneWay.oneWayId + 1, nextOneWaySequence(state.oneWayElement));
  state.oneWayDraft = null;
  return { changed: true, action: "one-way-created", oneWayId: oneWay.oneWayId };
}

function cancelOneWayDraft(state) {
  const changed = Boolean(state.oneWayDraft);
  state.oneWayDraft = null;
  return changed;
}

function setOneWayEntryIndex(state, oneWayId, entryIndex, index) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  const oneWay = state.oneWayElement.find((entry) => entry.oneWayId === Number(oneWayId));
  if (!oneWay || ![0, 1].includes(Number(entryIndex))) return false;
  const duplicate = oneWay.entryPoints.some((point, pointIndex) => pointIndex !== Number(entryIndex) && point.index === Number(index));
  if (duplicate || usedOneWayIndexes(state, oneWay.oneWayId).has(Number(index))) return false;
  oneWay.entryPoints[Number(entryIndex)].index = Number(index);
  state.activeOneWayId = oneWay.oneWayId;
  return true;
}

function setOneWayDirection(state, oneWayId, direction) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  const oneWay = state.oneWayElement.find((entry) => entry.oneWayId === Number(oneWayId));
  if (!oneWay) return false;
  const nextDirection = normalizeOneWayDirection(direction);
  oneWay.entryPoints = oneWay.entryPoints.map((point) => ({ ...point, direction: nextDirection }));
  state.activeOneWayId = oneWay.oneWayId;
  return true;
}

function setOneWayEntryDirection(state, oneWayId, entryIndex, direction) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  const oneWay = state.oneWayElement.find((entry) => entry.oneWayId === Number(oneWayId));
  if (!oneWay || ![0, 1].includes(Number(entryIndex))) return false;
  oneWay.entryPoints[Number(entryIndex)].direction = normalizeOneWayDirection(direction);
  state.activeOneWayId = oneWay.oneWayId;
  return true;
}

function removeOneWayById(state, oneWayId) {
  const before = normalizeOneWayElement(state.oneWayElement);
  state.oneWayElement = before.filter((entry) => Number(entry.oneWayId) !== Number(oneWayId));
  if (state.activeOneWayId === Number(oneWayId)) state.activeOneWayId = null;
  return before.length !== state.oneWayElement.length;
}

function removeOneWayAtIndex(state, index) {
  const oneWay = findOneWayAtIndex(state, index);
  return oneWay ? removeOneWayById(state, oneWay.oneWayId) : false;
}

function remapOneWayIndexes(entries = [], fromWidth, toWidth) {
  if (!Number.isInteger(fromWidth) || fromWidth < 1 || !Number.isInteger(toWidth) || toWidth < 1) {
    return normalizeOneWayElement(entries);
  }
  return normalizeOneWayElement(entries).map((entry) => ({
    ...entry,
    entryPoints: entry.entryPoints.map((point) => {
      const x = point.index % fromWidth;
      const y = Math.floor(point.index / fromWidth);
      return { ...point, index: (y * toWidth) + x };
    })
  }));
}


// ---- js/objects/object-registry.js ----









const objects = [
  { id: "snake-start", kind: "snake", category: "item", label: "Train Head", icon: TRAIN_HEAD_ICON, direction: "right", uniqueOnMap: true },
  createEmptyTray(),
  createFruit("apple", "Block 1", BLOCK_ITEM_GLYPH),
  createFruit("banana", "Block 2", BLOCK_ITEM_GLYPH),
  createFruit("grape", "Block 3", BLOCK_ITEM_GLYPH),
  createFruit("eggplant", "Block 4", BLOCK_ITEM_GLYPH),
  createFruit("block5", "Block 5", BLOCK_ITEM_GLYPH),
  createFruit("block6", "Block 6", BLOCK_ITEM_GLYPH),
  createFruit("block7", "Block 7", BLOCK_ITEM_GLYPH),
  createBridge(),
  createGate(),
  createCountBarrierTool(),
  createTunnelTool(),
  createOneWayTool(),
  { id: MYSTERY_FRUIT_ASSET_ID, kind: "mystery-fruit", category: "element", label: "Mystery Fruit", icon: "?" },
  { id: TERRAIN_ASSET_IDS.GRASS, kind: "terrain", category: "terrain", label: "Grass", icon: "▦" },
  { id: TERRAIN_ASSET_IDS.EMPTY, kind: "terrain", category: "terrain", label: "Terrain trống", icon: "□" },
  { id: TERRAIN_ASSET_IDS.PRIORITY_POINT, kind: "priority-point", category: "terrain", label: "PriorityPoint", icon: "•" }
];

const OBJECTS = Object.freeze(objects.map(Object.freeze));

function findObject(id) {
  return OBJECTS.find((object) => String(object.id) === String(id)) ?? null;
}

function cloneObject(object) {
  return object ? structuredClone(object) : null;
}

function objectsByCategory(category) {
  return OBJECTS.filter((object) => object.category === category);
}


// ---- js/core/editor-state.js ----





function createLayer(layerNumber = 0) {
  return {
    id: createId("layer"),
    layer: layerNumber,
    name: `Layer ${String(layerNumber + 1).padStart(2, "0")}`,
    visible: true,
    cells: {}
  };
}

function reindexLayers(layers) {
  if (!Array.isArray(layers)) return layers;
  layers.forEach((layer, index) => {
    layer.layer = index;
    layer.name = `Layer ${String(index + 1).padStart(2, "0")}`;
  });
  return layers;
}


function createInitialState() {
  const firstLayer = createLayer(0);
  const grid = structuredClone(BASE_MAP_SIZE);
  return {
    grid,
    sharedCells: {},
    grassCells: createFullGrassCells(grid),
    priorityPoints: {},
    mysteryFruitElement: [],
    mysteryFruitDebug: false,
    countBarrierElement: [],
    selectedCountBarrierCount: 1,
    activeBarrierId: null,
    nextBarrierId: 0,
    drawingCountBarrierId: null,
    tunnelElement: [],
    activeTunnelId: null,
    nextTunnelId: 0,
    tunnelDraft: null,
    oneWayElement: [],
    activeOneWayId: null,
    nextOneWayId: 0,
    oneWayDraft: null,
    layers: [firstLayer],
    activeLayerId: firstLayer.id,
    selectedCell: null,
    activeTrayCell: null,
    selectedAssetId: "snake-start",
    selectedBridgeAxis: 0,
    selectedGateDirection: 0,
    tool: "path",
    eraseMode: "smart",
    tab: "level",
    fileName: "untitled-level.json",
    sourceFileName: null,
    fileDirty: true
  };
}

class EditorState {
  constructor(initialState = createInitialState()) {
    this.data = ensureTerrainState(structuredClone(initialState));
    this.events = new EventBus();
    this.history = new HistoryManager(MAX_HISTORY);
    this.inTransaction = false;
  }

  get activeLayer() {
    return this.data.layers.find((layer) => layer.id === this.data.activeLayerId) ?? this.data.layers[0];
  }

  replace(nextState, { record = false } = {}) {
    if (record) this.history.push(this.data);
    this.data = ensureTerrainState(structuredClone(nextState));
    this.events.emit("change", this.data);
  }

  mutate(mutator) {
    if (!this.inTransaction) this.history.push(this.data);
    const result = mutator(this.data);
    this.events.emit("change", this.data);
    return result;
  }

  beginTransaction() {
    if (this.inTransaction) return;
    this.history.push(this.data);
    this.inTransaction = true;
  }

  endTransaction() {
    this.inTransaction = false;
  }

  notify() {
    this.events.emit("change", this.data);
  }

  undo() {
    this.endTransaction();
    const snapshot = this.history.undo(this.data);
    if (snapshot) this.replace(snapshot);
  }

  redo() {
    this.endTransaction();
    const snapshot = this.history.redo(this.data);
    if (snapshot) this.replace(snapshot);
  }
}


// ---- js/data/level-schema.js ----

function createLevelDocument(editorData) {
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: { name: "Snacky Level", updatedAt: new Date().toISOString() },
    grid: structuredClone(editorData.grid),
    sharedCells: structuredClone(editorData.sharedCells ?? {}),
    activeLayerId: editorData.activeLayerId,
    layers: structuredClone(editorData.layers),
    mysteryFruitElement: structuredClone(editorData.mysteryFruitElement ?? []),
    countBarrierElement: structuredClone(editorData.countBarrierElement ?? []),
    tunnelElement: structuredClone(editorData.tunnelElement ?? []),
    oneWayElement: structuredClone(editorData.oneWayElement ?? [])
  };
}


// ---- js/data/migration.js ----


function migrateFruitItemId(item) {
  if (item?.kind !== "fruit") return item;
  return { ...item, id: FRUIT_ITEM_IDS[item.fruitType] ?? item.id };
}

function migrateLevel(input) {
  const data = structuredClone(input);
  const version = Number(data.schemaVersion ?? 1);
  if (version > SCHEMA_VERSION) throw new Error(`Schema ${version} chưa được hỗ trợ.`);

  if (version === 1) {
    data.layers = (data.layers ?? []).map((layer) => ({
      ...layer,
      cells: Array.isArray(layer.cells) ? Object.fromEntries(layer.cells) : (layer.cells ?? {})
    }));
  }

  if (version < 3 || !data.sharedCells) {
    const sharedCells = {};
    data.layers = (data.layers ?? []).map((layer) => {
      const fruitCells = {};
      Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
        const shared = sharedCells[key] ?? { path: false, item: null, element: null };
        if (cell.path) shared.path = true;
        if (cell.element && !shared.element) shared.element = structuredClone(cell.element);
        if (cell.item?.kind === "fruit") {
          fruitCells[key] = { item: structuredClone(cell.item) };
        } else if (cell.item && !shared.item) {
          shared.item = structuredClone(cell.item);
        }
        if (shared.path || shared.item || shared.element) sharedCells[key] = shared;
      });
      return { ...layer, cells: fruitCells };
    });
    data.sharedCells = sharedCells;
  }

  Object.values(data.sharedCells ?? {}).forEach((cell) => {
    if (cell.item?.kind === "fruit") cell.item = migrateFruitItemId(cell.item);
  });
  (data.layers ?? []).forEach((layer) => {
    Object.values(layer.cells ?? {}).forEach((cell) => {
      if (cell.item?.kind === "fruit") cell.item = migrateFruitItemId(cell.item);
    });
  });

  data.schemaVersion = SCHEMA_VERSION;
  return data;
}


// ---- js/data/serializer.js ----










const TYPE_BY_ITEM_ID = Object.freeze(Object.fromEntries(Object.entries(FRUIT_ITEM_IDS).map(([type, id]) => [String(id), type])));
const GAME_FORMAT_FRUIT_META = Object.freeze(Object.fromEntries(FRUIT_TYPES.map((type) => [
  type,
  { label: blockLabelForFruitType(type), icon: BLOCK_ITEM_GLYPH }
])));

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} phải là một mảng.`);
}

function assertIndex(index, total, name) {
  if (!Number.isInteger(index) || index < 0 || index >= total) throw new Error(`${name} có index ${index} nằm ngoài map.`);
}

function createImportedItem(itemId) {
  const type = TYPE_BY_ITEM_ID[String(itemId)];
  if (!type) return { id: itemId, itemId, kind: "fruit", category: "item", fruitType: `unknown-${itemId}`, label: `Unknown #${itemId}`, icon: "❓", unknown: true };
  return { id: itemId, kind: "fruit", category: "item", fruitType: type, label: GAME_FORMAT_FRUIT_META[type].label, icon: GAME_FORMAT_FRUIT_META[type].icon };
}

function normalizeTrayGroups(rawTrays, width) {
  const withExplicitPositions = (tray) => {
    if (tray?.deliverPoint && tray?.trayPosition) return tray;
    const deliverPoint = tray?.deliverPoint ?? tray?.positions?.[0];
    if (!deliverPoint) return tray;
    return {
      trayId: tray.trayId,
      deliverPoint: { index: deliverPoint.index },
      trayPosition: { index: deliverPoint.index - width },
      layers: tray.layers ?? []
    };
  };
  if (Array.isArray(rawTrays)) return rawTrays.map(withExplicitPositions);
  if (!rawTrays || !Array.isArray(rawTrays.positions) || !Array.isArray(rawTrays.layers)) return rawTrays;
  const groups = new Map();
  const ensureGroup = (trayId) => {
    if (!groups.has(trayId)) groups.set(trayId, { trayId, positions: [], layers: [] });
    return groups.get(trayId);
  };
  rawTrays.positions.forEach(({ trayId, index }) => ensureGroup(trayId).positions.push({ index }));
  rawTrays.layers.forEach(({ trayId, layer, items }) => ensureGroup(trayId).layers.push({ layer, items }));
  return [...groups.values()].sort((a, b) => a.trayId - b.trayId).map(withExplicitPositions);
}

function validateStructure(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Root JSON phải là object.");
  const width = raw.map?.width;
  const height = raw.map?.height;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) throw new Error("map.width và map.height phải là số nguyên dương.");
  assertArray(raw.Path?.index, "Path.index");
  assertArray(raw.Grass?.index, "Grass.index");
  assertArray(raw.PriorityPoint?.index, "PriorityPoint.index");
  assertArray(raw.spawns, "spawns");
  assertArray(raw.itemLayers, "itemLayers");
  assertArray(raw.trays, "trays");
  if (raw.bridgeElement !== undefined) assertArray(raw.bridgeElement, "bridgeElement");
  if (raw.gateElement !== undefined) assertArray(raw.gateElement, "gateElement");
  if (raw.tunnelElement !== undefined) assertArray(raw.tunnelElement, "tunnelElement");
  if (raw.oneWayElement !== undefined) assertArray(raw.oneWayElement, "oneWayElement");
  if (raw.mysteryFruitElement !== undefined) assertArray(raw.mysteryFruitElement, "mysteryFruitElement");
  if (raw.countBarrierElement !== undefined) assertArray(raw.countBarrierElement, "countBarrierElement");
  if (raw.elements !== undefined) {
    if (typeof raw.elements !== "object" || Array.isArray(raw.elements)) throw new Error("elements phải là object.");
    if (Object.keys(raw.elements).length > 0) throw new Error("Format element chưa được hỗ trợ; elements hiện phải là object rỗng.");
  }
  const total = width * height;
  raw.Path.index.forEach((index, i) => assertIndex(index, total, `Path.index[${i}]`));
  raw.Grass.index.forEach((index, i) => assertIndex(index, total, `Grass.index[${i}]`));
  raw.PriorityPoint.index.forEach((index, i) => assertIndex(index, total, `PriorityPoint.index[${i}]`));
  const pathIndexes = new Set(raw.Path.index);
  const grassIndexes = new Set(raw.Grass.index);
  if (pathIndexes.size !== raw.Path.index.length) throw new Error("Path.index không được chứa index trùng.");
  if (grassIndexes.size !== raw.Grass.index.length) throw new Error("Grass.index không được chứa index trùng.");
  if (new Set(raw.PriorityPoint.index).size !== raw.PriorityPoint.index.length) throw new Error("PriorityPoint.index không được chứa index trùng.");
  raw.Grass.index.forEach((index, i) => {
    if (pathIndexes.has(index)) throw new Error(`Grass.index[${i}] không được trùng Path.index.`);
  });
  raw.PriorityPoint.index.forEach((index, i) => {
    if (!pathIndexes.has(index)) throw new Error(`PriorityPoint.index[${i}] phải thuộc Path.index.`);
  });
  const bridgeIndexes = new Set();
  (raw.bridgeElement ?? []).forEach((bridge, i) => {
    assertIndex(bridge?.index, total, `bridgeElement[${i}]`);
    if (![0, 1].includes(bridge?.axis)) throw new Error(`bridgeElement[${i}].axis phải là 0 hoặc 1.`);
    if (bridgeIndexes.has(bridge.index)) throw new Error(`bridgeElement index ${bridge.index} bị trùng.`);
    bridgeIndexes.add(bridge.index);
  });
  const gateIndexes = new Set();
  (raw.gateElement ?? []).forEach((gate, i) => {
    assertIndex(gate?.index, total, `gateElement[${i}]`);
    if (!isValidGateDirection(gate?.direction)) throw new Error(`gateElement[${i}].direction phải là 0, 1, 2 hoặc 3.`);
    if (gateIndexes.has(gate.index)) throw new Error(`gateElement index ${gate.index} bị trùng.`);
    if (bridgeIndexes.has(gate.index)) throw new Error(`Gate và Bridge không được trùng index ${gate.index}.`);
    gateIndexes.add(gate.index);
  });
  const barrierIds = new Set();
  const barrierIndexes = new Set();
  (raw.countBarrierElement ?? []).forEach((barrier, i) => {
    if (!Number.isInteger(barrier?.barrierId) || barrier.barrierId < 0) throw new Error(`countBarrierElement[${i}].barrierId phải là số nguyên không âm.`);
    if (barrierIds.has(barrier.barrierId)) throw new Error(`countBarrierElement barrierId ${barrier.barrierId} bị trùng.`);
    barrierIds.add(barrier.barrierId);
    if (!Number.isInteger(barrier?.count) || barrier.count < 1) throw new Error(`countBarrierElement[${i}].count phải là số nguyên dương.`);
    assertIndex(barrier?.startIndex, total, `countBarrierElement[${i}].startIndex`);
    assertIndex(barrier?.endIndex, total, `countBarrierElement[${i}].endIndex`);
    if (barrier.startIndex === barrier.endIndex) throw new Error(`countBarrierElement[${i}] phải có startIndex và endIndex khác nhau.`);
    assertArray(barrier.index, `countBarrierElement[${i}].index`);
    if (barrier.index.length < 2) throw new Error(`countBarrierElement[${i}].index phải có ít nhất 2 ô Path.`);
    const localIndexes = new Set();
    barrier.index.forEach((index, j) => {
      assertIndex(index, total, `countBarrierElement[${i}].index[${j}]`);
      if (!pathIndexes.has(index)) throw new Error(`countBarrierElement[${i}].index[${j}] phải thuộc Path.index.`);
      if (localIndexes.has(index)) throw new Error(`countBarrierElement[${i}].index không được chứa index trùng.`);
      if (barrierIndexes.has(index)) throw new Error(`Count Barrier không được chồng index ${index}.`);
      localIndexes.add(index);
      barrierIndexes.add(index);
    });
    if (!localIndexes.has(barrier.startIndex)) throw new Error(`countBarrierElement[${i}].startIndex phải nằm trong index.`);
    if (!localIndexes.has(barrier.endIndex)) throw new Error(`countBarrierElement[${i}].endIndex phải nằm trong index.`);
  });
  const tunnelIds = new Set();
  const tunnelIndexes = new Set();
  (raw.tunnelElement ?? []).forEach((tunnel, i) => {
    if (!Number.isInteger(tunnel?.tunnelId) || tunnel.tunnelId < 0) throw new Error(`tunnelElement[${i}].tunnelId phải là số nguyên không âm.`);
    if (tunnelIds.has(tunnel.tunnelId)) throw new Error(`tunnelElement tunnelId ${tunnel.tunnelId} bị trùng.`);
    tunnelIds.add(tunnel.tunnelId);
    assertArray(tunnel.entryPoints, `tunnelElement[${i}].entryPoints`);
    if (tunnel.entryPoints.length !== 2) throw new Error(`tunnelElement[${i}].entryPoints phải có đúng 2 điểm.`);
    const localIndexes = new Set();
    tunnel.entryPoints.forEach((point, j) => {
      assertIndex(point?.index, total, `tunnelElement[${i}].entryPoints[${j}].index`);
      if (!isValidTunnelDirection(point?.direction)) throw new Error(`tunnelElement[${i}].entryPoints[${j}].direction phải là 0, 1, 2 hoặc 3.`);
      if (localIndexes.has(point.index)) throw new Error(`tunnelElement[${i}].entryPoints không được chứa index trùng.`);
      if (tunnelIndexes.has(point.index)) throw new Error(`Tunnel không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      tunnelIndexes.add(point.index);
    });
  });
  const oneWayIds = new Set();
  const oneWayIndexes = new Set();
  (raw.oneWayElement ?? []).forEach((oneWay, i) => {
    if (!Number.isInteger(oneWay?.oneWayId) || oneWay.oneWayId < 0) throw new Error(`oneWayElement[${i}].oneWayId phải là số nguyên không âm.`);
    if (oneWayIds.has(oneWay.oneWayId)) throw new Error(`oneWayElement oneWayId ${oneWay.oneWayId} bị trùng.`);
    oneWayIds.add(oneWay.oneWayId);
    assertArray(oneWay.entryPoints, `oneWayElement[${i}].entryPoints`);
    if (oneWay.entryPoints.length !== 2) throw new Error(`oneWayElement[${i}].entryPoints phải có đúng 2 điểm.`);
    const localIndexes = new Set();
    oneWay.entryPoints.forEach((point, j) => {
      assertIndex(point?.index, total, `oneWayElement[${i}].entryPoints[${j}].index`);
      if (!pathIndexes.has(point.index)) throw new Error(`oneWayElement[${i}].entryPoints[${j}].index phải thuộc Path.index.`);
      if (!isValidOneWayDirection(point?.direction)) throw new Error(`oneWayElement[${i}].entryPoints[${j}].direction phải là 0, 1, 2 hoặc 3.`);
      if (localIndexes.has(point.index)) throw new Error(`oneWayElement[${i}].entryPoints không được chứa index trùng.`);
      if (oneWayIndexes.has(point.index)) throw new Error(`One Way không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      oneWayIndexes.add(point.index);
    });
  });
  raw.spawns.forEach((spawn, i) => assertIndex(spawn?.index, total, `spawns[${i}]`));
  const fruitIndexesByLayer = new Map();
  raw.itemLayers.forEach((layer, i) => {
    if (!Number.isInteger(layer?.layer) || layer.layer < 0) throw new Error(`itemLayers[${i}].layer phải là số nguyên không âm.`);
    assertArray(layer.items, `itemLayers[${i}].items`);
    const layerFruitIndexes = fruitIndexesByLayer.get(layer.layer) ?? new Set();
    layer.items.forEach((item, j) => {
      if (!Number.isInteger(item?.itemId) || item.itemId < 0) throw new Error(`itemLayers[${i}].items[${j}].itemId không hợp lệ.`);
      assertArray(item.index, `itemLayers[${i}].items[${j}].index`);
      item.index.forEach((index, k) => {
        assertIndex(index, total, `itemLayers[${i}].items[${j}].index[${k}]`);
        layerFruitIndexes.add(index);
      });
    });
    fruitIndexesByLayer.set(layer.layer, layerFruitIndexes);
  });
  const mysteryLayers = new Set();
  (raw.mysteryFruitElement ?? []).forEach((entry, i) => {
    if (!Number.isInteger(entry?.layer) || entry.layer < 0) throw new Error(`mysteryFruitElement[${i}].layer phải là số nguyên không âm.`);
    if (mysteryLayers.has(entry.layer)) throw new Error(`mysteryFruitElement layer ${entry.layer} bị trùng.`);
    mysteryLayers.add(entry.layer);
    assertArray(entry.index, `mysteryFruitElement[${i}].index`);
    if (new Set(entry.index).size !== entry.index.length) throw new Error(`mysteryFruitElement[${i}].index không được chứa index trùng.`);
    const fruitIndexes = fruitIndexesByLayer.get(entry.layer);
    entry.index.forEach((index, j) => {
      assertIndex(index, total, `mysteryFruitElement[${i}].index[${j}]`);
      if (!fruitIndexes?.has(index)) throw new Error(`mysteryFruitElement[${i}].index[${j}] phải trỏ tới Fruit thật trong itemLayers layer ${entry.layer}.`);
    });
  });
  const trayIds = new Set();
  raw.trays.forEach((tray, i) => {
    if (!Number.isInteger(tray?.trayId) || tray.trayId < 0) throw new Error(`trays[${i}].trayId không hợp lệ.`);
    if (trayIds.has(tray.trayId)) throw new Error(`trayId ${tray.trayId} bị trùng.`);
    trayIds.add(tray.trayId);
    assertIndex(tray.deliverPoint?.index, total, `trays[${i}].deliverPoint`);
    assertIndex(tray.trayPosition?.index, total, `trays[${i}].trayPosition`);
    const deliverPoint = indexToPosition(tray.deliverPoint.index, width);
    const trayPosition = indexToPosition(tray.trayPosition.index, width);
    if (deliverPoint.x !== trayPosition.x || deliverPoint.y !== trayPosition.y + 1) {
      throw new Error(`trays[${i}] phải có trayPosition ngay phía trên deliverPoint.`);
    }
    assertArray(tray.layers, `trays[${i}].layers`);
    tray.layers.forEach((layer, layerIndex) => {
      if (!Number.isInteger(layer?.layer) || layer.layer < 0) throw new Error(`trays[${i}].layers[${layerIndex}].layer không hợp lệ.`);
      assertArray(layer.items, `trays[${i}].layers[${layerIndex}].items`);
      layer.items.forEach((item, itemIndex) => {
        if (!Number.isInteger(item?.itemId) || item.itemId < 0 || !Number.isInteger(item?.count) || item.count < 0) {
          throw new Error(`trays[${i}].layers[${layerIndex}].items[${itemIndex}] phải có itemId/count nguyên không âm.`);
        }
      });
    });
  });
  return { width, height };
}

function deserializeLevel(rawData, { fileName = "untitled-level.json" } = {}) {
  const raw = typeof rawData === "string" ? JSON.parse(rawData) : structuredClone(rawData);
  raw.trays = normalizeTrayGroups(raw.trays, raw.map?.width);
  const { width, height } = validateStructure(raw);
  const sharedCells = {};
  const ensureShared = (key) => (sharedCells[key] ??= { path: false, item: null, element: null });
  raw.Path.index.forEach((index) => {
    const { x, y } = indexToPosition(index, width);
    ensureShared(cellKey(x, y)).path = true;
  });
  const grassCells = Object.fromEntries(raw.Grass.index.map((index) => {
    const { x, y } = indexToPosition(index, width);
    return [cellKey(x, y), true];
  }));
  const priorityPoints = Object.fromEntries(raw.PriorityPoint.index.map((index) => {
    const { x, y } = indexToPosition(index, width);
    return [cellKey(x, y), "manual"];
  }));
  (raw.bridgeElement ?? []).forEach((bridge) => {
    const { x, y } = indexToPosition(bridge.index, width);
    ensureShared(cellKey(x, y)).element = createBridge(bridge.axis);
  });
  (raw.gateElement ?? []).forEach((gate) => {
    const { x, y } = indexToPosition(gate.index, width);
    ensureShared(cellKey(x, y)).element = createGate(gate.direction);
  });
  raw.spawns.forEach((spawn) => {
    const { x, y } = indexToPosition(spawn.index, width);
    ensureShared(cellKey(x, y)).item = { id: "snake-start", kind: "snake", category: "item", label: "Train Head", icon: TRAIN_HEAD_ICON, direction: "right" };
  });

  const sortedItemLayers = raw.itemLayers.slice().sort((a, b) => a.layer - b.layer);
  const sourceLayerToEditorLayer = new Map();
  const layers = sortedItemLayers
    .map((source, index) => {
      sourceLayerToEditorLayer.set(source.layer, index);
      const layer = createLayer(index);
      source.items.forEach((group) => group.index.forEach((idx) => {
        const { x, y } = indexToPosition(idx, width);
        layer.cells[cellKey(x, y)] = { item: createImportedItem(group.itemId) };
      }));
      return layer;
    });
  if (layers.length === 0) layers.push(createLayer(0));

  raw.trays.forEach((source) => {
    const trayLayers = source.layers.slice().sort((a, b) => a.layer - b.layer).map((trayLayer) => {
      const recipe = Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
      const unknownItems = [];
      trayLayer.items.forEach(({ itemId, count }) => {
        const type = TYPE_BY_ITEM_ID[String(itemId)];
        if (type) recipe[type] += count;
        else unknownItems.push({ itemId, count });
      });
      return { id: `tray-${source.trayId}-layer-${trayLayer.layer}`, layer: trayLayer.layer, recipe, unknownItems };
    });
    const { x, y } = indexToPosition(source.deliverPoint.index, width);
    const trayPosition = indexToPosition(source.trayPosition.index, width);
    ensureShared(cellKey(x, y)).item = {
      id: `tray-${source.trayId}`, trayId: source.trayId, kind: "tray", category: "item", label: "Khay chứa", icon: "🧺", capacity: 9,
      trayPosition,
      trayLayers
    };
  });

  const mysteryFruitElement = normalizeMysteryFruitElement((raw.mysteryFruitElement ?? []).map((entry) => ({
    layer: sourceLayerToEditorLayer.get(entry.layer),
    index: entry.index
  })));

  return {
    grid: { columns: width, rows: height }, sharedCells, grassCells, priorityPoints, layers, activeLayerId: layers[0].id,
    mysteryFruitElement,
    mysteryFruitDebug: false,
    countBarrierElement: normalizeCountBarrierElement(raw.countBarrierElement ?? []),
    selectedCountBarrierCount: 1,
    activeBarrierId: null,
    nextBarrierId: nextCountBarrierSequence(raw.countBarrierElement ?? []),
    drawingCountBarrierId: null,
    tunnelElement: normalizeTunnelElement(raw.tunnelElement ?? []),
    activeTunnelId: null,
    nextTunnelId: nextTunnelSequence(raw.tunnelElement ?? []),
    oneWayElement: normalizeOneWayElement(raw.oneWayElement ?? []),
    activeOneWayId: null,
    nextOneWayId: nextOneWaySequence(raw.oneWayElement ?? []),
    selectedCell: null, activeTrayCell: null, selectedAssetId: "snake-start", selectedBridgeAxis: 0, selectedGateDirection: 0, tool: "path", eraseMode: "smart", tab: "level",
    fileName: normalizeFileName(fileName), sourceFileName: normalizeFileName(fileName), fileDirty: false
  };
}

function itemIdOf(item) { return item.unknown ? Number(item.itemId ?? item.id) : Number(FRUIT_ITEM_IDS[item.fruitType] ?? item.id); }

function serializeLevel(editorData) {
  ensureTerrainState(editorData);
  const width = editorData.grid.columns;
  const road = [];
  const spawns = [];
  const trays = [];
  const bridgeElement = [];
  const gateElement = [];
  const tunnelElement = [];
  const oneWayElement = [];
  const pathIndexes = new Set();
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    const { x, y } = parseCellKey(key);
    const index = positionToIndex(x, y, width);
    if (cell.path) {
      road.push(index);
      pathIndexes.add(index);
    }
    if (isBridgeElement(cell.element)) bridgeElement.push({ index, axis: normalizeBridgeAxis(cell.element.axis) });
    if (isGateElement(cell.element)) gateElement.push({ index, direction: normalizeGateDirection(cell.element.direction) });
    if (cell.item?.kind === "snake") spawns.push({ index });
    if (cell.item?.kind === "tray") {
      const trayId = Number(cell.item.trayId);
      const layers = (cell.item.trayLayers ?? []).map((layer, order) => {
        const items = FRUIT_TYPES.filter((type) => Number(layer.recipe?.[type]) > 0)
          .map((type) => ({ itemId: FRUIT_ITEM_IDS[type], count: Number(layer.recipe[type]) }));
        (layer.unknownItems ?? []).filter((item) => Number(item.count) > 0)
          .forEach((item) => items.push({ itemId: Number(item.itemId), count: Number(item.count) }));
        return { layer: Number.isInteger(layer.layer) ? layer.layer : order, items: items.sort((a, b) => a.itemId - b.itemId) };
      });
      const trayPosition = getTrayVisualPosition(cell.item, { x, y });
      trays.push({
        trayId,
        deliverPoint: { index },
        trayPosition: { index: positionToIndex(trayPosition.x, trayPosition.y, width) },
        layers: layers.sort((a, b) => a.layer - b.layer)
      });
    }
  });
  const fruitIndexesByLayer = new Map();
  const itemLayerEntries = (editorData.layers ?? []).map((layer, order) => {
    const groups = new Map();
    Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
      if (cell.item?.kind !== "fruit") return;
      const id = itemIdOf(cell.item);
      const { x, y } = parseCellKey(key);
      const indexes = groups.get(id) ?? [];
      indexes.push(positionToIndex(x, y, width));
      groups.set(id, indexes);
    });
    const sourceLayer = Number.isInteger(layer.layer) ? layer.layer : order;
    fruitIndexesByLayer.set(sourceLayer, new Set([...groups.values()].flat()));
    return {
      layer: sourceLayer,
      items: [...groups.entries()].sort(([a], [b]) => a - b).map(([itemId, index]) => ({ itemId, index: [...new Set(index)].sort((a, b) => a - b) }))
    };
  }).filter((layer) => layer.items.length > 0)
    .sort((a, b) => a.layer - b.layer);
  const exportLayerBySourceLayer = new Map();
  const itemLayers = itemLayerEntries.map((layer, index) => {
    exportLayerBySourceLayer.set(layer.layer, index);
    return { ...layer, layer: index };
  });
  const mysteryFruitElement = normalizeMysteryFruitElement(editorData.mysteryFruitElement)
    .map((entry) => {
      const exportedLayer = exportLayerBySourceLayer.get(entry.layer);
      const fruitIndexes = fruitIndexesByLayer.get(entry.layer) ?? new Set();
      if (!Number.isInteger(exportedLayer)) return null;
      return {
        layer: exportedLayer,
        index: entry.index.filter((index) => fruitIndexes.has(index))
      };
    })
    .filter((entry) => entry?.index.length > 0);
  const countBarrierElement = normalizeCountBarrierElement(editorData.countBarrierElement)
    .map((entry) => ({
      ...entry,
      index: entry.index.filter((index) => pathIndexes.has(index)).sort((a, b) => a - b)
    }))
    .filter((entry) => entry.index.length > 0 && entry.index.includes(entry.startIndex) && entry.index.includes(entry.endIndex));
  normalizeTunnelElement(editorData.tunnelElement)
    .forEach((entry) => {
      const points = entry.entryPoints
        .map((point) => ({ index: point.index, direction: normalizeTunnelDirection(point.direction) }));
      if (points.length === 2 && points[0].index !== points[1].index) {
        tunnelElement.push({ tunnelId: entry.tunnelId, entryPoints: points });
      }
    });
  normalizeOneWayElement(editorData.oneWayElement)
    .forEach((entry) => {
      const points = entry.entryPoints
        .filter((point) => pathIndexes.has(point.index))
        .map((point) => ({ index: point.index, direction: normalizeOneWayDirection(point.direction) }));
      if (points.length === 2 && points[0].index !== points[1].index) {
        oneWayElement.push({ oneWayId: entry.oneWayId, entryPoints: points });
      }
    });
  const grass = Object.keys(editorData.grassCells ?? {}).map((key) => {
    const { x, y } = parseCellKey(key);
    return positionToIndex(x, y, width);
  }).sort((a, b) => a - b);
  const priorityPoints = Object.keys(editorData.priorityPoints ?? {}).map((key) => {
    const { x, y } = parseCellKey(key);
    return positionToIndex(x, y, width);
  }).sort((a, b) => a - b);
  return {
    map: { width, height: editorData.grid.rows },
    Path: { index: [...new Set(road)].sort((a, b) => a - b) },
    Grass: { index: [...new Set(grass)] },
    PriorityPoint: { index: [...new Set(priorityPoints)] },
    spawns: spawns.sort((a, b) => a.index - b.index), itemLayers,
    trays: trays.sort((a, b) => a.trayId - b.trayId),
    bridgeElement: bridgeElement.sort((a, b) => a.index - b.index),
    gateElement: gateElement.sort((a, b) => a.index - b.index),
    mysteryFruitElement,
    countBarrierElement,
    tunnelElement: tunnelElement.sort((a, b) => a.tunnelId - b.tunnelId),
    oneWayElement: oneWayElement.sort((a, b) => a.oneWayId - b.oneWayId)
  };
}

function serializeEditorState(editorData) { ensureTerrainState(editorData); return { editorStateVersion: 1, data: structuredClone(editorData) }; }
function deserializeEditorState(rawData) {
  const raw = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  if (raw?.editorStateVersion !== 1 || !raw.data?.grid || !Array.isArray(raw.data.layers)) throw new Error("Stored editor state không hợp lệ.");
  return ensureTerrainState(structuredClone(raw.data));
}

function normalizeFileName(value) {
  const base = String(value ?? "").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\.json$/i, "") || "untitled-level";
  return `${base}.json`;
}


// ---- js/data/validator.js ----










function collectStats(layer) {
  const stats = {
    paths: 0, items: 0, snake: 0, fruits: 0, capacity: 0,
    trays: 0, trayLayers: 0, invalidTrayRecipes: 0,
    allFruits: 0, fruitLayers: 0,
    fruitsByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    allFruitsByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    capacityByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    bridges: 0,
    gates: 0,
    mysteryFruits: 0,
    countBarriers: 0,
    countBarrierCells: 0,
    tunnels: 0,
    oneWays: 0
  };
  Object.values(layer?.cells ?? {}).forEach((cell) => {
    if (cell.path) stats.paths += 1;
    if (isBridgeElement(cell.element)) stats.bridges += 1;
    if (isGateElement(cell.element)) stats.gates += 1;
    if (!cell.item) return;
    stats.items += 1;
    if (cell.item.kind === "snake") stats.snake += 1;
    if (cell.item.kind === "fruit") {
      stats.fruits += 1;
      stats.fruitsByType[cell.item.fruitType] = (stats.fruitsByType[cell.item.fruitType] ?? 0) + 1;
    }
    if (cell.item.kind === "truck") {
      const capacity = Number(cell.item.capacity) || 0;
      stats.capacity += capacity;
      stats.capacityByType[cell.item.fruitType] = (stats.capacityByType[cell.item.fruitType] ?? 0) + capacity;
    }
    if (cell.item.kind === "tray") {
      stats.trays += 1;
      const trayLayers = cell.item.trayLayers ?? [];
      if (trayLayers.length === 0) stats.invalidTrayRecipes += 1;
      for (const trayLayer of trayLayers) {
        stats.trayLayers += 1;
        const recipeTotal = FRUIT_TYPES.reduce((sum, type) => sum + (Number(trayLayer.recipe?.[type]) || 0), 0)
          + (trayLayer.unknownItems ?? []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
        if (recipeTotal !== 9) stats.invalidTrayRecipes += 1;
        for (const type of FRUIT_TYPES) {
          const amount = Number(trayLayer.recipe?.[type]) || 0;
          stats.capacity += amount;
          stats.capacityByType[type] += amount;
        }
      }
    }
  });
  return stats;
}

function validateLevel(level) {
  ensureTerrainState(level);
  const errors = [];
  const warnings = [];
  const indexOfKey = (key) => {
    const { x, y } = parseCellKey(key);
    return positionToIndex(x, y, level?.grid?.columns ?? 0);
  };
  if (!level?.grid || !Number.isInteger(level.grid.columns) || !Number.isInteger(level.grid.rows)) errors.push("Kích thước grid không hợp lệ.");
  if (level?.grid && (level.grid.columns < 1 || level.grid.rows < 1)) errors.push("Width và Height phải là số nguyên dương.");
  if (!Array.isArray(level?.layers) || level.layers.length === 0) errors.push("Level phải có ít nhất một layer.");

  [{ name: "Map dùng chung", cells: level?.sharedCells ?? {} }, ...(level?.layers ?? [])].forEach((layer) => {
    Object.keys(layer.cells ?? {}).forEach((key) => {
      const { x, y } = parseCellKey(key);
      if (!isInsideGrid(level.grid, x, y)) errors.push(`${layer.name}: Index ${indexOfKey(key)} nằm ngoài grid.`);
    });
  });
  Object.keys(level.grassCells ?? {}).forEach((key) => {
    const { x, y } = parseCellKey(key);
    if (!isInsideGrid(level.grid, x, y)) errors.push(`Grass: Index ${indexOfKey(key)} nằm ngoài grid.`);
    if (level.sharedCells?.[key]?.path) errors.push(`Grass Index ${indexOfKey(key)} bị trùng Path.`);
  });
  Object.keys(level.priorityPoints ?? {}).forEach((key) => {
    const { x, y } = parseCellKey(key);
    if (!isInsideGrid(level.grid, x, y)) errors.push(`PriorityPoint: Index ${indexOfKey(key)} nằm ngoài grid.`);
    else if (!level.sharedCells?.[key]?.path) errors.push(`PriorityPoint Index ${indexOfKey(key)} phải thuộc Path.`);
  });

  const stats = collectStats(createMergedLayer(level));
  (level?.layers ?? []).forEach((layer) => {
    const fruits = Object.values(layer.cells ?? {}).filter((cell) => cell.item?.kind === "fruit");
    if (fruits.length > 0) stats.fruitLayers += 1;
    fruits.forEach((cell) => {
      stats.allFruits += 1;
      stats.allFruitsByType[cell.item.fruitType] = (stats.allFruitsByType[cell.item.fruitType] ?? 0) + 1;
    });
  });
  (level?.mysteryFruitElement ?? []).forEach((entry) => { stats.mysteryFruits += entry.index?.length ?? 0; });
  normalizeCountBarrierElement(level?.countBarrierElement).forEach((entry) => {
    stats.countBarriers += 1;
    stats.countBarrierCells += entry.index.length;
  });
  stats.tunnels = normalizeTunnelElement(level?.tunnelElement).length;
  stats.oneWays = normalizeOneWayElement(level?.oneWayElement).length;
  if (!level?.sharedCells) {
    stats.allFruits = stats.fruits;
    stats.allFruitsByType = { ...stats.fruitsByType };
    stats.fruitLayers = stats.fruits > 0 ? 1 : 0;
  }
  stats.snake = Object.values(level?.sharedCells ?? {}).filter((cell) => cell.item?.kind === "snake").length || stats.snake;
  if (stats.snake !== 1) warnings.push(`Cần đúng 1 điểm bắt đầu (hiện có ${stats.snake}).`);
  if (stats.allFruits === 0) warnings.push("Chưa có trái cây trong các layer.");
  if (stats.trays === 0) warnings.push("Chưa có khay chứa trên map.");
  if (stats.invalidTrayRecipes > 0) warnings.push(`Có ${stats.invalidTrayRecipes} khay/layer chưa setup đủ recipe 9/9.`);
  FRUIT_TYPES.forEach((type) => {
    const map = stats.allFruitsByType[type];
    const tray = stats.capacityByType[type];
    if (map === 0 && tray === 0) return;
    if (map > tray) warnings.push(`Khay thiếu ${map - tray} ${blockLabelForFruitType(type)}`);
    else if (map < tray) warnings.push(`Map thiếu ${tray - map} ${blockLabelForFruitType(type)}`);
  });
  const roadKeys = new Set(Object.entries(level?.sharedCells ?? {}).filter(([, cell]) => cell.path).map(([key]) => key));
  const roadIndexes = new Set([...roadKeys].map(indexOfKey));
  const countBarrierEndpointIndexes = new Set();
  normalizeCountBarrierElement(level?.countBarrierElement).forEach((barrier) => {
    countBarrierEndpointIndexes.add(barrier.startIndex);
    countBarrierEndpointIndexes.add(barrier.endIndex);
  });
  let bridgeOrder = 0;
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!isBridgeElement(cell.element)) return;
    const bridgeLabel = `Bridge #${bridgeOrder}`;
    bridgeOrder += 1;
    const index = indexOfKey(key);
    if (![0, 1].includes(cell.element.axis)) errors.push(`Bridge tại Index ${index} có axis không hợp lệ.`);
    else cell.element.axis = normalizeBridgeAxis(cell.element.axis);
    const connections = new Set(pathConnectionsAt(level, index));
    if (![0, 1, 2, 3].every((direction) => connections.has(direction))) {
      errors.push(`⚠ ${bridgeLabel} không nằm tại ngã 4.`);
    }
    const visualCells = bridgeVisualCells(level, index);
    if (visualCells.some((position) => !isInsideGrid(level.grid, position.x, position.y))) {
      errors.push(`⚠ ${bridgeLabel} cần đủ 3 ô theo chiều ngang.`);
    }
    if (bridgeItemBlockCells(level, index).some((position) => (level.layers ?? []).some((layer) => layer.cells?.[`${position.x},${position.y}`]?.item?.kind === "fruit"))) {
      errors.push(`⚠ ${bridgeLabel} overlap Item Block trong vùng 1 ô xung quanh.`);
    }
  });
  let gateOrder = 0;
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!isGateElement(cell.element)) return;
    const gateLabel = `Gate #${gateOrder}`;
    gateOrder += 1;
    const index = indexOfKey(key);
    if (!cell.path) errors.push(`Gate tại Index ${index} phải nằm trên Path.`);
    if (!isValidGateDirection(cell.element.direction)) {
      errors.push(`Gate tại Index ${index} có direction không hợp lệ.`);
      return;
    }
    cell.element.direction = normalizeGateDirection(cell.element.direction);
    const priorityDirection = findGatePriorityDirection(level, index);
    if (priorityDirection === null || priorityDirection !== cell.element.direction) {
      errors.push(`⚠ ${gateLabel} không đứng trước PriorityPoint.`);
    }
  });
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind === "snake" && !cell.path) warnings.push(`Spawn tại Index ${indexOfKey(key)} phải nằm trên Path.`);
    if (cell.item?.kind === "tray") {
      const { x, y } = parseCellKey(key);
      const trayPosition = getTrayVisualPosition(cell.item, { x, y });
      if (trayPosition.x !== x || trayPosition.y + 1 !== y) {
        errors.push(`Khay tại Index ${indexOfKey(key)} có trayPosition không nằm ngay phía trên deliverPoint.`);
      }
      if (!cell.path) warnings.push(`Checkpoint khay tại Index ${indexOfKey(key)} phải nằm trên Path.`);
      getTrayVisualCells(cell.item, { x, y }).forEach((visual) => {
        if (!isInsideGrid(level.grid, visual.x, visual.y)) {
          warnings.push(`Visual khay 3x4 tại checkpoint Index ${indexOfKey(key)} nằm ngoài map.`);
          return;
        }
        const visualKey = `${visual.x},${visual.y}`;
        const visualIndex = positionToIndex(visual.x, visual.y, level.grid.columns);
        const visualShared = level.sharedCells?.[visualKey];
        const visualFruit = (level.layers ?? []).some((layer) => layer.cells?.[visualKey]?.item);
        if (visualKey === key) warnings.push(`Tray visual đang overlap Delivery Point Index ${indexOfKey(key)}.`);
        else if (visualShared?.path || visualShared?.item || visualShared?.element || visualFruit) warnings.push(`Tray visual checkpoint Index ${indexOfKey(key)} overlap data tại Index ${visualIndex}.`);
      });
      if (!Number.isInteger(cell.item.trayId) || cell.item.trayId < 0) warnings.push(`Khay tại Index ${indexOfKey(key)} chưa có trayId hợp lệ.`);
      (cell.item.trayLayers ?? []).forEach((trayLayer, layerIndex) => {
        const hasSelectedBlock = FRUIT_TYPES.some((type) => (Number(trayLayer.recipe?.[type]) || 0) > 0);
        if (!hasSelectedBlock) warnings.push(`Tray #${cell.item.trayId ?? indexOfKey(key)} - Layer ${trayLayer.layer ?? layerIndex} chưa chọn Block.`);
        if ((trayLayer.unknownItems ?? []).some((item) => Number(item.count) > 0)) warnings.push(`Khay ${cell.item.trayId} còn item chưa hỗ trợ.`);
      });
    }
  });
  const trayVisualKeys = new Map();
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "tray") return;
    getTrayVisualCells(cell.item, parseCellKey(key)).forEach((visual) => {
      const visualKey = `${visual.x},${visual.y}`;
      if (trayVisualKeys.has(visualKey)) warnings.push(`Khay ${cell.item.trayId} có footprint visual trùng với khay ${trayVisualKeys.get(visualKey)}.`);
      else trayVisualKeys.set(visualKey, cell.item.trayId);
    });
  });
  (level?.layers ?? []).forEach((layer, layerIndex) => Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "fruit") return;
    const index = indexOfKey(key);
    if (!roadKeys.has(key)) warnings.push(`Fruit tại Index ${index} trong layer ${layer.layer ?? layer.name} phải nằm trên Path.`);
    if (countBarrierEndpointIndexes.has(index)) errors.push(`Fruit tại Index ${index} không được đặt tại startIndex/endIndex của Count Barrier.`);
    if (cell.item.unknown) warnings.push(`Layer ${layer.layer ?? layer.name} còn Unknown #${cell.item.itemId ?? cell.item.id}.`);
    if (level.sharedCells?.[key]?.item?.kind === "tray") warnings.push(`Fruit tại Index ${index} trùng checkpoint khay.`);
    if (layerIndex === 0 && isPlayerHeadItem(level.sharedCells?.[key]?.item)) errors.push(`Fruit tại Index ${index} trùng Player Head Layer 1.`);
  }));
  (level?.mysteryFruitElement ?? []).forEach((entry) => {
    const layer = (level.layers ?? []).find((candidate, index) => (Number.isInteger(candidate.layer) ? candidate.layer : index) === entry.layer);
    if (!layer) {
      errors.push(`Mystery Fruit layer ${entry.layer} không tồn tại.`);
      return;
    }
    (entry.index ?? []).forEach((index) => {
      const { x, y } = indexToPosition(index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`Mystery Fruit layer ${entry.layer} Index ${index} nằm ngoài grid.`);
        return;
      }
      if (layer.cells?.[`${x},${y}`]?.item?.kind !== "fruit") errors.push(`Mystery Fruit layer ${entry.layer} Index ${index} phải trỏ tới Fruit thật.`);
    });
  });
  const barrierIds = new Set();
  const barrierIndexes = new Set();
  normalizeCountBarrierElement(level?.countBarrierElement).forEach((barrier) => {
    const label = `Count Barrier ${barrier.barrierId}`;
    if (barrierIds.has(barrier.barrierId)) errors.push(`${label} bị trùng barrierId.`);
    barrierIds.add(barrier.barrierId);
    if (!Number.isInteger(barrier.count) || barrier.count < 1) errors.push(`${label} phải có count là số nguyên dương.`);
    if (barrier.index.length < 2) errors.push(`${label} phải khóa ít nhất 2 ô Path.`);
    if (barrier.startIndex === barrier.endIndex) errors.push(`${label} phải có startIndex và endIndex khác nhau.`);
    const localIndexes = new Set();
    barrier.index.forEach((index) => {
      const { x, y } = indexToPosition(index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`${label} Index ${index} nằm ngoài grid.`);
        return;
      }
      if (!roadIndexes.has(index)) errors.push(`${label} Index ${index} phải thuộc Path.`);
      if (localIndexes.has(index)) errors.push(`${label} không được chứa index trùng.`);
      if (barrierIndexes.has(index)) errors.push(`Count Barrier không được chồng index ${index}.`);
      localIndexes.add(index);
      barrierIndexes.add(index);
    });
    [barrier.startIndex, barrier.endIndex].forEach((index, endpointOrder) => {
      const name = endpointOrder === 0 ? "startIndex" : "endIndex";
      const { x, y } = indexToPosition(index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) errors.push(`${label} ${name} ${index} nằm ngoài grid.`);
      else if (!roadIndexes.has(index)) errors.push(`${label} ${name} ${index} phải thuộc Path.`);
      if (!localIndexes.has(index)) errors.push(`${label} ${name} phải nằm trong index.`);
    });
  });
  const tunnelIds = new Set();
  const tunnelIndexes = new Set();
  (level?.tunnelElement ?? []).forEach((tunnel, tunnelIndex) => {
    if (!Array.isArray(tunnel?.entryPoints) || tunnel.entryPoints.length !== 2) {
      errors.push(`⚠ Tunnel #${Number.isInteger(tunnel?.tunnelId) ? tunnel.tunnelId : tunnelIndex} chưa đủ 2 Point.`);
    }
  });
  normalizeTunnelElement(level?.tunnelElement).forEach((tunnel) => {
    const label = `Tunnel ${tunnel.tunnelId}`;
    if (tunnelIds.has(tunnel.tunnelId)) errors.push(`${label} bị trùng tunnelId.`);
    tunnelIds.add(tunnel.tunnelId);
    if (tunnel.entryPoints.length !== 2) errors.push(`${label} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    tunnel.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = indexToPosition(point.index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`${label} Entry ${name} Index ${point.index} nằm ngoài grid.`);
        return;
      }
      if (!roadIndexes.has(point.index)) errors.push(`${label} Entry ${name} Index ${point.index} phải thuộc Path.`);
      if (!isValidTunnelDirection(point.direction)) errors.push(`${label} Entry ${name} direction không hợp lệ.`);
      else point.direction = normalizeTunnelDirection(point.direction);
      const tunnelDirection = findTunnelPathDirection(level, point.index);
      if (tunnelDirection === null) errors.push(`⚠ Tunnel #${tunnel.tunnelId} Point ${name} không nằm tại Dead End.`);
      else if (tunnelDirection !== point.direction) errors.push(`⚠ Tunnel #${tunnel.tunnelId} Point ${name} direction không hướng về Path.`);
      if (localIndexes.has(point.index)) errors.push(`${label} không được dùng cùng index cho hai entryPoint.`);
      if (tunnelIndexes.has(point.index)) errors.push(`Tunnel không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      tunnelIndexes.add(point.index);
    });
  });
  const oneWayIds = new Set();
  const oneWayIndexes = new Set();
  normalizeOneWayElement(level?.oneWayElement).forEach((oneWay) => {
    const label = `One Way ${oneWay.oneWayId}`;
    if (oneWayIds.has(oneWay.oneWayId)) errors.push(`${label} bị trùng oneWayId.`);
    oneWayIds.add(oneWay.oneWayId);
    if (oneWay.entryPoints.length !== 2) errors.push(`${label} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    oneWay.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = indexToPosition(point.index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`${label} Entry ${name} Index ${point.index} nằm ngoài grid.`);
        return;
      }
      if (!roadIndexes.has(point.index)) errors.push(`${label} Entry ${name} Index ${point.index} phải thuộc Path.`);
      if (!isValidOneWayDirection(point.direction)) errors.push(`${label} Entry ${name} direction không hợp lệ.`);
      else point.direction = normalizeOneWayDirection(point.direction);
      if (localIndexes.has(point.index)) errors.push(`${label} không được dùng cùng index cho hai entryPoint.`);
      if (oneWayIndexes.has(point.index)) errors.push(`One Way không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      oneWayIndexes.add(point.index);
    });
  });
  return { valid: errors.length === 0, exportable: errors.length === 0 && warnings.length === 0, errors, warnings: [...new Set(warnings)], stats };
}


// ---- js/data/directory-handle-storage.js ----
const DIRECTORY_HANDLE_DB = "railwaydash-folder-file";
const DIRECTORY_HANDLE_STORE = "handles";
const LAST_DATA_FOLDER_KEY = "lastDataFolder";

function openDirectoryHandleDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB không khả dụng."));
      return;
    }
    const request = indexedDB.open(DIRECTORY_HANDLE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DIRECTORY_HANDLE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Không thể mở IndexedDB."));
  });
}

function runDirectoryHandleTransaction(mode, action) {
  return openDirectoryHandleDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(DIRECTORY_HANDLE_STORE, mode);
    const store = transaction.objectStore(DIRECTORY_HANDLE_STORE);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB transaction lỗi."));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("IndexedDB transaction lỗi."));
    };
  }));
}

function saveDirectoryHandle(handle) {
  return runDirectoryHandleTransaction("readwrite", (store) => store.put(handle, LAST_DATA_FOLDER_KEY));
}

function getDirectoryHandle() {
  return runDirectoryHandleTransaction("readonly", (store) => store.get(LAST_DATA_FOLDER_KEY));
}

function clearDirectoryHandle() {
  return runDirectoryHandleTransaction("readwrite", (store) => store.delete(LAST_DATA_FOLDER_KEY));
}


// ---- js/data/directory-permission-service.js ----
const DIRECTORY_PERMISSION_MODE = "readwrite";

function normalizePermission(value) {
  return ["granted", "prompt", "denied"].includes(value) ? value : "unknown";
}

function isDirectoryPickerSupported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

async function queryDirectoryPermission(handle, mode = DIRECTORY_PERMISSION_MODE) {
  if (!handle) return "unknown";
  if (!isDirectoryPickerSupported()) return "unsupported";
  if (typeof handle.queryPermission !== "function") return "unknown";
  return normalizePermission(await handle.queryPermission({ mode }));
}

async function requestDirectoryPermission(handle, mode = DIRECTORY_PERMISSION_MODE) {
  if (!handle) return "unknown";
  if (!isDirectoryPickerSupported()) return "unsupported";
  if (typeof handle.requestPermission !== "function") return "unknown";
  return normalizePermission(await handle.requestPermission({ mode }));
}


// ---- js/data/data-folder-scanner.js ----
function isSupportedDataFile(fileName) {
  return String(fileName ?? "").toLowerCase().endsWith(".json");
}

async function readDataFile(fileHandle) {
  const name = fileHandle?.name ?? "";
  try {
    const file = await fileHandle.getFile();
    const rawText = await file.text();
    try {
      const data = JSON.parse(rawText);
      const validRoot = data !== null && typeof data === "object";
      return {
        name,
        handle: fileHandle,
        rawText,
        data: validRoot ? data : null,
        status: validRoot ? "valid" : "invalid",
        errorMessage: validRoot ? null : "Root JSON phải là object hoặc array.",
        lastModified: file.lastModified,
        size: file.size
      };
    } catch (error) {
      return {
        name,
        handle: fileHandle,
        rawText,
        data: null,
        status: "invalid",
        errorMessage: error.message,
        lastModified: file.lastModified,
        size: file.size
      };
    }
  } catch (error) {
    return {
      name,
      handle: fileHandle,
      rawText: null,
      data: null,
      status: "unreadable",
      errorMessage: error.message,
      lastModified: 0,
      size: 0
    };
  }
}

async function scanDataFolder(directoryHandle, scanContext = {}) {
  const files = [];
  for await (const [name, handle] of directoryHandle.entries()) {
    if (typeof scanContext.isCurrent === "function" && !scanContext.isCurrent()) return { cancelled: true, files: [] };
    if (handle.kind !== "file" || !isSupportedDataFile(name)) continue;
    files.push(await readDataFile(handle));
  }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  return { cancelled: false, files };
}


// ---- js/data/file-manager.js ----




class LevelFileManager {
  constructor() { this.directory = null; }
  get supported() { return isDirectoryPickerSupported(); }
  get connected() { return Boolean(this.directory); }
  get directoryName() { return this.directory?.name ?? ""; }

  setDirectory(handle) {
    this.directory = handle ?? null;
  }

  async chooseDirectory() {
    if (!this.supported) throw new Error("Trình duyệt này không hỗ trợ quản lý thư mục trực tiếp.");
    const handle = await window.showDirectoryPicker({ id: "railwaydash-levels", mode: DIRECTORY_PERMISSION_MODE });
    this.directory = handle;
    saveDirectoryHandle(handle).catch((error) => console.warn("Không thể lưu folder đã chọn", error));
    return handle;
  }

  async restoreDirectory() {
    const handle = await getDirectoryHandle();
    this.directory = handle ?? null;
    return this.directory;
  }

  async forgetDirectory() {
    this.directory = null;
    await clearDirectoryHandle();
  }

  queryPermission() {
    return queryDirectoryPermission(this.directory, DIRECTORY_PERMISSION_MODE);
  }

  requestPermission() {
    return requestDirectoryPermission(this.directory, DIRECTORY_PERMISSION_MODE);
  }

  async listFiles(scanContext = {}) {
    if (!this.directory) return [];
    const result = await scanDataFolder(this.directory, scanContext);
    return result.cancelled ? null : result.files;
  }

  async read(name) {
    const handle = await this.directory.getFileHandle(name);
    const entry = await readDataFile(handle);
    if (entry.status !== "valid") throw new Error(entry.errorMessage ?? "File JSON không hợp lệ.");
    return entry.data;
  }

  async write(name, data) {
    const handle = await this.directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(stringifyJson(data));
    await writable.close();
  }

  async rename(oldName, newName) {
    const oldHandle = await this.directory.getFileHandle(oldName);
    const content = await (await oldHandle.getFile()).text();
    const newHandle = await this.directory.getFileHandle(newName, { create: true });
    const writable = await newHandle.createWritable();
    await writable.write(content);
    await writable.close();
    await this.directory.removeEntry(oldName);
  }

  async remove(name) { await this.directory.removeEntry(name); }
}


// ---- js/generate/generate-settings.js ----
const GENERATOR_VERSION = "1.1.0";

const GENERATE_PRESETS = Object.freeze({
  De: {
    clusterRatio: 0.9,
    maxClusterSizePerBranch: 4,
    branchDistributionBalance: 0.9,
    routeChoicePressure: 0.18,
    narrowPathUsage: 0.18,
    loopRiskPressure: 0.15,
    layerDistributionBalance: 0.92,
    spawnSafetyDistance: 6,
    maxImmediateChainCount: 1,
    nextLayerTrapPressure: 0.1,
    avgTailLengthTarget: 5,
    tailLengthCap: 9,
    tailLengthGrowthCurve: "linear",
    tailLengthVariance: 1,
    releaseDelayTarget: 5,
    unreleasedInventoryTarget: 0.22,
    maxUnreleasedItems: 7,
    releaseDistanceWeight: 0.35
  },
  Thuong: {
    clusterRatio: 0.8,
    maxClusterSizePerBranch: 6,
    branchDistributionBalance: 0.75,
    routeChoicePressure: 0.45,
    narrowPathUsage: 0.32,
    loopRiskPressure: 0.3,
    layerDistributionBalance: 0.8,
    spawnSafetyDistance: 4,
    maxImmediateChainCount: 2,
    nextLayerTrapPressure: 0.32,
    avgTailLengthTarget: 8,
    tailLengthCap: 14,
    tailLengthGrowthCurve: "linear",
    tailLengthVariance: 2,
    releaseDelayTarget: 9,
    unreleasedInventoryTarget: 0.42,
    maxUnreleasedItems: 12,
    releaseDistanceWeight: 0.55
  },
  Kho: {
    clusterRatio: 0.68,
    maxClusterSizePerBranch: 6,
    branchDistributionBalance: 0.58,
    routeChoicePressure: 0.68,
    narrowPathUsage: 0.58,
    loopRiskPressure: 0.56,
    layerDistributionBalance: 0.68,
    spawnSafetyDistance: 3,
    maxImmediateChainCount: 3,
    nextLayerTrapPressure: 0.58,
    avgTailLengthTarget: 11,
    tailLengthCap: 18,
    tailLengthGrowthCurve: "ramp",
    tailLengthVariance: 3,
    releaseDelayTarget: 14,
    unreleasedInventoryTarget: 0.58,
    maxUnreleasedItems: 17,
    releaseDistanceWeight: 0.72
  },
  ChuyenGia: {
    clusterRatio: 0.55,
    maxClusterSizePerBranch: 6,
    branchDistributionBalance: 0.45,
    routeChoicePressure: 0.86,
    narrowPathUsage: 0.78,
    loopRiskPressure: 0.78,
    layerDistributionBalance: 0.56,
    spawnSafetyDistance: 2,
    maxImmediateChainCount: 4,
    nextLayerTrapPressure: 0.8,
    avgTailLengthTarget: 14,
    tailLengthCap: 22,
    tailLengthGrowthCurve: "peak-late",
    tailLengthVariance: 4,
    releaseDelayTarget: 18,
    unreleasedInventoryTarget: 0.72,
    maxUnreleasedItems: 22,
    releaseDistanceWeight: 0.9
  }
});

const PRESET_LABELS = Object.freeze({
  De: "Dễ",
  Thuong: "Thường",
  Kho: "Khó",
  ChuyenGia: "Chuyên gia"
});

const MULTI_BRANCH_MODE_LABELS = Object.freeze({
  balanced: "Cân bằng",
  spread: "Rải đều",
  clustered: "Gom nhánh"
});

const TAIL_CURVE_LABELS = Object.freeze({
  linear: "Tuyến tính",
  flat: "Phẳng",
  ramp: "Tăng dần",
  "peak-late": "Khó cuối màn"
});

const GENERATE_SETTING_FIELDS = Object.freeze([
  { key: "avgTailLengthTarget", label: "Đuôi TB mục tiêu", type: "number", min: 1, max: 40, step: 1, group: "Áp lực đuôi", tip: "Độ dài đuôi tàu trung bình mà bộ sinh cố gắng hướng tới." },
  { key: "tailLengthCap", label: "Giới hạn đuôi", type: "number", min: 1, max: 60, step: 1, group: "Áp lực đuôi", tip: "Nếu ước tính đuôi vượt ngưỡng này, bộ sinh sẽ báo lỗi." },
  { key: "tailLengthVariance", label: "Dao động đuôi", type: "number", min: 0, max: 12, step: 1, group: "Áp lực đuôi", tip: "Mức dao động độ dài đuôi giữa các đoạn khó/dễ." },
  { key: "releaseDelayTarget", label: "Độ trễ xả", type: "number", min: 1, max: 80, step: 1, group: "Áp lực xả", tip: "Khoảng cách đường đi mục tiêu từ lúc ăn vật phẩm tới khay phù hợp." },
  { key: "unreleasedInventoryTarget", label: "Tồn kho mục tiêu", type: "percent", min: 0, max: 1, step: 0.01, group: "Áp lực xả", tip: "Tỷ lệ vật phẩm dự kiến chưa xả được tại các đoạn áp lực." },
  { key: "maxUnreleasedItems", label: "Tồn kho tối đa", type: "number", min: 1, max: 80, step: 1, group: "Áp lực xả", tip: "Số vật phẩm chưa xả tối đa cho phép theo mô phỏng nhanh." },
  { key: "releaseDistanceWeight", label: "Trọng số xả", type: "percent", min: 0, max: 1, step: 0.01, group: "Áp lực xả", tip: "Mức ưu tiên khoảng cách vật phẩm tới khay phù hợp khi chọn vị trí." },
  { key: "layerDistributionBalance", label: "Cân bằng lớp", type: "percent", min: 0, max: 1, step: 0.01, group: "Lớp và xuất hiện", tip: "Ưu tiên mềm để giữ phân bổ giữa các lớp theo đúng khay nguồn." },
  { key: "spawnSafetyDistance", label: "Khoảng cách xuất hiện an toàn", type: "number", min: 0, max: 30, step: 1, group: "Lớp và xuất hiện", tip: "Khoảng cách tối thiểu từ điểm bắt đầu tới vật phẩm lớp mới để tránh bẫy xuất hiện." },
  { key: "maxImmediateChainCount", label: "Chuỗi gần đầu tối đa", type: "number", min: 0, max: 12, step: 1, group: "Lớp và xuất hiện", tip: "Số vật phẩm lớp mới liên tiếp được phép xuất hiện quá gần đầu tàu." },
  { key: "nextLayerTrapPressure", label: "Áp lực bẫy lớp", type: "percent", min: 0, max: 1, step: 0.01, group: "Lớp và xuất hiện", tip: "Mức cho phép tạo áp lực khi chuyển sang lớp tiếp theo." },
  { key: "clusterRatio", label: "Tỷ lệ gom màu", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Tỷ lệ ưu tiên gom vật phẩm cùng màu; thấp hơn sẽ xen kẽ màu nhiều hơn." },
  { key: "maxClusterSizePerBranch", label: "Cụm tối đa/nhánh", type: "number", min: 1, max: 6, step: 1, group: "Cụm và đường đi", tip: "Giới hạn cứng số vật phẩm cùng màu trong một cụm trên mỗi nhánh." },
  { key: "branchDistributionBalance", label: "Cân bằng nhánh", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Ưu tiên mềm để không dồn toàn bộ vật phẩm vào một nhánh." },
  { key: "routeChoicePressure", label: "Áp lực chọn đường", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức độ buộc người chơi cân nhắc đường đi khi thu item." },
  { key: "narrowPathUsage", label: "Dùng ray hẹp", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức ưu tiên các đoạn ray ít lối thoát để tăng rủi ro." },
  { key: "loopRiskPressure", label: "Rủi ro vòng/ngõ cụt", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức sử dụng vòng ngắn hoặc ngõ cụt có nguy cơ tự va chạm." }
]);

function createDefaultGenerateSettings() {
  return {
    seed: 12345,
    maxRetries: 50,
    difficultyPreset: "Thuong",
    multiBranchMode: "balanced",
    tailLengthGrowthCurve: "linear",
    ...GENERATE_PRESETS.Thuong
  };
}

function normalizeGenerateSettings(value = {}) {
  const defaults = createDefaultGenerateSettings();
  const settings = { ...defaults, ...(value ?? {}) };
  if (settings.difficultyPreset === "Easy") settings.difficultyPreset = "De";
  if (settings.difficultyPreset === "Normal") settings.difficultyPreset = "Thuong";
  if (settings.difficultyPreset === "Hard") settings.difficultyPreset = "Kho";
  if (settings.difficultyPreset === "Expert") settings.difficultyPreset = "ChuyenGia";
  settings.difficultyPreset = GENERATE_PRESETS[settings.difficultyPreset] ? settings.difficultyPreset : "Thuong";
  settings.seed = Math.max(0, Math.floor(Number(settings.seed) || defaults.seed));
  settings.maxRetries = Math.max(1, Math.min(500, Math.floor(Number(settings.maxRetries) || defaults.maxRetries)));
  settings.multiBranchMode = MULTI_BRANCH_MODE_LABELS[settings.multiBranchMode] ? settings.multiBranchMode : "balanced";
  settings.tailLengthGrowthCurve = TAIL_CURVE_LABELS[settings.tailLengthGrowthCurve] ? settings.tailLengthGrowthCurve : "linear";
  GENERATE_SETTING_FIELDS.forEach((field) => {
    const numeric = Number(settings[field.key]);
    settings[field.key] = Number.isFinite(numeric) ? numeric : defaults[field.key];
  });
  return settings;
}

function applyGeneratePreset(settings, presetName) {
  const preset = GENERATE_PRESETS[presetName] ? presetName : "Thuong";
  return normalizeGenerateSettings({ ...settings, difficultyPreset: preset, ...GENERATE_PRESETS[preset] });
}

function validateGenerateSettings(settings) {
  const normalized = normalizeGenerateSettings(settings);
  const errors = [];
  GENERATE_SETTING_FIELDS.forEach((field) => {
    const value = Number(normalized[field.key]);
    if (value < field.min || value > field.max) {
      errors.push({
        code: "DIFFICULTY_OUT_OF_RANGE",
        severity: "error",
        message: `${field.label} phải nằm trong khoảng ${field.min} - ${field.max}.`,
        settingKey: field.key,
        suggestion: "Chọn lại preset hoặc chỉnh giá trị về đúng giới hạn."
      });
    }
  });
  if (normalized.maxRetries < 1) {
    errors.push({
      code: "DIFFICULTY_OUT_OF_RANGE",
      severity: "error",
      message: "Số lần thử lại phải lớn hơn 0.",
      settingKey: "maxRetries",
      suggestion: "Dùng giá trị từ 1 đến 500."
    });
  }
  return { settings: normalized, errors };
}


// ---- js/generate/generate-source.js ----







const FRUIT_TYPE_BY_ITEM_ID = Object.freeze(Object.fromEntries(
  Object.entries(FRUIT_ITEM_IDS).map(([type, itemId]) => [String(itemId), type])
));

function fruitTypeFromItemId(itemId) {
  return FRUIT_TYPE_BY_ITEM_ID[String(itemId)] ?? null;
}

function createGeneratorIssue({ code, message, severity = "error", levelId = null, layerIndex = null, trayId = null, index = null, suggestion = "" }) {
  return { code, message, severity, levelId, layerIndex, trayId, index, suggestion };
}

function collectPathIndexes(state) {
  return Object.entries(state.sharedCells ?? {})
    .filter(([, cell]) => cell?.path)
    .map(([key]) => {
      const { x, y } = parseCellKey(key);
      return positionToIndex(x, y, state.grid.columns);
    })
    .sort((a, b) => a - b);
}

function collectTrayRequirements(state) {
  const requirements = [];
  Object.entries(state.sharedCells ?? {}).forEach(([key, cell]) => {
    const item = cell?.item;
    if (!["tray", "truck"].includes(item?.kind)) return;
    const { x, y } = parseCellKey(key);
    const deliverIndex = positionToIndex(x, y, state.grid.columns);
    const trayId = Number.isInteger(item.trayId) ? item.trayId : positionToIndex(x, y, state.grid.columns);
    if (item.kind === "truck") {
      const itemId = Number(FRUIT_ITEM_IDS[item.fruitType] ?? item.itemId ?? item.id);
      requirements.push({ trayId, deliverIndex, layerIndex: 0, itemId, fruitType: item.fruitType, amount: Number(item.capacity) || 0 });
      return;
    }
    (item.trayLayers ?? []).forEach((trayLayer, order) => {
      const layerIndex = Number.isInteger(trayLayer.layer) ? trayLayer.layer : order;
      FRUIT_TYPES.forEach((fruitType) => {
        const amount = Number(trayLayer.recipe?.[fruitType]) || 0;
        if (amount > 0) requirements.push({ trayId, deliverIndex, layerIndex, itemId: FRUIT_ITEM_IDS[fruitType], fruitType, amount });
      });
      (trayLayer.unknownItems ?? []).forEach((unknown) => {
        const itemId = Number(unknown.itemId);
        const amount = Number(unknown.count) || 0;
        if (Number.isInteger(itemId) && amount > 0) requirements.push({ trayId, deliverIndex, layerIndex, itemId, fruitType: fruitTypeFromItemId(itemId), amount });
      });
    });
  });
  return requirements.sort((a, b) => a.layerIndex - b.layerIndex || a.trayId - b.trayId || a.itemId - b.itemId);
}

function sharedBlockedIndexes(state) {
  const blocked = new Set();
  Object.entries(state.sharedCells ?? {}).forEach(([key, cell]) => {
    const { x, y } = parseCellKey(key);
    const index = positionToIndex(x, y, state.grid.columns);
    if (cell.item?.kind === "snake" || cell.item?.kind === "tray" || cell.element) blocked.add(index);
    if (cell.item?.kind === "tray") {
      getTrayVisualCells(cell.item, { x, y }).forEach((visual) => {
        if (isInsideGrid(state.grid, visual.x, visual.y)) blocked.add(positionToIndex(visual.x, visual.y, state.grid.columns));
      });
    }
    if (cell.element?.kind === "bridge") {
      bridgeVisualCells(state, index).forEach((visual) => {
        if (isInsideGrid(state.grid, visual.x, visual.y)) blocked.add(positionToIndex(visual.x, visual.y, state.grid.columns));
      });
      bridgeItemBlockCells(state, index).forEach((visual) => {
        if (isInsideGrid(state.grid, visual.x, visual.y)) blocked.add(positionToIndex(visual.x, visual.y, state.grid.columns));
      });
    }
  });
  Object.keys(state.priorityPoints ?? {}).forEach((key) => {
    const { x, y } = parseCellKey(key);
    blocked.add(positionToIndex(x, y, state.grid.columns));
  });
  normalizeCountBarrierElement(state.countBarrierElement).forEach((barrier) => {
    blocked.add(barrier.startIndex);
    blocked.add(barrier.endIndex);
  });
  normalizeTunnelElement(state.tunnelElement).forEach((tunnel) => {
    tunnel.entryPoints.forEach((point) => blocked.add(point.index));
  });
  normalizeOneWayElement(state.oneWayElement).forEach((oneWay) => {
    oneWay.entryPoints.forEach((point) => blocked.add(point.index));
  });
  return blocked;
}

function indexesAfterStart(state, pathIndexes, amount = 2) {
  const spawnIndex = Object.entries(state.sharedCells ?? {}).flatMap(([key, cell]) => {
    if (cell.item?.kind !== "snake") return [];
    const { x, y } = parseCellKey(key);
    return [positionToIndex(x, y, state.grid.columns)];
  })[0];
  if (!Number.isInteger(spawnIndex)) return new Set();
  const startOffset = pathIndexes.indexOf(spawnIndex);
  if (startOffset < 0) return new Set();
  return new Set(pathIndexes.slice(startOffset + 1, startOffset + 1 + amount));
}

function collectValidCellsByLayer(state, extraLayerIndexes = []) {
  const pathIndexes = collectPathIndexes(state);
  const blocked = sharedBlockedIndexes(state);
  const layerOneStartBuffer = indexesAfterStart(state, pathIndexes, 2);
  const validByLayer = new Map();
  const layerIndexes = new Set([
    ...(state.layers ?? []).map((layer, order) => Number.isInteger(layer.layer) ? layer.layer : order),
    ...extraLayerIndexes
  ]);
  layerIndexes.forEach((layerIndex) => {
    const valid = pathIndexes.filter((index) => {
      if (blocked.has(index)) return false;
      if (layerIndex === 0 && layerOneStartBuffer.has(index)) return false;
      return true;
    });
    validByLayer.set(layerIndex, valid);
  });
  return validByLayer;
}

function branchCellsForIndexes(state, indexes) {
  const remaining = new Set(indexes);
  const branches = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    const queue = [first];
    const cells = [];
    remaining.delete(first);
    while (queue.length > 0) {
      const current = queue.shift();
      cells.push(current);
      const connections = pathConnectionsAt(state, current);
      connections.forEach((direction) => {
        const { x, y } = indexToPosition(current, state.grid.columns);
        const next = [
          { x, y: y - 1 },
          { x: x + 1, y },
          { x, y: y + 1 },
          { x: x - 1, y }
        ][direction];
        if (!next || !isInsideGrid(state.grid, next.x, next.y)) return;
        const nextIndex = positionToIndex(next.x, next.y, state.grid.columns);
        if (!remaining.has(nextIndex)) return;
        remaining.delete(nextIndex);
        queue.push(nextIndex);
      });
    }
    branches.push({ branchId: `branch_${branches.length + 1}`, indexes: cells.sort((a, b) => a - b) });
  }
  return branches.sort((a, b) => b.indexes.length - a.indexes.length);
}

function analyzeGenerateSource(state) {
  const issues = [];
  const pathIndexes = collectPathIndexes(state);
  const requirements = collectTrayRequirements(state);
  const validByLayer = collectValidCellsByLayer(state, requirements.map((entry) => entry.layerIndex));
  const requiredByLayer = new Map();
  requirements.forEach((entry) => {
    if (!Number.isInteger(entry.itemId) || entry.itemId <= 0 || entry.amount <= 0) {
      issues.push(createGeneratorIssue({
        code: "TRAY_INVALID",
        message: `Khay ${entry.trayId} có mã vật phẩm hoặc số lượng không hợp lệ.`,
        trayId: entry.trayId,
        layerIndex: entry.layerIndex,
        suggestion: "Kiểm tra công thức khay trong tab LevelDes."
      }));
      return;
    }
    requiredByLayer.set(entry.layerIndex, (requiredByLayer.get(entry.layerIndex) ?? 0) + entry.amount);
  });
  if (pathIndexes.length === 0) {
    issues.push(createGeneratorIssue({
      code: "SOURCE_INVALID",
      message: "Level chưa có ô đường ray.",
      suggestion: "Vẽ đường ray trong tab LevelDes trước khi sinh màn."
    }));
  }
  if (requirements.length === 0) {
    issues.push(createGeneratorIssue({
      code: "TRAY_INVALID",
      message: "Không tìm thấy yêu cầu vật phẩm từ khay.",
      suggestion: "Thêm lớp khay và số lượng vật phẩm trong tab LevelDes."
    }));
  }
  requiredByLayer.forEach((required, layerIndex) => {
    const validSlots = validByLayer.get(layerIndex)?.length ?? 0;
    if (required > validSlots) {
      issues.push(createGeneratorIssue({
        code: "NOT_ENOUGH_VALID_CELLS",
        message: `Lớp ${layerIndex + 1} cần ${required} vật phẩm nhưng chỉ có ${validSlots} ô hợp lệ.`,
        layerIndex,
        suggestion: "Thêm ô đường ray hợp lệ hoặc giảm yêu cầu trong khay."
      }));
    }
  });
  const trayCount = new Set(requirements.map((entry) => entry.trayId)).size;
  const priorityCount = Object.keys(state.priorityPoints ?? {}).length;
  const totalValidSlots = [...validByLayer.values()].reduce((sum, cells) => sum + cells.length, 0);
  const totalRequired = requirements.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    pathIndexes,
    requirements,
    validByLayer,
    stats: {
      layers: state.layers?.length ?? 0,
      trays: trayCount,
      priorityPoints: priorityCount,
      totalRequired,
      totalValidSlots,
      itemDensity: totalValidSlots > 0 ? totalRequired / totalValidSlots : 0
    }
  };
}


// ---- js/generate/generator-engine.js ----







function createRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

function shuffle(values, random) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pathOrderMap(source) {
  return new Map((source.pathIndexes ?? []).map((index, order) => [index, order]));
}

function pathDistance(source, fromIndex, toIndex) {
  const order = pathOrderMap(source);
  const from = order.get(fromIndex);
  const to = order.get(toIndex);
  if (Number.isInteger(from) && Number.isInteger(to)) return Math.abs(from - to);
  return Math.abs(Number(fromIndex) - Number(toIndex));
}

function ensureLayers(state, maxLayerIndex) {
  while ((state.layers ?? []).length <= maxLayerIndex) {
    state.layers.push(createLayer(state.layers.length));
  }
  reindexLayers(state.layers);
}

function clearGeneratedLayerItems(state) {
  (state.layers ?? []).forEach((layer) => {
    layer.cells = {};
  });
  state.mysteryFruitElement = [];
}

function createItemFromRequirement(requirement) {
  const fruitType = requirement.fruitType ?? fruitTypeFromItemId(requirement.itemId);
  if (fruitType) return createFruit(fruitType, blockVisualMeta(fruitType).label, BLOCK_ITEM_GLYPH);
  return {
    id: requirement.itemId,
    itemId: requirement.itemId,
    kind: "fruit",
    category: "item",
    fruitType: `unknown-${requirement.itemId}`,
    label: `Unknown #${requirement.itemId}`,
    icon: "?"
  };
}

function scoreCellForRequirement(state, source, settings, requirement, index, random) {
  const order = pathOrderMap(source).get(index) ?? index;
  const releaseDelay = pathDistance(source, index, requirement.deliverIndex);
  const releaseScore = Math.abs(releaseDelay - settings.releaseDelayTarget) * settings.releaseDistanceWeight;
  const connections = pathConnectionsAt(state, index).length;
  const narrowBonus = connections <= 1
    ? settings.loopRiskPressure + settings.narrowPathUsage
    : connections === 2
      ? settings.narrowPathUsage * 0.35
      : settings.routeChoicePressure * -0.35;
  const spawnPenalty = requirement.layerIndex > 0 && order < settings.spawnSafetyDistance
    ? (1 - settings.nextLayerTrapPressure) * 100
    : 0;
  return releaseScore - narrowBonus + spawnPenalty + random() * 0.25;
}

function takeCellsFromBranches(state, source, branches, requirement, settings, random, usedIndexes) {
  const branchQueues = branches
    .filter((branch) => branch.indexes.some((index) => !usedIndexes.has(index)));
  branchQueues.forEach((branch) => {
    const rankedIndexes = shuffle(branch.indexes.filter((index) => !usedIndexes.has(index)), random)
      .map((index) => ({ index, score: scoreCellForRequirement(state, source, settings, requirement, index, random) }))
      .sort((a, b) => a.score - b.score);
    branch.score = rankedIndexes[0]?.score ?? Number.POSITIVE_INFINITY;
    branch.indexes = rankedIndexes.map((entry) => entry.index);
  });
  const activeQueues = branchQueues
    .filter((branch) => branch.indexes.length > 0)
    .sort((a, b) => a.score - b.score);
  const picked = [];
  let cursor = 0;
  let guard = 0;
  while (picked.length < requirement.amount && activeQueues.length > 0 && guard < requirement.amount * Math.max(1, activeQueues.length) * 3) {
    const branch = activeQueues[cursor % activeQueues.length];
    const chunkSize = Math.max(1, Math.min(settings.maxClusterSizePerBranch, requirement.amount - picked.length));
    const actualChunk = Math.max(1, Math.round(chunkSize * Math.max(0.15, settings.clusterRatio)));
    for (let i = 0; i < actualChunk && picked.length < requirement.amount && branch.indexes.length > 0; i += 1) {
      const index = branch.indexes.shift();
      if (usedIndexes.has(index)) continue;
      usedIndexes.add(index);
      picked.push({ index, branchId: branch.branchId });
    }
    cursor += settings.multiBranchMode === "clustered" ? (random() > settings.branchDistributionBalance ? 1 : 0) : 1;
    guard += 1;
    for (let i = activeQueues.length - 1; i >= 0; i -= 1) {
      if (activeQueues[i].indexes.length === 0) activeQueues.splice(i, 1);
    }
  }
  return picked;
}

function requirementChunks(requirements, settings, random) {
  const remaining = requirements.map((requirement) => ({ ...requirement, remaining: requirement.amount }));
  const chunks = [];
  let cursor = 0;
  while (remaining.some((entry) => entry.remaining > 0)) {
    const available = remaining.filter((entry) => entry.remaining > 0);
    let index = remaining.indexOf(available[cursor % available.length]);
    if (chunks.length > 0 && random() > settings.clusterRatio) {
      const previous = chunks[chunks.length - 1];
      const different = available.find((entry) => entry.itemId !== previous.itemId);
      if (different) index = remaining.indexOf(different);
    }
    const entry = remaining[index];
    const clusterSize = Math.max(1, Math.min(settings.maxClusterSizePerBranch, Math.round(settings.maxClusterSizePerBranch * Math.max(0.2, settings.clusterRatio))));
    const amount = Math.min(entry.remaining, clusterSize);
    chunks.push({ ...entry, amount });
    entry.remaining -= amount;
    cursor += 1;
  }
  return chunks;
}

function quotaKey(layerIndex, itemId) {
  return `${layerIndex}:${itemId}`;
}

function quotaCountsFromRequirements(requirements) {
  const totalByLayer = new Map();
  const totalByLayerItem = new Map();
  let total = 0;
  requirements.forEach((entry) => {
    total += entry.amount;
    totalByLayer.set(entry.layerIndex, (totalByLayer.get(entry.layerIndex) ?? 0) + entry.amount);
    totalByLayerItem.set(quotaKey(entry.layerIndex, entry.itemId), (totalByLayerItem.get(quotaKey(entry.layerIndex, entry.itemId)) ?? 0) + entry.amount);
  });
  return { total, totalByLayer, totalByLayerItem };
}

function quotaCountsFromGenerated(generatedItems) {
  const totalByLayer = new Map();
  const totalByLayerItem = new Map();
  const seenCells = new Set();
  const duplicateCells = [];
  generatedItems.forEach((entry) => {
    totalByLayer.set(entry.layerIndex, (totalByLayer.get(entry.layerIndex) ?? 0) + 1);
    totalByLayerItem.set(quotaKey(entry.layerIndex, entry.itemId), (totalByLayerItem.get(quotaKey(entry.layerIndex, entry.itemId)) ?? 0) + 1);
    const cellKey = quotaKey(entry.layerIndex, entry.pathIndex);
    if (seenCells.has(cellKey)) duplicateCells.push(entry.pathIndex);
    seenCells.add(cellKey);
  });
  return { total: generatedItems.length, totalByLayer, totalByLayerItem, duplicateCells };
}

function validateGeneratedQuotas(generatedItems, source) {
  const required = quotaCountsFromRequirements(source.requirements);
  const generated = quotaCountsFromGenerated(generatedItems);
  const issues = [];
  if (generated.total !== required.total) {
    issues.push(createGeneratorIssue({
      code: "ITEM_QUOTA_MISMATCH",
      message: `Tổng vật phẩm sinh ra ${generated.total}/${required.total} không khớp yêu cầu khay.`,
      suggestion: "Không áp dụng màn; kiểm tra ô hợp lệ hoặc giảm áp lực sinh."
    }));
  }
  required.totalByLayer.forEach((amount, layerIndex) => {
    const actual = generated.totalByLayer.get(layerIndex) ?? 0;
    if (actual !== amount) {
      issues.push(createGeneratorIssue({
        code: "LAYER_QUOTA_MISMATCH",
        message: `Lớp ${layerIndex + 1} sinh ${actual}/${amount} vật phẩm.`,
        layerIndex,
        suggestion: "Giữ vật phẩm đúng lớp nguồn, không chuyển vật phẩm giữa các lớp."
      }));
    }
  });
  required.totalByLayerItem.forEach((amount, key) => {
    const actual = generated.totalByLayerItem.get(key) ?? 0;
    if (actual !== amount) {
      const [layerIndex, itemId] = key.split(":").map(Number);
      issues.push(createGeneratorIssue({
        code: "ITEM_ID_QUOTA_MISMATCH",
        message: `Lớp ${layerIndex + 1} mã vật phẩm ${itemId} sinh ${actual}/${amount}.`,
        layerIndex,
        suggestion: "Bộ sinh phải giữ đúng mã vật phẩm và số lượng từ khay nguồn."
      }));
    }
  });
  if (generated.duplicateCells.length > 0) {
    issues.push(createGeneratorIssue({
      code: "ITEM_QUOTA_MISMATCH",
      message: `Có ${generated.duplicateCells.length} vật phẩm trùng ô hoặc thứ tự đường ray.`,
      suggestion: "Sinh lại với seed khác hoặc giảm áp lực cụm."
    }));
  }
  return issues;
}

function generatedMetrics(generatedItems, settings, source) {
  const byBranch = new Set(generatedItems.map((item) => item.branchId).filter(Boolean));
  const byLayer = new Map();
  generatedItems.forEach((item) => byLayer.set(item.layerIndex, (byLayer.get(item.layerIndex) ?? 0) + 1));
  let sameAdjacent = 0;
  let comparable = 0;
  [...byLayer.keys()].forEach((layerIndex) => {
    const items = generatedItems
      .filter((item) => item.layerIndex === layerIndex)
      .sort((a, b) => a.pathIndex - b.pathIndex);
    for (let i = 1; i < items.length; i += 1) {
      comparable += 1;
      if (items[i].itemId === items[i - 1].itemId) sameAdjacent += 1;
    }
  });
  const actualClusterRatio = comparable ? sameAdjacent / comparable : 1;
  const avgReleaseDelay = generatedItems.length
    ? generatedItems.reduce((sum, item) => sum + (Number(item.releaseDelay) || 0), 0) / generatedItems.length
    : 0;
  const maxReleaseDelay = generatedItems.reduce((max, item) => Math.max(max, Number(item.releaseDelay) || 0), 0);
  const itemDensity = source.stats.itemDensity ?? 0;
  const unreleasedInventoryRatio = generatedItems.length
    ? generatedItems.filter((item) => item.releaseDelay >= settings.releaseDelayTarget).length / generatedItems.length
    : 0;
  const avgTailLength = Math.max(1, settings.avgTailLengthTarget
    + (avgReleaseDelay / Math.max(1, settings.releaseDelayTarget) - 1) * settings.releaseDistanceWeight * 2
    + itemDensity * settings.tailLengthVariance
    + (1 - actualClusterRatio) * settings.tailLengthVariance);
  const peakTailLength = Math.ceil(avgTailLength + settings.tailLengthVariance + Math.min(settings.maxClusterSizePerBranch, generatedItems.length) * itemDensity);
  const maxUnreleasedItems = Math.ceil(generatedItems.length * Math.max(unreleasedInventoryRatio, settings.unreleasedInventoryTarget * 0.5));
  const spawnTrapCount = generatedItems.filter((item) => item.spawnRisk).length;
  const decisionPointFrequency = source.pathIndexes?.length ? (source.stats.priorityPoints ?? 0) / source.pathIndexes.length : 0;
  const loopRiskScore = generatedItems.length
    ? generatedItems.filter((item) => item.connectionCount <= 1).length / generatedItems.length
    : 0;
  return {
    status: "Generated",
    generatedAt: Date.now(),
    generatorVersion: GENERATOR_VERSION,
    totalRequired: source.stats.totalRequired,
    totalGenerated: generatedItems.length,
    missing: Math.max(0, source.stats.totalRequired - generatedItems.length),
    branchCount: byBranch.size,
    clusterCount: Math.max(1, Math.ceil(generatedItems.length / Math.max(1, settings.maxClusterSizePerBranch))),
    actualClusterRatio: Number(actualClusterRatio.toFixed(3)),
    itemDensity: Number(itemDensity.toFixed(3)),
    avgTailLength: Number(avgTailLength.toFixed(2)),
    peakTailLength,
    avgReleaseDelay: Number(avgReleaseDelay.toFixed(2)),
    maxReleaseDelay,
    unreleasedInventoryRatio: Number(unreleasedInventoryRatio.toFixed(3)),
    maxUnreleasedItems,
    spawnTrapCount,
    decisionPointFrequency: Number(decisionPointFrequency.toFixed(3)),
    loopRiskScore: Number(loopRiskScore.toFixed(3)),
    quotaValidated: true
  };
}

function validateDifficultyMetrics(meta, settings) {
  const issues = [];
  if (meta.peakTailLength > settings.tailLengthCap) {
    issues.push(createGeneratorIssue({
      code: "TAIL_PRESSURE_EXCEEDED",
      message: `Đuôi đỉnh ước tính ${meta.peakTailLength} vượt giới hạn ${settings.tailLengthCap}.`,
      suggestion: "Tăng giới hạn đuôi, tăng gom cụm màu hoặc giảm độ trễ xả."
    }));
  }
  if (meta.maxUnreleasedItems > settings.maxUnreleasedItems) {
    issues.push(createGeneratorIssue({
      code: "RELEASE_PRESSURE_EXCEEDED",
      message: `Tồn kho chưa xả ${meta.maxUnreleasedItems} vượt ngưỡng ${settings.maxUnreleasedItems}.`,
      suggestion: "Giảm độ trễ xả, tăng gom màu hoặc chọn preset dễ hơn."
    }));
  }
  if (meta.spawnTrapCount > settings.maxImmediateChainCount) {
    issues.push(createGeneratorIssue({
      code: "NEXT_LAYER_SPAWN_TRAP",
      message: `Có ${meta.spawnTrapCount} vật phẩm lớp mới nằm trong vùng xuất hiện rủi ro.`,
      suggestion: "Tăng khoảng cách xuất hiện an toàn hoặc giảm áp lực bẫy lớp."
    }));
  }
  return issues;
}

function generatePreview(state, rawSettings = {}) {
  const settingsResult = validateGenerateSettings(rawSettings);
  const settings = normalizeGenerateSettings(settingsResult.settings);
  const source = analyzeGenerateSource(state);
  const errors = [...settingsResult.errors, ...source.issues.filter((issue) => issue.severity === "error")];
  if (errors.length > 0) {
    return { ok: false, preview: null, source, settings, issues: errors };
  }

  const random = createRandom(settings.seed);
  const next = structuredClone(state);
  const maxLayerIndex = Math.max(0, ...source.requirements.map((entry) => entry.layerIndex));
  ensureLayers(next, maxLayerIndex);
  clearGeneratedLayerItems(next);

  const generatedItems = [];
  const sourceByLayer = new Map();
  source.requirements.forEach((requirement) => {
    const list = sourceByLayer.get(requirement.layerIndex) ?? [];
    list.push(requirement);
    sourceByLayer.set(requirement.layerIndex, list);
  });

  for (const [layerIndex, requirements] of sourceByLayer.entries()) {
    const validCells = source.validByLayer.get(layerIndex) ?? [];
    const branches = branchCellsForIndexes(state, validCells);
    if (branches.length === 0 && requirements.some((entry) => entry.amount > 0)) {
      return {
        ok: false,
        preview: null,
        source,
        settings,
        issues: [createGeneratorIssue({
          code: "BRANCH_DISTRIBUTION_FAILED",
          message: `Lớp ${layerIndex + 1} không có nhánh hợp lệ để sinh vật phẩm.`,
          layerIndex,
          suggestion: "Thêm path có thể đi được hoặc bỏ vùng chặn trên layer này."
        })]
      };
    }
    const branchCopies = branches.map((branch) => ({ ...branch, indexes: branch.indexes.slice() }));
    const usedLayerIndexes = new Set();
    requirementChunks(requirements, settings, random).forEach((requirement) => {
      const cells = takeCellsFromBranches(state, source, branchCopies, requirement, settings, random, usedLayerIndexes);
      if (cells.length < requirement.amount) return;
      const layer = next.layers.find((candidate, order) => (Number.isInteger(candidate.layer) ? candidate.layer : order) === layerIndex);
      cells.forEach((cell, order) => {
        const { x, y } = indexToPosition(cell.index, next.grid.columns);
        const releaseDelay = pathDistance(source, cell.index, requirement.deliverIndex);
        const pathOrder = pathOrderMap(source).get(cell.index) ?? cell.index;
        layer.cells[cellKey(x, y)] = { item: createItemFromRequirement(requirement) };
        generatedItems.push({
          id: `gen_${layerIndex}_${requirement.trayId}_${requirement.itemId}_${cell.index}_${order}`,
          itemId: requirement.itemId,
          layerIndex,
          gridX: x,
          gridY: y,
          pathIndex: cell.index,
          branchId: cell.branchId,
          sourceTrayId: `tray_${requirement.trayId}`,
          releaseDelay,
          spawnRisk: requirement.layerIndex > 0 && pathOrder < settings.spawnSafetyDistance,
          connectionCount: pathConnectionsAt(state, cell.index).length
        });
      });
    });
  }

  const quotaIssues = validateGeneratedQuotas(generatedItems, source);
  if (quotaIssues.length > 0) {
    return {
      ok: false,
      preview: null,
      source,
      settings,
      issues: quotaIssues
    };
  }

  const meta = generatedMetrics(generatedItems, settings, source);
  const metricIssues = validateDifficultyMetrics(meta, settings);
  if (metricIssues.length > 0) {
    return { ok: false, preview: null, source, settings, issues: metricIssues, generatedItems, meta };
  }
  next.generateSettings = settings;
  next.generatedItems = generatedItems;
  next.generationMeta = meta;
  return { ok: true, preview: next, source, settings, issues: [], generatedItems, meta };
}

function applyGeneratedPreview(targetState, previewState) {
  if (!previewState?.layers || !previewState?.generationMeta) return false;
  targetState.layers = structuredClone(previewState.layers);
  targetState.activeLayerId = previewState.activeLayerId;
  targetState.mysteryFruitElement = structuredClone(previewState.mysteryFruitElement ?? []);
  targetState.generateSettings = structuredClone(previewState.generateSettings);
  targetState.generatedItems = structuredClone(previewState.generatedItems ?? []);
  targetState.generationMeta = structuredClone(previewState.generationMeta);
  return true;
}

function resetGeneratedItems(targetState, backupState) {
  if (!backupState?.layers) return false;
  targetState.layers = structuredClone(backupState.layers);
  targetState.activeLayerId = backupState.activeLayerId;
  targetState.mysteryFruitElement = structuredClone(backupState.mysteryFruitElement ?? []);
  targetState.generatedItems = [];
  targetState.generationMeta = { status: "Not Generated", generatedAt: 0, generatorVersion: GENERATOR_VERSION };
  return true;
}


// ---- js/editor/delete-resolver.js ----







function activeLayerContext(state, position) {
  const layer = state.layers?.find((candidate) => candidate.id === state.activeLayerId);
  if (!layer || !position) return null;
  const key = cellKey(position.x, position.y);
  const rawShared = state.sharedCells?.[key] ?? { path: false, item: null, element: null };
  return {
    layer,
    key,
    layerNumber: Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer),
    shared: { ...rawShared, item: visibleSharedItemForLayer(rawShared.item, state, layer.id) },
    layerCell: layer.cells?.[key] ?? { item: null },
    index: positionToIndex(position.x, position.y, state.grid.columns)
  };
}

function targetLabel(target) {
  return {
    priority: "PriorityPoint",
    path: "Path",
    grass: "Grass",
    item: "Item",
    "mystery-fruit": "Mystery Fruit",
    bridge: "Bridge",
    gate: "Gate",
    tunnel: "Tunnel",
    "one-way": "One Way",
    "count-barrier": "Count Barrier",
    tray: "Tray"
  }[target] ?? target;
}

function trayAtTrayPosition(state, index) {
  return Object.entries(state.sharedCells ?? {}).find(([key, cell]) => {
    if (!["tray", "truck"].includes(cell.item?.kind)) return false;
    const [deliverX, deliverY] = key.split(",").map(Number);
    if (!Number.isInteger(deliverX) || !Number.isInteger(deliverY)) return false;
    const trayPosition = getTrayVisualPosition(cell.item, { x: deliverX, y: deliverY });
    return positionToIndex(trayPosition.x, trayPosition.y, state.grid.columns) === index;
  });
}

function getElementTargets(state, context) {
  const targets = [];
  if (isBridgeElement(context.shared.element)) targets.push({ mode: "bridge", label: targetLabel("bridge") });
  if (isGateElement(context.shared.element)) targets.push({ mode: "gate", label: targetLabel("gate") });
  const tunnel = findTunnelAtIndex(state, context.index);
  if (tunnel) targets.push({ mode: "tunnel", label: `Tunnel #${tunnel.tunnelId}` });
  const oneWay = findOneWayAtIndex(state, context.index);
  if (oneWay) targets.push({ mode: "one-way", label: `One Way #${oneWay.oneWayId}` });
  const barrier = findCountBarrierAtIndex(state, context.index);
  if (barrier) targets.push({ mode: "count-barrier", label: `Count Barrier #${barrier.barrierId}` });
  if (context.layerCell.item?.kind === "fruit" && isMysteryFruitAt(state, context.layerNumber, context.index)) {
    targets.push({ mode: "mystery-fruit", label: targetLabel("mystery-fruit") });
  }
  return targets;
}

function getDeleteTargets(state, position) {
  ensureTerrainState(state);
  const context = activeLayerContext(state, position);
  if (!context) return [];
  const targets = [];
  targets.push(...getElementTargets(state, context));
  if (context.layerCell.item?.kind === "fruit" || (context.shared.item && !["tray", "truck"].includes(context.shared.item.kind))) {
    targets.push({ mode: "item", label: context.layerCell.item?.label ?? context.shared.item?.label ?? targetLabel("item") });
  }
  if (state.priorityPoints?.[context.key]) targets.push({ mode: "priority", label: targetLabel("priority") });
  if (trayAtTrayPosition(state, context.index)) targets.push({ mode: "tray", label: targetLabel("tray") });
  if (context.shared.path) targets.push({ mode: "path", label: targetLabel("path") });
  if (state.grassCells?.[context.key]) targets.push({ mode: "grass", label: targetLabel("grass") });
  return targets;
}

function getSmartDeleteTarget(state, position) {
  return getDeleteTargets(state, position)[0] ?? null;
}


// ---- js/editor/object-placement.js ----












function junctionKeys(state) {
  const layer = createMergedLayer(state);
  return new Set(Object.keys(layer.cells ?? {}).filter((key) => {
    if (isBridgeElement(state.sharedCells?.[key]?.element)) return false;
    const { x, y } = parseCellKey(key);
    return isPathJunction(layer, x, y);
  }));
}

function syncAutoPriorityPoints(state, beforeJunctions) {
  const afterJunctions = junctionKeys(state);
  Object.entries(state.priorityPoints).forEach(([key, source]) => {
    if (source === "auto" && !afterJunctions.has(key)) delete state.priorityPoints[key];
  });
  afterJunctions.forEach((key) => {
    if (!beforeJunctions.has(key) && !state.priorityPoints[key]) state.priorityPoints[key] = "auto";
  });
}

function findPlacedObject(state, objectId) {
  for (const [key, cell] of Object.entries(state.sharedCells ?? {})) {
    if (cell.item?.id === objectId) return { scope: "shared", key };
  }
  return null;
}

function nextTrayId(state) {
  const used = new Set(Object.values(state.sharedCells ?? {}).filter((cell) => cell.item?.kind === "tray").map((cell) => Number(cell.item.trayId)));
  let id = 0;
  while (used.has(id)) id += 1;
  return id;
}

function removeTrayAtTrayPosition(state, position) {
  const targetIndex = positionToIndex(position.x, position.y, state.grid.columns);
  const entry = Object.entries(state.sharedCells ?? {}).find(([key, cell]) => {
    if (!["tray", "truck"].includes(cell.item?.kind)) return false;
    const [deliverX, deliverY] = key.split(",").map(Number);
    const trayPosition = cell.item.trayPosition ?? { x: deliverX, y: deliverY - 1 };
    return positionToIndex(trayPosition.x, trayPosition.y, state.grid.columns) === targetIndex;
  });
  if (!entry) return false;
  const [key, shared] = entry;
  shared.item = null;
  if (!shared.path && !shared.element) delete state.sharedCells[key];
  return true;
}

function objectCategory(object) {
  if (!object) return null;
  if (object?.category) return object.category;
  return ["snake", "fruit", "tray", "truck"].includes(object?.kind) ? "item" : "element";
}

function eraseCellLayers(shared, layerCell, mode, { protectPath = false, allowPlayerHeadDelete = true } = {}) {
  const removeLayerItem = () => {
    if (layerCell.item?.kind !== "fruit") return false;
    layerCell.item = null;
    return true;
  };
  const removeSharedItem = () => {
    if (objectCategory(shared.item) !== "item" || ["tray", "truck"].includes(shared.item?.kind)) return false;
    if (isPlayerHeadItem(shared.item) && !allowPlayerHeadDelete) return false;
    shared.item = null;
    return true;
  };
  const removeElement = () => {
    if (shared.element) {
      shared.element = null;
      return true;
    }
    if (objectCategory(shared.item) === "element") {
      shared.item = null;
      return true;
    }
    return false;
  };
  const removePath = () => {
    if (!shared.path) return { changed: false };
    if (protectPath) return { changed: false, reason: "fruit-on-other-layer" };
    shared.path = false;
    return { changed: true, removed: "path" };
  };

  if (mode === "item") {
    if (removeLayerItem()) return { changed: true, removed: "layer-item" };
    return { changed: removeSharedItem(), removed: "shared-item" };
  }
  if (mode === "tray") {
    if (!["tray", "truck"].includes(shared.item?.kind)) return { changed: false };
    shared.item = null;
    return { changed: true, removed: "tray" };
  }
  if (mode === "bridge") {
    if (!isBridgeElement(shared.element)) return { changed: false };
    shared.element = null;
    return { changed: true, removed: "bridge" };
  }
  if (mode === "gate") {
    if (!isGateElement(shared.element)) return { changed: false };
    shared.element = null;
    return { changed: true, removed: "gate" };
  }
  if (mode === "element") return { changed: removeElement(), removed: "element" };
  if (mode === "path") return removePath();

  if (removeElement()) return { changed: true, removed: "element" };
  if (removeLayerItem()) return { changed: true, removed: "layer-item" };
  if (removeSharedItem()) return { changed: true, removed: "shared-item" };
  return removePath();
}

function eraseAtPosition(state, position, mode = "smart") {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId);
  if (!layer || !position) return { changed: false };
  ensureTerrainState(state);
  state.sharedCells ??= {};
  if (mode === "smart") {
    const target = getSmartDeleteTarget(state, position);
    if (!target) {
      state.selectedCell = { x: position.x, y: position.y };
      return { changed: false };
    }
    return eraseAtPosition(state, position, target.mode);
  }
  const key = cellKey(position.x, position.y);
  const beforeJunctions = junctionKeys(state);
  const shared = structuredClone(state.sharedCells[key] ?? { path: false, item: null, element: null });
  const layerCell = structuredClone(layer.cells[key] ?? { item: null });
  if (mode === "grass") {
    if (!state.grassCells[key]) return { changed: false };
    delete state.grassCells[key];
    state.selectedCell = { x: position.x, y: position.y };
    return { changed: true, removed: "grass" };
  }
  if (mode === "priority") {
    if (!state.priorityPoints[key]) return { changed: false };
    delete state.priorityPoints[key];
    state.selectedCell = { x: position.x, y: position.y };
    return { changed: true, removed: "priority-point" };
  }
  if (mode === "mystery-fruit") {
    const layerNumber = Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer);
    const changed = setMysteryFruitAt(state, layerNumber, positionToIndex(position.x, position.y, state.grid.columns), false);
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "mystery-fruit" : null };
  }
  if (mode === "count-barrier") {
    const changed = removeCountBarrierAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "count-barrier" : null };
  }
  if (mode === "tunnel") {
    const changed = removeTunnelAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "tunnel" : null };
  }
  if (mode === "one-way") {
    const changed = removeOneWayAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "one-way" : null };
  }
  if (mode === "tray" && removeTrayAtTrayPosition(state, position)) {
    state.selectedCell = { x: position.x, y: position.y };
    return { changed: true, removed: "tray" };
  }
  const result = eraseCellLayers(shared, layerCell, mode, {
    protectPath: false,
    allowPlayerHeadDelete: isPlayerHeadLayer(state, layer.id)
  });
  if (result.removed === "layer-item") {
    setMysteryFruitAt(state, Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer), positionToIndex(position.x, position.y, state.grid.columns), false);
  }

  if (result.removed === "path") {
    state.grassCells[key] = true;
    delete state.priorityPoints[key];
    removeCountBarrierAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.tunnelDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.tunnelDraft = null;
    removeOneWayAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.oneWayDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.oneWayDraft = null;
  }

  if (!shared.path && !shared.item && !shared.element) delete state.sharedCells[key];
  else state.sharedCells[key] = shared;
  if (!layerCell.item) delete layer.cells[key];
  else layer.cells[key] = layerCell;
  state.selectedCell = { x: position.x, y: position.y };
  if (result.removed === "path") syncAutoPriorityPoints(state, beforeJunctions);
  return result;
}

function applyTool(state, x, y, toolOverride = null) {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId);
  if (!layer) return;
  ensureTerrainState(state);
  state.sharedCells ??= {};
  const key = cellKey(x, y);
  const shared = structuredClone(state.sharedCells[key] ?? { path: false, item: null, element: null });
  const layerCell = structuredClone(layer.cells[key] ?? { item: null });
  const tool = toolOverride ?? state.tool;

  if (tool === "erase" || tool === "smart-erase") {
    return eraseAtPosition(state, { x, y }, tool === "smart-erase" ? "smart" : (state.eraseMode ?? "smart"));
  }

  if (tool === "path") {
    const beforeJunctions = junctionKeys(state);
    shared.path = true;
    delete state.grassCells[key];
    state.sharedCells[key] = shared;
    syncAutoPriorityPoints(state, beforeJunctions);
  } else if (tool === "terrain") {
    if (state.selectedAssetId === TERRAIN_ASSET_IDS.GRASS) {
      if (shared.path) return { changed: false, reason: "grass-on-path" };
      state.grassCells[key] = true;
    } else if (state.selectedAssetId === TERRAIN_ASSET_IDS.EMPTY) {
      if (shared.path) return { changed: false, reason: "terrain-on-path" };
      delete state.grassCells[key];
    } else if (state.selectedAssetId === TERRAIN_ASSET_IDS.PRIORITY_POINT) {
      if (!shared.path) return { changed: false, reason: "priority-needs-path" };
      state.priorityPoints[key] = "manual";
    }
  } else if (tool === "item") {
    const object = findObject(state.selectedAssetId);
    if (object) {
      if (isPlayerHeadItem(object) && !isPlayerHeadLayer(state, layer.id)) {
        state.selectedCell = { x, y };
        return { changed: false, reason: "player-head-layer-locked", objectId: object.id };
      }
      const placed = object.uniqueOnMap ? findPlacedObject(state, object.id) : null;
      if (placed && placed.key !== key) {
        state.selectedCell = { x, y };
        return { changed: false, reason: "unique-object-exists", objectId: object.id };
      }
      if (isPlayerHeadItem(object)) {
        if (shared.item && shared.item.id !== object.id) return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        if (layerCell.item) return { changed: false, reason: "fruit-position-occupied", objectId: object.id };
        shared.item = cloneObject(object);
        shared.path = true;
      } else if (object.kind === "fruit") {
        const index = positionToIndex(x, y, state.grid.columns);
        if (bridgeOccupiesIndex(state, index)) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "bridge-item-overlap", objectId: object.id };
        }
        const barrier = findCountBarrierAtIndex(state, index);
        if (barrier && (barrier.startIndex === index || barrier.endIndex === index)) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "fruit-on-barrier-endpoint", objectId: object.id };
        }
        shared.path = true;
        if (shared.item && !isPlayerHeadItem(shared.item)) return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        if (shared.item && isPlayerHeadLayer(state, layer.id)) return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        layerCell.item = cloneObject(object);
      } else if (object.kind === "mystery-fruit") {
        const layerNumber = Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer);
        const index = positionToIndex(x, y, state.grid.columns);
        if (layerCell.item?.kind !== "fruit") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "mystery-needs-fruit", objectId: object.id };
        }
        const hidden = !setMysteryFruitAt(state, layerNumber, index, false);
        setMysteryFruitAt(state, layerNumber, index, hidden);
        state.selectedCell = { x, y };
        return { changed: true, action: hidden ? "mystery-added" : "mystery-removed" };
      } else if (isCountBarrierTool(object)) {
        const index = positionToIndex(x, y, state.grid.columns);
        if (!shared.path) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "barrier-needs-path", objectId: object.id };
        }
        const existing = findCountBarrierAtIndex(state, index);
        if (existing) {
          state.activeBarrierId = existing.barrierId;
          state.selectedCountBarrierCount = normalizeCountBarrierCount(existing.count);
          state.selectedCell = { x, y };
          return { changed: true, action: "count-barrier-selected", barrierId: existing.barrierId };
        }
        state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
        if (!Number.isInteger(state.activeBarrierId)) createNewActiveCountBarrier(state);
        let barrier = state.countBarrierElement.find((entry) => entry.barrierId === state.activeBarrierId);
        if (!barrier) {
          barrier = {
            barrierId: state.activeBarrierId,
            count: normalizeCountBarrierCount(state.selectedCountBarrierCount),
            startIndex: index,
            endIndex: index,
            index: []
          };
          state.countBarrierElement.push(barrier);
        }
        if (!barrier.index.includes(index)) barrier.index.push(index);
        barrier.index = [...new Set(barrier.index)].sort((a, b) => a - b);
        barrier.endIndex = index;
        barrier.count = normalizeCountBarrierCount(barrier.count);
        state.selectedCell = { x, y };
        return { changed: true, action: "count-barrier-updated", barrierId: barrier.barrierId };
      } else if (isTunnelTool(object)) {
        const index = positionToIndex(x, y, state.grid.columns);
        const tunnelRule = validateTunnelPointPlacement(state, index);
        if (!tunnelRule.valid) {
          state.selectedCell = { x, y };
          return { changed: false, reason: tunnelRule.reason, objectId: object.id };
        }
        if (state.tunnelDraft?.step === "point-b") {
          const placement = placeTunnelDraftPointB(state, index);
          if (placement.changed) {
            const created = setTunnelDraftDirection(state, tunnelRule.direction);
            state.selectedCell = { x, y };
            return created.changed
              ? { changed: true, action: "tunnel-point-b-selected", tunnelId: created.tunnelId }
              : created;
          }
          state.selectedCell = { x, y };
          return placement;
        }
        const existing = findTunnelAtIndex(state, index);
        if (existing) {
          state.activeTunnelId = existing.tunnelId;
          state.selectedCell = { x, y };
          return { changed: true, action: "tunnel-selected", tunnelId: existing.tunnelId };
        }
        const placement = startTunnelDraftAt(state, index);
        if (placement.changed) {
          const directionPlacement = setTunnelDraftDirection(state, tunnelRule.direction);
          state.selectedCell = { x, y };
          return directionPlacement.changed
            ? { changed: true, action: "tunnel-point-a-selected", tunnelId: placement.tunnelId }
            : directionPlacement;
        }
        state.selectedCell = { x, y };
        return placement;
      } else if (isOneWayTool(object)) {
        const index = positionToIndex(x, y, state.grid.columns);
        if (!shared.path) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "one-way-needs-path", objectId: object.id };
        }
        if (state.oneWayDraft?.step === "direction-a") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "one-way-needs-direction-a", objectId: object.id };
        }
        if (state.oneWayDraft?.step === "direction-b") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "one-way-needs-direction-b", objectId: object.id };
        }
        if (state.oneWayDraft?.step === "point-b") {
          const placement = placeOneWayDraftPointB(state, index);
          state.selectedCell = { x, y };
          return placement;
        }
        const existing = findOneWayAtIndex(state, index);
        if (existing) {
          state.activeOneWayId = existing.oneWayId;
          state.selectedCell = { x, y };
          return { changed: true, action: "one-way-selected", oneWayId: existing.oneWayId };
        }
        const placement = startOneWayDraftAt(state, index);
        state.selectedCell = { x, y };
        return placement;
      } else if (objectCategory(object) === "element") {
        if (isBridgeElement(object)) {
          const bridgeRule = validateBridgePlacement(state, positionToIndex(x, y, state.grid.columns));
          if (!bridgeRule.valid) return { changed: false, reason: bridgeRule.reason, objectId: object.id };
        }
        const gateRule = isGateElement(object) ? validateGatePlacement(state, positionToIndex(x, y, state.grid.columns)) : null;
        if (gateRule && !gateRule.valid) {
          return { changed: false, reason: gateRule.reason, objectId: object.id };
        }
        if (shared.element && shared.element.id !== object.id) {
          return { changed: false, reason: "element-position-occupied", objectId: shared.element.id };
        }
        const element = cloneObject(object);
        if (isBridgeElement(element)) element.axis = normalizeBridgeAxis(BRIDGE_AXES.HORIZONTAL);
        if (isGateElement(element)) element.direction = normalizeGateDirection(gateRule.direction);
        shared.element = element;
        if (isBridgeElement(element)) delete state.priorityPoints[key];
      } else {
        if (shared.item && shared.item.id !== object.id) {
          return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        }
        const fruitAtPosition = state.layers.some((candidate) => candidate.cells?.[key]?.item?.kind === "fruit");
        if (fruitAtPosition) return { changed: false, reason: "fruit-position-occupied", objectId: object.id };
        if (["tray", "truck"].includes(object.kind)) {
          if (!shared.path) return { changed: false, reason: "tray-checkpoint-needs-road", objectId: object.id };
          const visualPosition = { x, y: y - 1 };
          const trayValidation = validateTrayPair(state.grid, object, visualPosition);
          if (!trayValidation.valid) return { changed: false, reason: trayValidation.reason === "footprint-outside-grid" ? "tray-visual-outside-grid" : trayValidation.reason, objectId: object.id };
          shared.item = cloneObject(object);
          const trayId = nextTrayId(state);
          shared.item.id = `tray-${trayId}`;
          shared.item.trayId = trayId;
          shared.item.trayPosition = visualPosition;
        } else {
          shared.item = cloneObject(object);
          shared.path = true;
        }
      }
    }
  }

  if (!shared.path && !shared.item && !shared.element) delete state.sharedCells[key];
  else state.sharedCells[key] = shared;
  if (!layerCell.item) delete layer.cells[key];
  else layer.cells[key] = layerCell;
  state.selectedCell = { x, y };
  return { changed: true };
}

function clearEntireMap(state) {
  let removedCells = Object.keys(state.sharedCells ?? {}).length;
  state.sharedCells = {};
  state.grassCells = createFullGrassCells(state.grid);
  state.priorityPoints = {};
  state.mysteryFruitElement = [];
  state.countBarrierElement = [];
  state.activeBarrierId = null;
  state.nextBarrierId = 0;
  state.drawingCountBarrierId = null;
  state.tunnelElement = [];
  state.activeTunnelId = null;
  state.nextTunnelId = 0;
  state.tunnelDraft = null;
  state.oneWayElement = [];
  state.activeOneWayId = null;
  state.nextOneWayId = 0;
  state.oneWayDraft = null;
  for (const layer of state.layers ?? []) {
    removedCells += Object.keys(layer.cells ?? {}).length;
    layer.cells = {};
  }
  state.selectedCell = null;
  return { changed: removedCells > 0, removedCells };
}

function deleteItemAt(state, position) {
  return eraseAtPosition(state, position, "smart").changed;
}

function togglePathAt(state, position) {
  ensureTerrainState(state);
  state.sharedCells ??= {};
  const key = cellKey(position.x, position.y);
  const cell = structuredClone(state.sharedCells[key] ?? { path: false, item: null, element: null });
  const beforeJunctions = junctionKeys(state);
  cell.path = !cell.path;
  if (cell.path) delete state.grassCells[key];
  else {
    state.grassCells[key] = true;
    delete state.priorityPoints[key];
  }
  if (!cell.path) {
    cell.item = null;
    removeCountBarrierAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.tunnelDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.tunnelDraft = null;
    removeOneWayAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.oneWayDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.oneWayDraft = null;
    state.layers.forEach((layer) => { delete layer.cells[key]; });
    state.layers.forEach((layer, index) => {
      setMysteryFruitAt(state, Number.isInteger(layer.layer) ? layer.layer : index, positionToIndex(position.x, position.y, state.grid.columns), false);
    });
  }
  if (!cell.path && !cell.item && !cell.element) delete state.sharedCells[key];
  else state.sharedCells[key] = cell;
  syncAutoPriorityPoints(state, beforeJunctions);
}


// ---- js/editor/selection-manager.js ----


function selectCell(state, x, y) {
  state.selectedCell = { x, y };
}

function changeSelectedTruckCapacity(state, delta) {
  if (!state.selectedCell) return false;
  const cell = state.sharedCells?.[cellKey(state.selectedCell.x, state.selectedCell.y)];
  if (cell?.item?.kind !== "truck") return false;
  cell.item.capacity = clamp((Number(cell.item.capacity) || 1) + delta, 1, 99);
  return true;
}


// ---- js/editor/camera-controller.js ----
class CameraController {
  constructor({ min = 0.5, max = 2, step = 0.1, onChange = () => {} } = {}) {
    this.min = min;
    this.max = max;
    this.step = step;
    this.onChange = onChange;
    this.zoom = 1;
  }

  setZoom(value) {
    const clamped = Math.min(this.max, Math.max(this.min, Number(value) || 1));
    this.zoom = Math.round(clamped * 100) / 100;
    this.onChange(this.zoom);
    return this.zoom;
  }

  zoomIn() { return this.setZoom(this.zoom + this.step); }

  zoomOut() { return this.setZoom(this.zoom - this.step); }

  reset() { this.setZoom(1); }
}


// ---- js/editor/grid-renderer.js ----











function renderGrid(container, editorData) {
  ensureTerrainState(editorData);
  applyVisualScaleConfig(container);
  const activeLayer = editorData.layers.find((candidate) => candidate.id === editorData.activeLayerId) ?? editorData.layers[0];
  const layer = createMergedLayer(editorData);
  if (activeLayer?.visible === false) {
    Object.values(layer.cells).forEach((cell) => {
      cell.item = cell.sharedItem ?? null;
      cell.layerItem = null;
    });
  }
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${editorData.grid.columns}, minmax(0, 1fr))`;
  const trayVisuals = new Map();
  const trayCheckpoints = new Map();
  const bridgeVisuals = new Map();
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!isBridgeElement(cell?.element)) return;
    const [bridgeX, bridgeY] = key.split(",").map(Number);
    const centerIndex = positionToIndex(bridgeX, bridgeY, editorData.grid.columns);
    bridgeVisuals.set(key, { centerIndex });
  });
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!["tray", "truck"].includes(cell?.item?.kind)) return;
    const [trayX, trayY] = key.split(",").map(Number);
    trayCheckpoints.set(key, { x: trayX, y: trayY, item: cell.item });
    getTrayVisualCells(cell.item, { x: trayX, y: trayY }).forEach((visual) => {
      trayVisuals.set(cellKey(visual.x, visual.y), { x: trayX, y: trayY, item: cell.item, role: visual.role, center: visual.center });
    });
  });

  for (let y = 0; y < editorData.grid.rows; y += 1) {
    for (let x = 0; x < editorData.grid.columns; x += 1) {
      const data = getCell(layer, x, y);
      const index = positionToIndex(x, y, editorData.grid.columns);
      const priorityPoint = Boolean(editorData.priorityPoints[cellKey(x, y)]);
      const countBarrier = findCountBarrierAtIndex(editorData, index);
      const tunnelEntry = findTunnelEntryAtIndex(editorData, index);
      const tunnelDraftEntry = findTunnelDraftEntryAtIndex(editorData, index);
      const oneWayEntry = findOneWayEntryAtIndex(editorData, index);
      const oneWayDraftEntry = findOneWayDraftEntryAtIndex(editorData, index);
      const barrierEndpoint = countBarrier && (countBarrier.startIndex === index || countBarrier.endIndex === index);
      const activeBarrier = countBarrier && countBarrier.barrierId === editorData.activeBarrierId;
      const activeTunnel = (tunnelEntry && tunnelEntry.tunnel.tunnelId === editorData.activeTunnelId) || Boolean(tunnelDraftEntry);
      const activeOneWay = (oneWayEntry && oneWayEntry.oneWay.oneWayId === editorData.activeOneWayId) || Boolean(oneWayDraftEntry);
      const grass = Boolean(editorData.grassCells[cellKey(x, y)]);
      const checkpointTray = trayCheckpoints.get(cellKey(x, y));
      const visualTray = trayVisuals.get(cellKey(x, y));
      const visualBridge = bridgeVisuals.get(cellKey(x, y));
      const selectedObject = editorData.tool === "item" ? findObject(editorData.selectedAssetId) : null;
      let placementState = null;
      if (selectedObject?.kind === "bridge") placementState = validateBridgePlacement(editorData, index);
      else if (selectedObject?.kind === "gate") placementState = validateGatePlacement(editorData, index);
      else if (isTunnelTool(selectedObject)) placementState = validateTunnelPointPlacement(editorData, index);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `grid-cell${grass ? " grass" : " terrain-empty"}${data.path ? " path" : ""}${priorityPoint ? " priority-point" : ""}${countBarrier ? " count-barrier-cell" : ""}${activeBarrier ? " active-count-barrier-cell" : ""}${barrierEndpoint ? " count-barrier-endpoint" : ""}${tunnelEntry || tunnelDraftEntry ? " tunnel-cell" : ""}${tunnelDraftEntry ? " tunnel-draft-cell" : ""}${activeTunnel ? " active-tunnel-cell" : ""}${oneWayEntry || oneWayDraftEntry ? " one-way-cell" : ""}${oneWayDraftEntry ? " one-way-draft-cell" : ""}${activeOneWay ? " active-one-way-cell" : ""}${placementState ? (placementState.valid ? " placement-valid" : " placement-invalid") : ""}${samePosition(editorData.selectedCell, { x, y }) ? " selected" : ""}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      if (tunnelEntry || tunnelDraftEntry) cell.style.setProperty("--tunnel-color", tunnelColor((tunnelEntry?.tunnel ?? tunnelDraftEntry?.draft).tunnelId));
      if (oneWayEntry || oneWayDraftEntry) cell.style.setProperty("--one-way-color", oneWayColor((oneWayEntry?.oneWay ?? oneWayDraftEntry?.draft).oneWayId));
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Ô Index ${index}${priorityPoint ? ", PriorityPoint" : ""}${grass ? ", Grass" : data.path ? ", Path" : ", Terrain trống"}`);
      if (placementState) {
        cell.title = placementState.valid ? "✓ Có thể đặt" : (PLACEMENT_MESSAGES[placementState.reason] ?? "Không thể đặt");
      }

      if (visualBridge) {
        const bridge = document.createElement("span");
        bridge.className = "bridge-preview bridge-joined";
        bridge.title = `Bridge Center #${visualBridge.centerIndex}`;
        for (let segment = 0; segment < 3; segment += 1) {
          const icon = document.createElement("span");
          icon.textContent = "🟰";
          bridge.appendChild(icon);
        }
        cell.appendChild(bridge);
      }
      if (isGateElement(data.element)) {
        const gate = document.createElement("span");
        gate.className = `gate-preview ${gateDirectionClass(data.element.direction)}`;
        gate.title = `Gate ${gateDirectionClass(data.element.direction)}`;
        cell.appendChild(gate);
      }
      if (barrierEndpoint) {
        const barrier = document.createElement("span");
        barrier.className = "count-barrier-preview";
        barrier.title = `Count Barrier ${countBarrier.barrierId} · count ${countBarrier.count}`;
        barrier.textContent = String(countBarrier.count);
        cell.appendChild(barrier);
      }
      if (tunnelEntry) {
        const tunnel = document.createElement("span");
        tunnel.className = `tunnel-preview ${tunnelDirectionClass(tunnelEntry.entryPoint.direction)}`;
        tunnel.title = `Tunnel ${tunnelEntry.tunnel.tunnelId} · Entry ${tunnelEntry.entryIndex === 0 ? "A" : "B"}`;
        tunnel.style.setProperty("--tunnel-color", tunnelColor(tunnelEntry.tunnel.tunnelId));
        const symbol = document.createElement("span");
        symbol.className = "tunnel-symbol";
        symbol.textContent = tunnelDirectionIcon(tunnelEntry.entryPoint.direction);
        tunnel.appendChild(symbol);
        cell.appendChild(tunnel);
      }
      if (tunnelDraftEntry) {
        const tunnel = document.createElement("span");
        const hasDirection = Number.isInteger(tunnelDraftEntry.entryPoint.direction);
        tunnel.className = `tunnel-preview draft ${hasDirection ? tunnelDirectionClass(tunnelDraftEntry.entryPoint.direction) : "pending"}`;
        tunnel.title = `Tunnel ${tunnelDraftEntry.draft.tunnelId} draft · Entry ${tunnelDraftEntry.entryIndex === 0 ? "A" : "B"}`;
        tunnel.style.setProperty("--tunnel-color", tunnelColor(tunnelDraftEntry.draft.tunnelId));
        const symbol = document.createElement("span");
        symbol.className = "tunnel-symbol";
        symbol.textContent = "⏭";
        tunnel.appendChild(symbol);
        cell.appendChild(tunnel);
      }
      if (oneWayEntry) {
        const oneWay = document.createElement("span");
        oneWay.className = `one-way-preview ${oneWayDirectionClass(oneWayEntry.entryPoint.direction)}`;
        oneWay.title = `One Way ${oneWayEntry.oneWay.oneWayId} · Entry ${oneWayEntry.entryIndex === 0 ? "A" : "B"}`;
        oneWay.style.setProperty("--one-way-color", oneWayColor(oneWayEntry.oneWay.oneWayId));
        oneWay.textContent = oneWayDirectionIcon(oneWayEntry.entryPoint.direction);
        cell.appendChild(oneWay);
      }
      if (oneWayDraftEntry) {
        const oneWay = document.createElement("span");
        const hasDirection = Number.isInteger(oneWayDraftEntry.entryPoint.direction);
        oneWay.className = `one-way-preview draft ${hasDirection ? oneWayDirectionClass(oneWayDraftEntry.entryPoint.direction) : "pending"}`;
        oneWay.title = `One Way ${oneWayDraftEntry.draft.oneWayId} draft · Entry ${oneWayDraftEntry.entryIndex === 0 ? "A" : "B"}`;
        oneWay.style.setProperty("--one-way-color", oneWayColor(oneWayDraftEntry.draft.oneWayId));
        oneWay.textContent = hasDirection ? oneWayDirectionIcon(oneWayDraftEntry.entryPoint.direction) : "▲";
        cell.appendChild(oneWay);
      }
      if (data.item && data.item.kind !== "tray") {
        const isHiddenFruit = data.item.kind === "fruit"
          && data.layerItem?.kind === "fruit"
          && isMysteryFruitAt(editorData, Number.isInteger(activeLayer?.layer) ? activeLayer.layer : 0, index)
          && !editorData.mysteryFruitDebug;
        const icon = document.createElement("span");
        icon.className = `placed-icon ${data.item.kind}${isHiddenFruit ? " mystery-fruit-preview" : ""}`;
        if (data.item.kind === "fruit") {
          applyBlockItemVisual(icon, data.item, { mystery: isHiddenFruit });
        } else {
          icon.textContent = data.item.icon;
        }
        cell.appendChild(icon);
      }
      if (visualTray) {
        const icon = document.createElement("span");
        icon.className = `tray-footprint ${visualTray.role}${visualTray.center ? " center" : ""}`;
        icon.textContent = visualTray.center ? (visualTray.item.icon ?? "🧺") : "";
        icon.title = visualTray.role === "conveyor" ? "Tray Conveyor / trayPosition" : "Tray Main 3x3";
        cell.appendChild(icon);
      }
      if (checkpointTray) {
        const checkpoint = document.createElement("span");
        checkpoint.className = "delivery-checkpoint editor-checkpoint";
        checkpoint.title = `Checkpoint khay ID ${checkpointTray.item.trayId} tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, editorData.grid.columns)}`;
        checkpoint.textContent = "⭕";
        cell.appendChild(checkpoint);
      }
      container.appendChild(cell);
    }
  }
}


// ---- js/editor/input-controller.js ----
function rasterizeGridLine(from, to) {
  const cells = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = dx - dy;

  while (true) {
    cells.push({ x, y });
    if (x === to.x && y === to.y) break;
    const doubledError = error * 2;
    if (doubledError > -dy) { error -= dy; x += stepX; }
    if (doubledError < dx) { error += dx; y += stepY; }
  }
  return cells;
}

class InputController {
  constructor({ root = document, onCell, onShortcut, isEnabled = () => true, canDrag = () => true, onStrokeStart = () => {}, onStrokeEnd = () => {} }) {
    this.root = root;
    this.onCell = onCell;
    this.onShortcut = onShortcut;
    this.isEnabled = isEnabled;
    this.canDrag = canDrag;
    this.onStrokeStart = onStrokeStart;
    this.onStrokeEnd = onStrokeEnd;
    this.isDrawing = false;
    this.strokeMode = "primary";
    this.visited = new Set();
    this.lastCell = null;
    this.handleClick = this.handleClick.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  connect(grid) {
    this.grid = grid;
    grid.addEventListener("click", this.handleClick);
    grid.addEventListener("pointerdown", this.handlePointerDown);
    this.root.addEventListener("pointermove", this.handlePointerMove);
    this.root.addEventListener("pointerup", this.handlePointerUp);
    this.root.addEventListener("pointercancel", this.handlePointerUp);
    this.root.addEventListener("contextmenu", this.handleContextMenu);
    this.root.addEventListener("keydown", this.handleKeydown);
  }

  disconnect() {
    this.grid?.removeEventListener("click", this.handleClick);
    this.grid?.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointermove", this.handlePointerMove);
    this.root.removeEventListener("pointerup", this.handlePointerUp);
    this.root.removeEventListener("pointercancel", this.handlePointerUp);
    this.root.removeEventListener("contextmenu", this.handleContextMenu);
    this.root.removeEventListener("keydown", this.handleKeydown);
  }

  handleClick(event) {
    if (!this.isEnabled()) return;
    if (event.detail !== 0) return;
    const cell = event.target.closest(".grid-cell");
    if (cell) this.onCell(Number(cell.dataset.x), Number(cell.dataset.y), { clientX: event.clientX, clientY: event.clientY });
  }

  handlePointerDown(event) {
    if (!this.isEnabled()) return;
    if (event.button !== 0 && event.button !== 2) return;
    const cell = event.target.closest(".grid-cell");
    if (!cell) return;
    event.preventDefault();
    const position = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
    const eraseOverride = event.button === 2;

    if (!eraseOverride && !this.canDrag()) {
      this.onCell(position.x, position.y, { clientX: event.clientX, clientY: event.clientY });
      return;
    }

    this.isDrawing = true;
    this.visited.clear();
    this.lastCell = null;
    this.strokeMode = eraseOverride ? "erase" : "primary";
    this.grid.classList.add("is-drawing");
    this.onStrokeStart();
    this.paintTo(position, { clientX: event.clientX, clientY: event.clientY });
  }

  handlePointerMove(event) {
    if (!this.isDrawing) return;
    if (!this.isEnabled()) return this.handlePointerUp();
    const target = this.root.elementFromPoint?.(event.clientX, event.clientY);
    const cell = target?.closest?.(".grid-cell");
    if (!cell || !this.grid.contains(cell)) return;
    this.paintTo({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) }, { clientX: event.clientX, clientY: event.clientY });
  }

  handlePointerUp() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.grid.classList.remove("is-drawing");
    this.visited.clear();
    this.lastCell = null;
    this.strokeMode = "primary";
    this.onStrokeEnd();
  }

  handleContextMenu(event) {
    event.preventDefault();
  }

  paintTo(position, pointer = {}) {
    const cells = this.lastCell ? rasterizeGridLine(this.lastCell, position) : [position];
    cells.forEach((cell) => {
      const key = `${cell.x},${cell.y}`;
      if (this.visited.has(key)) return;
      this.visited.add(key);
      this.onCell(cell.x, cell.y, { eraseOverride: this.strokeMode === "erase", ...pointer });
    });
    this.lastCell = position;
  }

  handleKeydown(event) {
    if (!this.isEnabled()) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if ((modifier && ["z", "y"].includes(key)) || ["delete", "backspace", "1", "2", "3", "4"].includes(key)) {
      event.preventDefault();
      this.onShortcut({ key, modifier, shift: event.shiftKey });
    }
  }
}


// ---- js/ui/notification.js ----
let timer;

function showNotification(element, message) {
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => element.classList.remove("show"), 1800);
}


// ---- js/ui/object-palette.js ----

function renderObjectPalette(container, objects, selectedId, { emptyLabel = "Chưa có object trong nhóm này.", unavailableIds = [], unavailableReasons = {}, bridgeAxis = 0, countBarrierCount = 1 } = {}) {
  container.innerHTML = "";
  if (objects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "palette-empty";
    empty.textContent = emptyLabel;
    container.appendChild(empty);
    return;
  }
  const unavailable = new Set(unavailableIds);
  objects.forEach((object) => {
    const button = document.createElement("button");
    button.type = "button";
    const isUnavailable = unavailable.has(object.id);
    const unavailableReason = unavailableReasons[object.id] ?? "Đã có trên map";
    button.className = `asset-btn${String(object.id) === String(selectedId) ? " active" : ""}${isUnavailable ? " unavailable" : ""}`;
    button.dataset.asset = object.id;
    button.dataset.tooltip = `ID: ${object.id}${isUnavailable ? ` · ${unavailableReason}` : ""}`;
    button.title = button.dataset.tooltip;
    button.setAttribute("aria-label", `${object.label}. ID: ${object.id}${isUnavailable ? `. ${unavailableReason}` : ""}`);
    if (isUnavailable) button.setAttribute("aria-disabled", "true");
    button.innerHTML = `<span class="asset-icon"></span><span class="asset-label"></span>`;
    button.firstElementChild.textContent = object.icon;
    button.lastElementChild.textContent = object.label;
    if (object.kind === "fruit") {
      button.classList.add("block-item-asset");
      applyBlockItemVisual(button.firstElementChild, object);
    }
    if (object.kind === "bridge") {
      button.classList.add("bridge-asset");
      button.dataset.tooltip = "Bridge · Horizontal 3x1";
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", "Bridge. Horizontal 3x1");
    }
    if (object.kind === "gate") {
      button.classList.add("gate-asset");
      button.firstElementChild.className = "asset-icon gate-icon";
      button.dataset.tooltip = "Gate Tool";
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", "Gate Tool");
    }
    if (object.kind === "count-barrier") {
      button.classList.add("count-barrier-asset");
      button.dataset.tooltip = `Count Barrier · count ${countBarrierCount}`;
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", `Count Barrier. Count ${countBarrierCount}`);
      const badge = document.createElement("span");
      badge.className = "count-barrier-count-picker";
      badge.textContent = `Count ${countBarrierCount}`;
      button.appendChild(badge);
    }
    if (object.kind === "tunnel") {
      button.classList.add("tunnel-asset");
      button.dataset.tooltip = "Tunnel · tạo cặp mới";
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", "Tunnel. Tạo cặp mới");
    }
    if (object.kind === "one-way") {
      button.classList.add("one-way-asset");
      button.dataset.tooltip = "One Way · tạo cặp mới";
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", "One Way. Tạo cặp mới");
    }
    container.appendChild(button);
  });
}


// ---- js/ui/tray-editor.js ----





const TRAY_CAPACITY = 9;

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

function getSelectedTrayContext(state) {
  const selectedCell = state.selectedCell ?? state.activeTrayCell;
  if (!selectedCell) return null;
  const { x, y } = selectedCell;
  const cell = state.sharedCells?.[cellKey(x, y)];
  if (!cell || !["tray", "truck"].includes(cell.item?.kind)) return null;
  return { cell, item: cell.item, x, y };
}

function addTrayLayer(state) {
  const context = getSelectedTrayContext(state);
  if (!context || context.item.kind !== "tray") return false;
  context.item.trayLayers ??= [];
  const nextLayer = Math.max(-1, ...context.item.trayLayers.map((layer, index) => Number.isInteger(layer.layer) ? layer.layer : index)) + 1;
  context.item.trayLayers.push({ id: createId("tray-layer"), layer: nextLayer, recipe: createEmptyRecipe(), unknownItems: [] });
  return true;
}

function setTrayVisualIndex(state, index) {
  const context = getSelectedTrayContext(state);
  if (!context || context.item.kind !== "tray") return { changed: false, reason: "invalid-tray" };
  return moveTrayByTrayPositionIndex(state, context, index);
}

function setTrayDeliverPointIndex(state, index) {
  const context = getSelectedTrayContext(state);
  if (!context || context.item.kind !== "tray") return { changed: false, reason: "invalid-tray" };
  return moveTrayByDeliverPointIndex(state, context, index);
}

function changeTrayLayerRecipe(state, layerIndex, fruitType, delta) {
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

function setTrayLayerBlock(state, layerIndex, blockId) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  const fruitType = fruitTypeFromBlockId(blockId);
  if (!trayLayer || !FRUIT_TYPES.includes(fruitType)) return false;
  return setSingleBlockRecipe(trayLayer, fruitType, TRAY_CAPACITY);
}

function setTrayLayerAmount(state, layerIndex, amount) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  if (!trayLayer) return false;
  trayLayer.recipe = { ...createEmptyRecipe(), ...(trayLayer.recipe ?? {}) };
  const selectedType = selectedTrayLayerBlock(trayLayer.recipe);
  if (!selectedType) return false;
  return setSingleBlockRecipe(trayLayer, selectedType, amount);
}

function removeTrayLayerUnknownItem(state, layerIndex, itemId) {
  const context = getSelectedTrayContext(state);
  const trayLayer = context?.item?.kind === "tray" ? context.item.trayLayers?.[layerIndex] : null;
  if (!trayLayer) return false;
  const before = trayLayer.unknownItems?.length ?? 0;
  trayLayer.unknownItems = (trayLayer.unknownItems ?? []).filter((item) => String(item.itemId) !== String(itemId));
  return trayLayer.unknownItems.length !== before;
}

function moveTrayLayer(state, fromIndex, toIndex) {
  const context = getSelectedTrayContext(state);
  const layers = context?.item?.kind === "tray" ? context.item.trayLayers : null;
  if (!layers || fromIndex < 0 || fromIndex >= layers.length || toIndex < 0 || toIndex >= layers.length || fromIndex === toIndex) return false;
  const layerNumbers = layers.map((layer, index) => Number.isInteger(layer.layer) ? layer.layer : index).sort((a, b) => a - b);
  const [moved] = layers.splice(fromIndex, 1);
  layers.splice(toIndex, 0, moved);
  layers.forEach((layer, index) => { layer.layer = layerNumbers[index]; });
  return true;
}

function removeTrayLayer(state, layerIndex) {
  const context = getSelectedTrayContext(state);
  const layers = context?.item?.kind === "tray" ? context.item.trayLayers : null;
  if (!layers || layerIndex < 0 || layerIndex >= layers.length) return false;
  layers.splice(layerIndex, 1);
  layers.forEach((layer, index) => { layer.layer = index; });
  return true;
}

function convertLegacyTruckToTray(state) {
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
  const picker = document.createElement("div");
  picker.className = "tray-block-picker";
  picker.innerHTML = '<span>Block</span>';
  const dropdown = document.createElement("details");
  dropdown.className = "tray-block-dropdown";
  dropdown.dataset.selectedBlockId = selectedBlockId == null ? "" : String(selectedBlockId);
  const summary = document.createElement("summary");
  summary.setAttribute("aria-label", `Block layer ${index + 1}`);
  summary.appendChild(createBlockDropLabel(selectedBlockId));
  const menu = document.createElement("div");
  menu.className = "tray-block-option-list";
  menu.setAttribute("role", "listbox");
  FRUIT_TYPES.forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tray-block-option${FRUIT_META[type].itemId === selectedBlockId ? " active" : ""}`;
    button.dataset.trayBlockOption = String(FRUIT_META[type].itemId);
    button.dataset.trayLayerIndex = String(index);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(FRUIT_META[type].itemId === selectedBlockId));
    const swatch = document.createElement("span");
    applyBlockItemVisual(swatch, type);
    const name = document.createElement("strong");
    name.textContent = FRUIT_META[type].label;
    const id = document.createElement("em");
    id.textContent = `ID ${FRUIT_META[type].itemId}`;
    button.append(swatch, name, id);
    menu.appendChild(button);
  });
  dropdown.append(summary, menu);
  picker.appendChild(dropdown);
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
  const deliverPointIndex = positionToIndex(context.x, context.y, width);
  positionControl.children[0].children[1].textContent = `Bottom-center · Deliver Point auto ${deliverPointIndex}`;
  const indexInput = positionControl.children[1];
  indexInput.setAttribute("max", String((grid.columns * grid.rows) - 1));
  indexInput.setAttribute("value", String(trayPositionIndex));
  editor.appendChild(positionControl);

  const deliverControl = document.createElement("label");
  deliverControl.className = "tray-position-picker";
  deliverControl.innerHTML = '<span><strong>deliverPoint</strong><small></small></span><input data-tray-deliver-point-index type="number" min="0" step="1" aria-label="Index deliverPoint">';
  deliverControl.children[0].children[1].textContent = `Delivery Point · trayPosition auto ${trayPositionIndex}`;
  const deliverInput = deliverControl.children[1];
  deliverInput.setAttribute("max", String((grid.columns * grid.rows) - 1));
  deliverInput.setAttribute("value", String(deliverPointIndex));
  editor.appendChild(deliverControl);

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

function createTrayContextAt(state, x, y) {
  const cell = state.sharedCells?.[cellKey(x, y)];
  if (!cell || !["tray", "truck"].includes(cell.item?.kind)) return null;
  return { cell, item: cell.item, x, y };
}

function createTrayInspectorCard(context, grid) {
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

function renderTrayEditor(container, state) {
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


// ---- js/ui/data-summary.js ----



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

function collectEditorDataSummary(state) {
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

function renderDataSummary(container, state) {
  const summary = collectEditorDataSummary(state);
  container.innerHTML = "";
  const { element: balanceEl, issues } = renderItemBalance(summary);
  container.appendChild(balanceEl);
  container.appendChild(renderLevelCheck([...summary.trayIssues, ...issues]));
  return summary;
}


// ---- js/ui/panel-resizer.js ----

const PANEL_LAYOUT_STORAGE_KEY = "snacky-editor-panel-layout-v1";

function loadPanelLayout() {
  try { return JSON.parse(localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY) ?? "{}"); }
  catch { return {}; }
}

function savePanelLayout(layout) {
  try { localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(layout)); }
  catch { /* Layout persistence is optional. */ }
}

function setupPanelResizer(config, savedLayout, onLayoutChange) {
  const { handle, target, variable, storageKey, axis, direction, measure, bounds } = config;
  if (!handle || !target) return null;
  let current = Number(savedLayout[storageKey]);
  let drag = null;

  const getBounds = () => {
    const result = bounds();
    return { min: Math.round(result.min), max: Math.max(Math.round(result.min), Math.round(result.max)) };
  };
  const apply = (value, { persist = false } = {}) => {
    const limits = getBounds();
    current = clamp(Math.round(Number(value) || measure()), limits.min, limits.max);
    target.style.setProperty(variable, `${current}px`);
    handle.setAttribute("aria-valuemin", String(limits.min));
    handle.setAttribute("aria-valuemax", String(limits.max));
    handle.setAttribute("aria-valuenow", String(current));
    if (persist) onLayoutChange(storageKey, current);
    return current;
  };
  const reset = () => {
    current = measure();
    target.style.removeProperty(variable);
    handle.removeAttribute("aria-valuenow");
    onLayoutChange(storageKey, null);
  };

  if (Number.isFinite(current) && window.innerWidth > 760) apply(current);

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || window.innerWidth <= 760) return;
    event.preventDefault();
    current = measure();
    drag = { pointerId: event.pointerId, start: axis === "x" ? event.clientX : event.clientY, value: current };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add("dragging");
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointer = axis === "x" ? event.clientX : event.clientY;
    apply(drag.value + ((pointer - drag.start) * direction));
  });
  const finish = (event) => {
    if (!drag || (event.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
    if (handle.hasPointerCapture?.(drag.pointerId)) handle.releasePointerCapture(drag.pointerId);
    drag = null;
    handle.classList.remove("dragging");
    apply(current, { persist: true });
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
  handle.addEventListener("dblclick", reset);
  handle.addEventListener("keydown", (event) => {
    const negativeKey = axis === "x" ? "ArrowLeft" : "ArrowUp";
    const positiveKey = axis === "x" ? "ArrowRight" : "ArrowDown";
    if (![negativeKey, positiveKey, "Home"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") {
      reset();
      return;
    }
    const delta = event.key === negativeKey ? -20 : 20;
    apply((Number.isFinite(current) ? current : measure()) + (delta * direction), { persist: true });
  });

  return { refresh: () => window.innerWidth > 760 && apply(Number.isFinite(current) ? current : measure()) };
}

function initPanelResizers() {
  const app = document.querySelector(".app");
  const sidebar = document.querySelector(".sidebar");
  const workspace = document.getElementById("levelWorkspace");
  const rightRail = workspace?.querySelector(".right-rail");
  const trayCard = rightRail?.querySelector(".tray-card");
  const playableWorkspace = document.getElementById("playableWorkspace");
  const playableHud = playableWorkspace?.querySelector(".playable-hud");
  const savedLayout = loadPanelLayout();
  const updateSavedLayout = (key, value) => {
    if (value === null) delete savedLayout[key];
    else savedLayout[key] = value;
    savePanelLayout(savedLayout);
  };

  const resizers = [
    setupPanelResizer({
      handle: document.getElementById("sidebarResizeHandle"), target: app, variable: "--sidebar-width", storageKey: "sidebar", axis: "x", direction: 1,
      measure: () => sidebar.getBoundingClientRect().width,
      bounds: () => ({ min: 210, max: Math.min(420, window.innerWidth * .38) })
    }, savedLayout, updateSavedLayout),
    setupPanelResizer({
      handle: document.getElementById("workspaceResizeHandle"), target: workspace, variable: "--right-rail-width", storageKey: "editorRail", axis: "x", direction: -1,
      measure: () => rightRail.getBoundingClientRect().width,
      bounds: () => ({ min: 250, max: Math.min(560, workspace.getBoundingClientRect().width * .52) })
    }, savedLayout, updateSavedLayout),
    setupPanelResizer({
      handle: document.getElementById("rightRailResizeHandle"), target: rightRail, variable: "--tray-pane-height", storageKey: "trayHeight", axis: "y", direction: 1,
      measure: () => trayCard.getBoundingClientRect().height,
      bounds: () => ({ min: 150, max: Math.max(150, rightRail.getBoundingClientRect().height - 137) })
    }, savedLayout, updateSavedLayout),
    setupPanelResizer({
      handle: document.getElementById("playableResizeHandle"), target: playableWorkspace, variable: "--playable-hud-width", storageKey: "playableHud", axis: "x", direction: -1,
      measure: () => playableHud.getBoundingClientRect().width,
      bounds: () => ({ min: 250, max: Math.min(560, playableWorkspace.getBoundingClientRect().width * .52) })
    }, savedLayout, updateSavedLayout)
  ].filter(Boolean);

  window.addEventListener("resize", () => resizers.forEach((resizer) => resizer.refresh()));
  return resizers;
}


// ---- js/ui/grid-index-tooltip.js ----
const POINTER_OFFSET = 14;
const VIEWPORT_GAP = 8;

function createGridIndexTooltip({ grid, getGrid, isEnabled }) {
  const tooltip = document.createElement("div");
  tooltip.className = "grid-index-tooltip";
  tooltip.setAttribute("role", "tooltip");
  document.body.appendChild(tooltip);

  function hide() {
    tooltip.classList.remove("show");
  }

  function positionAt(clientX, clientY) {
    const maxX = window.innerWidth - tooltip.offsetWidth - VIEWPORT_GAP;
    const maxY = window.innerHeight - tooltip.offsetHeight - VIEWPORT_GAP;
    tooltip.style.left = `${Math.max(VIEWPORT_GAP, Math.min(clientX + POINTER_OFFSET, maxX))}px`;
    tooltip.style.top = `${Math.max(VIEWPORT_GAP, Math.min(clientY + POINTER_OFFSET, maxY))}px`;
  }

  function showForCell(cell, clientX, clientY) {
    if (!isEnabled()) return hide();
    const columns = Number(getGrid()?.columns);
    const x = Number(cell?.dataset.x);
    const y = Number(cell?.dataset.y);
    if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(x) || !Number.isInteger(y)) return hide();
    tooltip.textContent = `Index: ${(y * columns) + x}`;
    tooltip.classList.add("show");
    positionAt(clientX, clientY);
  }

  grid.addEventListener("pointermove", (event) => {
    const cell = event.target.closest(".grid-cell");
    if (!cell || !grid.contains(cell)) return hide();
    showForCell(cell, event.clientX, event.clientY);
  });
  grid.addEventListener("pointerleave", hide);
  grid.addEventListener("focusin", (event) => {
    const cell = event.target.closest(".grid-cell");
    if (!cell) return;
    const bounds = cell.getBoundingClientRect();
    showForCell(cell, bounds.right, bounds.top);
  });
  grid.addEventListener("focusout", hide);
  document.addEventListener("scroll", hide, true);

  return { hide };
}


// ---- js/ui/generate-panel.js ----


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPercent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function statusOf(state) {
  const meta = state.generationMeta;
  if (meta?.status === "Error") return "Lỗi";
  if (meta?.status === "Generated" && state.fileDirty) return "Đã chỉnh sửa";
  if (meta?.status === "Generated") return "Đã sinh";
  return "Chưa sinh";
}

function statusClass(status) {
  return {
    "Sẵn sàng xem trước": "preview-ready",
    "Đã sinh": "generated",
    "Đã chỉnh sửa": "modified",
    "Lỗi": "error",
    "Chưa sinh": "not-generated"
  }[status] ?? "not-generated";
}

function issueRows(issues) {
  if (!issues?.length) return `<div class="generate-issue ok"><strong>Ổn</strong><span>Không có lỗi bộ sinh.</span></div>`;
  return issues.map((issue) => `
    <div class="generate-issue ${escapeHtml(issue.severity ?? "error")}">
      <strong>${escapeHtml(issue.code)}</strong>
      <span>${escapeHtml(issue.message)}</span>
      ${issue.suggestion ? `<small>${escapeHtml(issue.suggestion)}</small>` : ""}
    </div>
  `).join("");
}

function settingsGroupHtml(settings, group) {
  const fields = GENERATE_SETTING_FIELDS.filter((field) => field.group === group);
  return `
    <details class="generate-settings-group" ${group === "Cụm và đường đi" ? "open" : ""}>
      <summary>${escapeHtml(group)}</summary>
      <div class="generate-field-grid">
        ${fields.map((field) => {
          const value = field.type === "percent" ? Math.round(Number(settings[field.key]) * 100) : settings[field.key];
          const min = field.type === "percent" ? field.min * 100 : field.min;
          const max = field.type === "percent" ? field.max * 100 : field.max;
          const step = field.type === "percent" ? Math.max(1, field.step * 100) : field.step;
          return `
            <label class="generate-field" title="${escapeHtml(field.tip)}">
              <span>${escapeHtml(field.label)}</span>
              <input type="number" data-generate-setting="${escapeHtml(field.key)}" data-setting-type="${field.type}" min="${min}" max="${max}" step="${step}" value="${value}">
            </label>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function renderGenerateControls(container, state) {
  const settings = normalizeGenerateSettings(state.generateSettings);
  const source = analyzeGenerateSource(state);

  container.innerHTML = `
    <section class="control-section">
      <div class="section-heading"><h2>Dữ liệu nguồn</h2><span>Chỉ đọc</span></div>
      <div class="generate-source-grid">
        <div><span>Lớp</span><strong>${source.stats.layers}</strong></div>
        <div><span>Khay</span><strong>${source.stats.trays}</strong></div>
        <div><span>Cần sinh</span><strong>${source.stats.totalRequired}</strong></div>
        <div><span>Ô hợp lệ</span><strong>${source.stats.totalValidSlots}</strong></div>
      </div>
      <div class="generate-source-note">Đường ray, khay, điểm bắt đầu, điểm giao, điểm ưu tiên và đối tượng đặc biệt chỉ được đọc. Muốn sửa nguồn hãy mở tab LevelDes.</div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Phân bổ</h2><span>Có seed</span></div>
      <div class="generate-field-grid">
        <label class="generate-field"><span>Mã ngẫu nhiên</span><input type="number" data-generate-setting="seed" min="0" step="1" value="${settings.seed}"></label>
        <label class="generate-field"><span>Số lần thử lại</span><input type="number" data-generate-setting="maxRetries" min="1" max="500" step="1" value="${settings.maxRetries}"></label>
        <label class="generate-field wide"><span>Chế độ nhiều nhánh</span>
          <select data-generate-setting="multiBranchMode">
            ${Object.entries(MULTI_BRANCH_MODE_LABELS).map(([value, label]) => `<option value="${value}" ${settings.multiBranchMode === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Độ khó</h2><span>Mẫu nhanh</span></div>
      <div class="generate-preset-list">
        ${Object.keys(GENERATE_PRESETS).map((preset) => `<button class="generate-preset ${settings.difficultyPreset === preset ? "active" : ""}" type="button" data-generate-preset="${preset}">${PRESET_LABELS[preset]}</button>`).join("")}
      </div>
      ${["Áp lực đuôi", "Áp lực xả", "Lớp và xuất hiện", "Cụm và đường đi"].map((group) => settingsGroupHtml(settings, group)).join("")}
      <div class="generate-field-grid">
        <label class="generate-field wide"><span>Đường cong tăng đuôi</span>
          <select data-generate-setting="tailLengthGrowthCurve">${Object.entries(TAIL_CURVE_LABELS).map(([value, label]) => `<option value="${value}" ${settings.tailLengthGrowthCurve === value ? "selected" : ""}>${label}</option>`).join("")}</select>
        </label>
      </div>
    </section>
  `;
}

function renderGenerateResults(container, state, result = null) {
  const source = result?.source ?? analyzeGenerateSource(state);
  const meta = result?.meta ?? state.generationMeta ?? {};
  const issues = result?.issues?.length ? result.issues : source.issues;
  const status = result?.ok ? "Sẵn sàng xem trước" : statusOf(state);
  const totalGenerated = result?.generatedItems?.length ?? state.generatedItems?.length ?? 0;
  container.innerHTML = `
    <header class="panel-header">
      <div class="panel-title"><span class="panel-accent green"></span><div><h2>Kết quả sinh</h2><p>${escapeHtml(status)}</p></div></div>
      <span class="generate-status-badge ${statusClass(status)}">${escapeHtml(status)}</span>
    </header>
    <div class="generate-result-scroll">
      <section class="generate-result-card">
        <header><h3>Kết quả vật phẩm</h3><span>${totalGenerated}/${source.stats.totalRequired}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Yêu cầu</span><strong>${source.stats.totalRequired}</strong></div>
          <div><span>Đã sinh</span><strong>${totalGenerated}</strong></div>
          <div><span>Còn thiếu</span><strong>${Math.max(0, source.stats.totalRequired - totalGenerated)}</strong></div>
          <div><span>Nhánh dùng</span><strong>${meta.branchCount ?? "-"}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Chỉ số độ khó</h3><span>${meta.generatorVersion ?? "nháp"}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Số cụm</span><strong>${meta.clusterCount ?? "-"}</strong></div>
          <div><span>Tỷ lệ gom</span><strong>${Number.isFinite(meta.actualClusterRatio) ? formatPercent(meta.actualClusterRatio) : "-"}</strong></div>
          <div><span>Đuôi TB</span><strong>${meta.avgTailLength ?? "-"}</strong></div>
          <div><span>Đuôi đỉnh</span><strong>${meta.peakTailLength ?? "-"}</strong></div>
          <div><span>Độ trễ xả TB</span><strong>${meta.avgReleaseDelay ?? "-"}</strong></div>
          <div><span>Tồn kho tối đa</span><strong>${meta.maxUnreleasedItems ?? "-"}</strong></div>
          <div><span>Mật độ vật phẩm</span><strong>${Number.isFinite(meta.itemDensity) ? formatPercent(meta.itemDensity) : "-"}</strong></div>
          <div><span>Bẫy xuất hiện</span><strong>${meta.spawnTrapCount ?? "-"}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Cảnh báo & lỗi</h3><span>${issues.length}</span></header>
        <div class="generate-issue-list">${issueRows(issues)}</div>
      </section>
    </div>
  `;
}


// ---- js/ui/toolbar.js ----

function renderToolbar(editor, elements) {
  if (!ERASE_MODE_LABELS[editor.data.eraseMode]) editor.data.eraseMode = "smart";
  document.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === editor.data.tool));
  const eraseLabel = ERASE_MODE_LABELS[editor.data.eraseMode ?? "smart"];
  document.querySelector("#eraseToolBtn .tool-label").textContent = `Xóa: ${eraseLabel}`;
  document.querySelectorAll("[data-erase-mode]").forEach((button) => {
    const active = button.dataset.eraseMode === (editor.data.eraseMode ?? "smart");
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  elements.activeToolBadge.textContent = editor.data.tool === "erase" ? `Xóa: ${eraseLabel}` : TOOL_LABELS[editor.data.tool];
  elements.undoBtn.disabled = !editor.history.canUndo;
  elements.redoBtn.disabled = !editor.history.canRedo;
}

function activateTab(tab, editorData, elements) {
  editorData.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  const isLevel = tab === "level";
  const isGenerate = tab === "generate";
  const isPlayable = tab === "playable";
  const isJson = tab === "json";
  elements.levelWorkspace.classList.toggle("hidden", isPlayable);
  elements.playableWorkspace.classList.toggle("hidden", !isPlayable);
  document.querySelectorAll(".level-rail-content").forEach((element) => element.classList.toggle("hidden", !isLevel));
  elements.jsonFolderCard.classList.toggle("hidden", !isJson);
  elements.generateResultCard?.classList.toggle("hidden", !isGenerate);
  elements.levelRightRail.classList.toggle("json-mode", isJson || isGenerate);
  elements.canvasArea.classList.toggle("read-only", isJson || isGenerate);
  elements.gridBoard.setAttribute("aria-readonly", String(isJson || isGenerate));
  elements.levelControls.classList.toggle("hidden", !isLevel);
  elements.generateControls?.classList.toggle("hidden", !isGenerate);
  elements.playableControls.classList.toggle("hidden", !isPlayable);
  elements.jsonControls.classList.toggle("hidden", !isJson);
  elements.levelActions.classList.toggle("hidden", !isLevel);
  elements.generateActions?.classList.toggle("hidden", !isGenerate);
  elements.jsonActions.classList.toggle("hidden", !isJson);
  elements.levelLayerPicker.classList.toggle("hidden", isPlayable);
  elements.levelLayerPicker.classList.toggle("read-only", isJson || isGenerate);
  elements.levelLayerPicker.querySelectorAll("button").forEach((button) => button.classList.toggle("hidden", isJson || isGenerate));
  if (isJson) elements.activeToolBadge.textContent = "Chỉ xem";
  else if (isGenerate) elements.activeToolBadge.textContent = "Xem trước sinh";
  else if (isLevel) {
    const eraseMode = ERASE_MODE_LABELS[editorData.eraseMode] ? editorData.eraseMode : "smart";
    elements.activeToolBadge.textContent = editorData.tool === "erase"
    ? `Xóa: ${ERASE_MODE_LABELS[eraseMode]}`
    : TOOL_LABELS[editorData.tool];
  }
  elements.placeholderView.classList.add("hidden");
  elements.topbarEyebrow.textContent = isPlayable ? "Playable / Snapshot màn chơi" : isGenerate ? "Sinh màn / Tự động sinh vật phẩm" : isLevel ? "Level Design / Layer fruit đang chọn" : "Data JSON / Map editor hiện tại";
}


// ---- js/ui/inspector-panel.js ----








function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function activeLayerNumber(editorData) {
  const layer = editorData.layers.find((candidate) => candidate.id === editorData.activeLayerId) ?? editorData.layers[0];
  return Number.isInteger(layer?.layer) ? layer.layer : Math.max(0, editorData.layers.indexOf(layer));
}

function getSelectedCellIndex(editorData) {
  if (!editorData.selectedCell) return null;
  return positionToIndex(editorData.selectedCell.x, editorData.selectedCell.y, editorData.grid.columns);
}

function segmentedButton(value, activeValue, label, dataName) {
  const active = Number(value) === Number(activeValue);
  return `<button class="segmented-option${active ? " active" : ""}" type="button" ${dataName}="${value}" aria-pressed="${active}">${escapeHtml(label)}${active ? " ✓" : ""}</button>`;
}

function bridgeCard(bridge) {
  const axis = normalizeBridgeAxis(bridge.axis);
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">=</span><h3>Bridge</h3></header>
    <div class="inspector-kv wide"><span>Visual</span><strong>${escapeHtml(bridgeAxisLabel(axis === BRIDGE_AXES.VERTICAL ? BRIDGE_AXES.HORIZONTAL : axis))} · 3x1</strong></div>
    <button class="inspector-link danger" type="button" data-inspector-delete="bridge">Xóa Bridge</button>
  </article>`;
}

function gateCard(gate) {
  const direction = normalizeGateDirection(gate.direction);
  const directionButtons = [
    [GATE_DIRECTIONS.UP, "↑", "Up"],
    [GATE_DIRECTIONS.LEFT, "←", "Left"],
    [GATE_DIRECTIONS.RIGHT, "→", "Right"],
    [GATE_DIRECTIONS.DOWN, "↓", "Down"]
  ].map(([value, icon, label]) => {
    const active = Number(value) === direction;
    return `<button class="direction-option${active ? " active" : ""}" type="button" data-inspector-gate-direction="${value}" aria-label="${label}" aria-pressed="${active}"><span>${icon}</span><small>${label}</small></button>`;
  }).join("");

  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">›</span><h3>Gate</h3></header>
    <div class="inspector-field">
      <span>Hướng cổng</span>
      <div class="direction-control">${directionButtons}</div>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-delete="gate">Xóa Gate</button>
  </article>`;
}

function countBarrierCard(barrier, selectedIndex) {
  const count = normalizeCountBarrierCount(barrier.count);
  const isStart = barrier.startIndex === selectedIndex;
  const isEnd = barrier.endIndex === selectedIndex;
  const active = barrier.barrierId === Number(barrier.activeBarrierId);
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">#</span><h3>Count Barrier ${barrier.barrierId}${active ? " · Active" : ""}</h3></header>
    <div class="inspector-field">
      <span>Countdown</span>
      <input class="property-select" type="number" min="1" step="1" value="${count}" data-inspector-count-barrier-count="${barrier.barrierId}" aria-label="Count Barrier countdown">
    </div>
    <div class="inspector-kv"><span>Start</span><strong>${barrier.startIndex}${isStart ? " · ô đang chọn" : ""}</strong></div>
    <div class="inspector-kv"><span>End</span><strong>${barrier.endIndex}${isEnd ? " · ô đang chọn" : ""}</strong></div>
    <div class="inspector-kv"><span>Cells</span><strong>${barrier.index.length}</strong></div>
    <div class="quick-actions">
      <button class="btn" type="button" data-inspector-count-barrier-start="${barrier.barrierId}"${isStart ? " disabled" : ""}>Set Start</button>
      <button class="btn" type="button" data-inspector-count-barrier-end="${barrier.barrierId}"${isEnd ? " disabled" : ""}>Set End</button>
      <button class="btn" type="button" data-inspector-count-barrier-new>New Barrier</button>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-count-barrier-remove-cell="${barrier.barrierId}">Xóa Cell khỏi Barrier</button>
    <button class="inspector-link danger" type="button" data-inspector-delete="count-barrier">Xóa Barrier</button>
  </article>`;
}

function directionSelect(value, dataAttrs) {
  const direction = normalizeTunnelDirection(value);
  return `<select class="property-select" ${dataAttrs} aria-label="Tunnel direction">
    ${[
      [0, "Up"],
      [1, "Down"],
      [2, "Right"],
      [3, "Left"]
    ].map(([optionValue, label]) => `<option value="${optionValue}"${direction === optionValue ? " selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function oneWayDirectionSelect(value, dataAttrs) {
  const direction = normalizeOneWayDirection(value);
  return `<select class="property-select" ${dataAttrs} aria-label="One Way direction">
    ${[
      [0, "Up"],
      [1, "Down"],
      [2, "Right"],
      [3, "Left"]
    ].map(([optionValue, label]) => `<option value="${optionValue}"${direction === optionValue ? " selected" : ""}>${label}</option>`).join("")}
  </select>`;
}

function tunnelCard(tunnel, selectedIndex, tunnels, cell) {
  const activeOptions = tunnels.map((entry) => `<option value="${entry.tunnelId}"${entry.tunnelId === tunnel.tunnelId ? " selected" : ""}>Tunnel #${entry.tunnelId}</option>`).join("");
  const selectedIsPath = Boolean(cell.path);
  const entries = tunnel.entryPoints.map((point, entryIndex) => {
    const label = entryIndex === 0 ? "A" : "B";
    const selected = point.index === selectedIndex;
    const direction = tunnelDirectionLabel(point.direction);
    return `<div class="inspector-kv wide"><span>Entry Point ${label}</span><strong>Index ${point.index} · ${direction}${selected ? " · ô đang chọn" : ""}</strong></div>
      <div class="inspector-field">
        <span>Direction ${label}</span>
        ${directionSelect(point.direction, `data-inspector-tunnel-direction="${tunnel.tunnelId}" data-tunnel-entry="${entryIndex}"`)}
      </div>`;
  }).join("");
  return `<article class="inspector-card tunnel-inspector-card" style="--tunnel-color:${tunnelColor(tunnel.tunnelId)}">
    <header><span class="inspector-card-icon tunnel-card-icon">→</span><h3>Tunnel #${tunnel.tunnelId}</h3></header>
    <div class="inspector-field">
      <span>Active Tunnel</span>
      <select class="property-select" data-inspector-active-tunnel aria-label="Active Tunnel">${activeOptions}</select>
    </div>
    ${entries}
    <div class="quick-actions tunnel-actions">
      <button class="btn" type="button" data-inspector-tunnel-focus="${tunnel.tunnelId}" data-tunnel-entry="0">Focus A</button>
      <button class="btn" type="button" data-inspector-tunnel-focus="${tunnel.tunnelId}" data-tunnel-entry="1">Focus B</button>
      <button class="btn" type="button" data-inspector-tunnel-move="${tunnel.tunnelId}" data-tunnel-entry="0"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set A Here</button>
      <button class="btn" type="button" data-inspector-tunnel-move="${tunnel.tunnelId}" data-tunnel-entry="1"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set B Here</button>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-delete="tunnel">Xóa Tunnel</button>
  </article>`;
}

function tunnelDraftStatus(step) {
  return {
    "direction-a": "Point A selected — Choose direction",
    "point-b": "Point A complete — Select Tunnel Point B",
    "direction-b": "Point B selected — Choose direction"
  }[step] ?? "Select Tunnel Point A";
}

function tunnelDraftCard(draft) {
  const pointA = draft.entryPoints[0];
  const pointB = draft.entryPoints[1];
  const activeDirectionStep = draft.step === "direction-a" || draft.step === "direction-b";
  const directionButtons = [
    [GATE_DIRECTIONS.UP, "↑", "Up"],
    [GATE_DIRECTIONS.DOWN, "↓", "Down"],
    [GATE_DIRECTIONS.RIGHT, "→", "Right"],
    [GATE_DIRECTIONS.LEFT, "←", "Left"]
  ].map(([value, icon, label]) => `<button class="direction-option" type="button" data-inspector-tunnel-draft-direction="${value}" aria-label="${label}"><span>${icon}</span><small>${label}</small></button>`).join("");
  return `<article class="inspector-card tunnel-inspector-card" style="--tunnel-color:${tunnelColor(draft.tunnelId)}">
    <header><span class="inspector-card-icon tunnel-card-icon">⏭</span><h3>Tunnel #${draft.tunnelId} Draft</h3></header>
    <div class="inspector-note">${escapeHtml(tunnelDraftStatus(draft.step))}</div>
    <div class="inspector-kv wide"><span>Entry Point A</span><strong>Index ${pointA.index}${Number.isInteger(pointA.direction) ? ` · ${tunnelDirectionLabel(pointA.direction)}` : " · pending"}</strong></div>
    ${pointB ? `<div class="inspector-kv wide"><span>Entry Point B</span><strong>Index ${pointB.index}${Number.isInteger(pointB.direction) ? ` · ${tunnelDirectionLabel(pointB.direction)}` : " · pending"}</strong></div>` : ""}
    ${activeDirectionStep ? `<div class="inspector-field"><span>Direction ${draft.step === "direction-a" ? "A" : "B"}</span><div class="direction-control tunnel-draft-direction-control">${directionButtons}</div></div>` : ""}
    <button class="inspector-link danger" type="button" data-inspector-tunnel-draft-cancel>Hủy Tunnel Draft</button>
  </article>`;
}

function oneWayCard(oneWay, selectedIndex, oneWays, cell) {
  const activeOptions = oneWays.map((entry) => `<option value="${entry.oneWayId}"${entry.oneWayId === oneWay.oneWayId ? " selected" : ""}>One Way #${entry.oneWayId}</option>`).join("");
  const selectedIsPath = Boolean(cell.path);
  const direction = normalizeOneWayDirection(oneWay.entryPoints[0]?.direction);
  const entries = oneWay.entryPoints.map((point, entryIndex) => {
    const label = entryIndex === 0 ? "A" : "B";
    const selected = point.index === selectedIndex;
    return `<div class="inspector-kv wide"><span>Entry Point ${label}</span><strong>Index ${point.index} · ${oneWayDirectionLabel(direction)}${selected ? " · ô đang chọn" : ""}</strong></div>`;
  }).join("");
  return `<article class="inspector-card one-way-inspector-card" style="--one-way-color:${oneWayColor(oneWay.oneWayId)}">
    <header><span class="inspector-card-icon one-way-card-icon">▲</span><h3>One Way #${oneWay.oneWayId}</h3></header>
    <div class="inspector-field">
      <span>Active One Way</span>
      <select class="property-select" data-inspector-active-one-way aria-label="Active One Way">${activeOptions}</select>
    </div>
    <div class="inspector-field">
      <span>Direction</span>
      ${oneWayDirectionSelect(direction, `data-inspector-one-way-direction="${oneWay.oneWayId}"`)}
    </div>
    ${entries}
    <div class="quick-actions one-way-actions">
      <button class="btn" type="button" data-inspector-one-way-focus="${oneWay.oneWayId}" data-one-way-entry="0">Focus A</button>
      <button class="btn" type="button" data-inspector-one-way-focus="${oneWay.oneWayId}" data-one-way-entry="1">Focus B</button>
      <button class="btn" type="button" data-inspector-one-way-move="${oneWay.oneWayId}" data-one-way-entry="0"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set A Here</button>
      <button class="btn" type="button" data-inspector-one-way-move="${oneWay.oneWayId}" data-one-way-entry="1"${!selectedIsPath ? ' disabled title="EntryPoint phải nằm trên Path"' : ""}>Set B Here</button>
    </div>
    <button class="inspector-link danger" type="button" data-inspector-delete="one-way">Xóa One Way</button>
  </article>`;
}

function fruitCard(cell, isMystery) {
  const fruit = cell.layerItem;
  const title = isMystery ? "Mystery Fruit" : "Fruit";
  const status = isMystery ? "ON" : "OFF";
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">${escapeHtml(fruit.icon ?? "?")}</span><h3>${title}</h3></header>
    <div class="inspector-field">
      <span>Mystery</span>
      <button class="toggle-control${isMystery ? " active" : ""}" type="button" data-inspector-mystery-toggle aria-pressed="${isMystery}">
        <span>${status}</span>
      </button>
    </div>
    <div class="inspector-note">${escapeHtml(fruit.label ?? "Fruit")} ${isMystery ? "đang ẩn bằng badge ?" : "đang hiển thị bình thường"}</div>
    <button class="inspector-link danger" type="button" data-inspector-delete="${isMystery ? "mystery-fruit" : "item"}">${isMystery ? "Tắt Mystery" : "Xóa Fruit"}</button>
  </article>`;
}

function sharedItemCard(cell, editorData, x, y) {
  if (!cell.sharedItem) return "";
  if (["tray", "truck"].includes(cell.sharedItem.kind)) {
    const context = createTrayContextAt(editorData, x, y);
    return context ? createTrayInspectorCard(context, editorData.grid).outerHTML : "";
  }
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">${escapeHtml(cell.sharedItem.icon ?? "□")}</span><h3>${escapeHtml(cell.sharedItem.label ?? "Item")}</h3></header>
    <button class="inspector-link danger" type="button" data-inspector-delete="item">Xóa Item</button>
  </article>`;
}

function emptyCellActions(cell, hasTopLevelElement = false) {
  if (cell.element || cell.layerItem || cell.sharedItem || hasTopLevelElement) return "";
  const gateDisabled = !cell.path;
  const barrierDisabled = !cell.path;
  const tunnelDisabled = !cell.path;
  const oneWayDisabled = !cell.path;
  return `<article class="inspector-card">
    <header><span class="inspector-card-icon">＋</span><h3>Thêm Element</h3></header>
    <div class="quick-actions">
      <button class="btn" type="button" data-inspector-add="bridge">Bridge</button>
      <button class="btn" type="button" data-inspector-add="gate"${gateDisabled ? ' disabled title="Gate chỉ có thể đặt trên Path"' : ""}>Gate</button>
      <button class="btn" type="button" data-inspector-add="count-barrier"${barrierDisabled ? ' disabled title="Barrier chỉ có thể đặt trên Path"' : ""}>Barrier</button>
      <button class="btn" type="button" data-inspector-add="tunnel"${tunnelDisabled ? ' disabled title="Tunnel chỉ có thể đặt trên Path"' : ""}>Tunnel</button>
      <button class="btn" type="button" data-inspector-add="one-way"${oneWayDisabled ? ' disabled title="One Way chỉ có thể đặt trên Path"' : ""}>One Way</button>
    </div>
  </article>`;
}

function cellTypeLabel(editorData, cell, x, y) {
  if (cell.path) return "Path";
  if (isGrassAt(editorData, x, y)) return "Grass";
  return "Terrain trống";
}

function renderInspector(container, editorData) {
  if (!editorData.selectedCell) {
    container.innerHTML = "";
    return;
  }
  const { x, y } = editorData.selectedCell;
  const index = getSelectedCellIndex(editorData);
  const layerNumber = activeLayerNumber(editorData);
  const cell = getMergedCell(editorData, x, y);
  const bridge = isBridgeElement(cell.element) ? cell.element : null;
  const gate = isGateElement(cell.element) ? cell.element : null;
  const countBarrier = findCountBarrierAtIndex(editorData, index);
  if (countBarrier) countBarrier.activeBarrierId = editorData.activeBarrierId;
  const tunnels = editorData.tunnelElement ?? [];
  const tunnelAtCell = findTunnelEntryAtIndex(editorData, index);
  const tunnelDraftAtCell = findTunnelDraftEntryAtIndex(editorData, index);
  const tunnel = tunnelAtCell?.tunnel ?? null;
  const oneWays = editorData.oneWayElement ?? [];
  const oneWayAtCell = findOneWayEntryAtIndex(editorData, index);
  const oneWay = oneWayAtCell?.oneWay ?? null;
  const mystery = cell.layerItem?.kind === "fruit" && isMysteryFruitAt(editorData, layerNumber, index);
  const cards = [
    bridge ? bridgeCard(bridge) : "",
    gate ? gateCard(gate) : "",
    tunnel ? tunnelCard(tunnel, index, tunnels, cell) : "",
    oneWay ? oneWayCard(oneWay, index, oneWays, cell) : "",
    countBarrier ? countBarrierCard(countBarrier, index) : "",
    cell.layerItem?.kind === "fruit" ? fruitCard(cell, mystery) : "",
    sharedItemCard(cell, editorData, x, y),
    emptyCellActions(cell, Boolean(countBarrier || tunnelAtCell || tunnelDraftAtCell || oneWayAtCell))
  ].filter(Boolean).join("");
  const elementSummary = [
    bridge ? `Bridge · ${bridgeAxisLabel(bridge.axis)}` : "",
    gate ? `Gate · ${gateDirectionLabel(gate.direction)}` : "",
    tunnelDraftAtCell ? `Tunnel Draft ${tunnelDraftAtCell.draft.tunnelId}` : "",
    tunnelAtCell ? `Tunnel ${tunnelAtCell.tunnel.tunnelId}` : "",
    oneWayAtCell ? `One Way ${oneWayAtCell.oneWay.oneWayId}` : "",
    countBarrier ? `Count Barrier ${countBarrier.barrierId}` : "",
    mystery ? "Mystery Fruit" : cell.layerItem?.kind === "fruit" ? cell.layerItem.label : "",
    cell.sharedItem?.label ?? ""
  ].filter(Boolean).join(", ") || "Không có";

  container.innerHTML = `<div class="context-inspector">
    <section class="cell-summary">
      <div class="inspector-kv"><span>Type</span><strong>${cellTypeLabel(editorData, cell, x, y)}</strong></div>
      <div class="inspector-kv"><span>X</span><strong>${x}</strong></div>
      <div class="inspector-kv"><span>Y</span><strong>${y}</strong></div>
      <div class="inspector-kv wide"><span>Element</span><strong>${escapeHtml(elementSummary)}</strong></div>
      ${isPriorityPointAt(editorData, x, y) ? '<div class="cell-badge">PriorityPoint</div>' : ""}
    </section>
    ${cards || '<div class="empty-state">Ô này không có element đặc biệt.</div>'}
  </div>`;
}


// ---- js/ui/level-settings.js ----





const RESIZE_EDGES = new Set(["top", "bottom", "left", "right"]);

function isMapSizeWithinBounds(grid) {
  return Number.isInteger(grid?.columns) && grid.columns >= 1 && Number.isInteger(grid?.rows) && grid.rows >= 1;
}

function hasCellData(cell) {
  return Boolean(cell?.path || cell?.item || cell?.element);
}

function isEmptySharedCell(cell) {
  return !cell?.path && !cell?.item && !cell?.element;
}

function isPositionOnEdge(position, grid, edge) {
  if (edge === "top") return position.y === 0;
  if (edge === "bottom") return position.y === grid.rows - 1;
  if (edge === "left") return position.x === 0;
  if (edge === "right") return position.x === grid.columns - 1;
  return false;
}

function isIndexOnEdge(index, grid, edge) {
  return isPositionOnEdge(indexToPosition(index, grid.columns), grid, edge);
}

function hasTrayVisualInArea(state, containsPosition) {
  return Object.entries(state.sharedCells ?? {}).some(([key, cell]) => {
    if (!["tray", "truck"].includes(cell?.item?.kind)) return false;
    return getTrayVisualCells(cell.item, parseCellKey(key)).some(containsPosition);
  });
}

function hasIndexedDataInArea(state, containsPosition) {
  const grid = state.grid;
  const containsIndex = (index) => containsPosition(indexToPosition(index, grid.columns));
  if (normalizeMysteryFruitElement(state.mysteryFruitElement)
    .some((entry) => entry.index.some(containsIndex))) return true;
  if (normalizeCountBarrierElement(state.countBarrierElement)
    .some((entry) => entry.index.some(containsIndex) || containsIndex(entry.startIndex) || containsIndex(entry.endIndex))) return true;
  if ([...normalizeTunnelElement(state.tunnelElement), ...(normalizeTunnelDraft(state.tunnelDraft) ? [normalizeTunnelDraft(state.tunnelDraft)] : [])]
    .some((entry) => entry.entryPoints.some((point) => containsIndex(point.index)))) return true;
  return [...normalizeOneWayElement(state.oneWayElement), ...(normalizeOneWayDraft(state.oneWayDraft) ? [normalizeOneWayDraft(state.oneWayDraft)] : [])]
    .some((entry) => entry.entryPoints.some((point) => containsIndex(point.index)));
}

function hasPositionDataInArea(state, containsPosition) {
  const sharedHasData = Object.entries(state.sharedCells ?? {}).some(([key, cell]) =>
    containsPosition(parseCellKey(key)) && hasCellData(cell)
  );
  if (sharedHasData) return true;
  const layerHasData = (state.layers ?? []).some((layer) => Object.entries(layer.cells ?? {}).some(([key, cell]) =>
    containsPosition(parseCellKey(key)) && hasCellData(cell)
  ));
  if (layerHasData) return true;
  if (Object.keys(state.priorityPoints ?? {}).some((key) => containsPosition(parseCellKey(key)))) return true;
  return hasTrayVisualInArea(state, containsPosition) || hasIndexedDataInArea(state, containsPosition);
}

function hasDataOnResizeEdge(state, edge) {
  if (!RESIZE_EDGES.has(edge) || !isMapSizeWithinBounds(state?.grid)) return false;
  ensureTerrainState(state);
  return hasPositionDataInArea(state, (position) => isPositionOnEdge(position, state.grid, edge));
}

function hasDataOutsideGrid(state, nextGrid) {
  if (!isMapSizeWithinBounds(state?.grid) || !isMapSizeWithinBounds(nextGrid)) return false;
  ensureTerrainState(state);
  return hasPositionDataInArea(state, (position) => !isInsideGrid(nextGrid, position.x, position.y));
}

function createEdgeOperation(grid, edge, delta) {
  if (!RESIZE_EDGES.has(edge)) return { changed: false, reason: "edge" };
  if (![1, -1].includes(delta)) return { changed: false, reason: "delta" };

  const nextGrid = { ...grid };
  if (edge === "top" || edge === "bottom") nextGrid.rows += delta;
  if (edge === "left" || edge === "right") nextGrid.columns += delta;
  if (!isMapSizeWithinBounds(nextGrid)) return { changed: false, reason: "limit" };

  const mapPosition = ({ x, y }) => {
    if (delta < 0 && isPositionOnEdge({ x, y }, grid, edge)) return null;
    if (edge === "top") return { x, y: y + delta };
    if (edge === "left") return { x: x + delta, y };
    return { x, y };
  };
  const isCreatedPosition = ({ x, y }) =>
    delta > 0 && (
      (edge === "top" && y === 0) ||
      (edge === "bottom" && y === nextGrid.rows - 1) ||
      (edge === "left" && x === 0) ||
      (edge === "right" && x === nextGrid.columns - 1)
    );

  return { changed: true, previousGrid: { ...grid }, nextGrid, mapPosition, isCreatedPosition };
}

function createDimensionOperation(grid, dimension, nextValue) {
  if (!["columns", "rows"].includes(dimension)) return { changed: false, reason: "dimension" };
  const value = Math.floor(Number(nextValue));
  if (!Number.isInteger(value) || value < 1) return { changed: false, reason: "limit" };
  if (value === grid[dimension]) return { changed: false, reason: null };

  const nextGrid = { ...grid, [dimension]: value };
  const mapPosition = ({ x, y }) => isInsideGrid(nextGrid, x, y) ? { x, y } : null;
  const isCreatedPosition = ({ x, y }) =>
    (dimension === "columns" && value > grid.columns && x >= grid.columns) ||
    (dimension === "rows" && value > grid.rows && y >= grid.rows);

  return { changed: true, previousGrid: { ...grid }, nextGrid, mapPosition, isCreatedPosition };
}

function remapCellMap(cells, operation, remapCell = (cell) => cell) {
  const nextCells = {};
  Object.entries(cells ?? {}).forEach(([key, cell]) => {
    const oldPosition = parseCellKey(key);
    const nextPosition = operation.mapPosition(oldPosition);
    if (!nextPosition || !isInsideGrid(operation.nextGrid, nextPosition.x, nextPosition.y)) return;
    const nextCell = remapCell(structuredClone(cell), oldPosition, nextPosition);
    if (!nextCell) return;
    nextCells[cellKey(nextPosition.x, nextPosition.y)] = nextCell;
  });
  return nextCells;
}

function remapIndex(index, operation) {
  if (!Number.isInteger(index)) return null;
  const oldPosition = indexToPosition(index, operation.previousGrid.columns);
  const nextPosition = operation.mapPosition(oldPosition);
  if (!nextPosition || !isInsideGrid(operation.nextGrid, nextPosition.x, nextPosition.y)) return null;
  return positionToIndex(nextPosition.x, nextPosition.y, operation.nextGrid.columns);
}

function remapMysteryFruit(entries, operation) {
  return normalizeMysteryFruitElement(entries).flatMap((entry) => {
    const indexes = [...new Set(entry.index.map((index) => remapIndex(index, operation)).filter(Number.isInteger))]
      .sort((a, b) => a - b);
    return indexes.length > 0 ? [{ ...entry, index: indexes }] : [];
  });
}

function remapCountBarriers(entries, operation) {
  return normalizeCountBarrierElement(entries).flatMap((entry) => {
    const indexes = [...new Set(entry.index.map((index) => remapIndex(index, operation)).filter(Number.isInteger))]
      .sort((a, b) => a - b);
    if (indexes.length < 2) return [];
    const startIndex = remapIndex(entry.startIndex, operation);
    const endIndex = remapIndex(entry.endIndex, operation);
    return [{
      ...entry,
      startIndex: indexes.includes(startIndex) ? startIndex : indexes[0],
      endIndex: indexes.includes(endIndex) ? endIndex : indexes[indexes.length - 1],
      index: indexes
    }];
  });
}

function remapPairedEntryPoints(entries, operation, normalizer) {
  return normalizer(entries).flatMap((entry) => {
    const entryPoints = entry.entryPoints.flatMap((point) => {
      const index = remapIndex(point.index, operation);
      return Number.isInteger(index) ? [{ ...point, index }] : [];
    });
    return entryPoints.length === 2 ? [{ ...entry, entryPoints }] : [];
  });
}

function remapDraft(draft, operation, normalizer) {
  const normalized = normalizer(draft);
  if (!normalized) return null;
  const entryPoints = normalized.entryPoints.flatMap((point) => {
    const index = remapIndex(point.index, operation);
    return Number.isInteger(index) ? [{ ...point, index }] : [];
  });
  if (entryPoints.length !== normalized.entryPoints.length) return null;
  return normalizer({ ...normalized, entryPoints });
}

function addCreatedGrassCells(state, operation) {
  for (let y = 0; y < operation.nextGrid.rows; y += 1) {
    for (let x = 0; x < operation.nextGrid.columns; x += 1) {
      if (!operation.isCreatedPosition({ x, y })) continue;
      if (state.sharedCells?.[cellKey(x, y)]?.path) continue;
      state.grassCells[cellKey(x, y)] = true;
    }
  }
}

function cleanupResizeSelections(state) {
  const activeTray = state.activeTrayCell ? state.sharedCells?.[cellKey(state.activeTrayCell.x, state.activeTrayCell.y)]?.item : null;
  if (state.activeTrayCell && !["tray", "truck"].includes(activeTray?.kind)) state.activeTrayCell = null;
  const barrierIds = new Set((state.countBarrierElement ?? []).map((entry) => entry.barrierId));
  if (Number.isInteger(state.activeBarrierId) && !barrierIds.has(state.activeBarrierId)) state.activeBarrierId = null;
  if (Number.isInteger(state.drawingCountBarrierId) && !barrierIds.has(state.drawingCountBarrierId)) {
    state.drawingCountBarrierId = null;
  }
  const tunnelIds = new Set((state.tunnelElement ?? []).map((entry) => entry.tunnelId));
  if (Number.isInteger(state.activeTunnelId) && !tunnelIds.has(state.activeTunnelId)) state.activeTunnelId = null;
  const oneWayIds = new Set((state.oneWayElement ?? []).map((entry) => entry.oneWayId));
  if (Number.isInteger(state.activeOneWayId) && !oneWayIds.has(state.activeOneWayId)) state.activeOneWayId = null;
}

function applyResizeOperation(state, operation) {
  ensureTerrainState(state);

  state.sharedCells = remapCellMap(state.sharedCells, operation, (cell, oldPosition) => {
    if (["tray", "truck"].includes(cell.item?.kind)) {
      const trayPosition = operation.mapPosition(getTrayVisualPosition(cell.item, oldPosition));
      const deliverPoint = trayPosition ? deliverPointFromTrayPosition(trayPosition) : null;
      if (!trayPosition || !deliverPoint || !isInsideGrid(operation.nextGrid, trayPosition.x, trayPosition.y) || !isInsideGrid(operation.nextGrid, deliverPoint.x, deliverPoint.y)) cell.item = null;
      else if (!isTrayVisualInsideGrid(operation.nextGrid, { ...cell.item, trayPosition }, deliverPoint)) cell.item = null;
      else cell.item.trayPosition = trayPosition;
    }
    return isEmptySharedCell(cell) ? null : cell;
  });
  state.layers = (state.layers ?? []).map((layer) => ({
    ...layer,
    cells: remapCellMap(layer.cells, operation, (cell) => hasCellData(cell) ? cell : null)
  }));
  state.grassCells = remapCellMap(state.grassCells, operation, () => true);
  state.priorityPoints = remapCellMap(state.priorityPoints, operation, (source) => source);
  state.mysteryFruitElement = remapMysteryFruit(state.mysteryFruitElement, operation);
  state.countBarrierElement = remapCountBarriers(state.countBarrierElement, operation);
  state.tunnelElement = remapPairedEntryPoints(state.tunnelElement, operation, normalizeTunnelElement);
  state.tunnelDraft = remapDraft(state.tunnelDraft, operation, normalizeTunnelDraft);
  state.oneWayElement = remapPairedEntryPoints(state.oneWayElement, operation, normalizeOneWayElement);
  state.oneWayDraft = remapDraft(state.oneWayDraft, operation, normalizeOneWayDraft);
  state.selectedCell = state.selectedCell ? operation.mapPosition(state.selectedCell) : null;
  state.activeTrayCell = state.activeTrayCell ? operation.mapPosition(state.activeTrayCell) : null;
  state.grid = operation.nextGrid;
  addCreatedGrassCells(state, operation);
  cleanupResizeSelections(state);
  ensureTerrainState(state);
  return { changed: true, reason: null };
}

function resizeMapEdge(state, edge, delta, { allowRemove = true } = {}) {
  const operation = createEdgeOperation(state.grid, edge, Number(delta));
  if (!operation.changed) return operation;
  if (Number(delta) < 0 && !allowRemove && hasDataOnResizeEdge(state, edge)) {
    return { changed: false, reason: "occupied" };
  }
  return applyResizeOperation(state, operation);
}

function changeMapDimension(state, dimension, nextValue, { allowRemove = false } = {}) {
  const operation = createDimensionOperation(state.grid, dimension, nextValue);
  if (!operation.changed) return operation;
  if (state.grid[dimension] > operation.nextGrid[dimension] && !allowRemove && hasDataOutsideGrid(state, operation.nextGrid)) {
    return { changed: false, reason: "occupied" };
  }
  return applyResizeOperation(state, operation);
}


// ---- js/gameplay/snake-movement.js ----

function nextPosition(position, direction) {
  const vector = DIRECTIONS[direction];
  if (!vector) throw new Error(`Hướng không hợp lệ: ${direction}`);
  return { x: position.x + vector.x, y: position.y + vector.y };
}

function moveSnake(snake, direction) {
  const head = nextPosition(snake.body[0], direction);
  return { ...snake, direction, body: [head, ...snake.body.slice(0, -1)] };
}

function growSnake(snake, position) {
  return { ...snake, body: [...snake.body, structuredClone(position)] };
}


// ---- js/gameplay/collision-system.js ----



function gateBlocks(element, direction) {
  return isGateElement(element) && gateDirectionFromMovement(direction) !== normalizeGateDirection(element.direction);
}

function detectCollision({ grid, layer, snake }, nextHead, direction = snake.direction, { ignoreSelfCollision = false } = {}) {
  if (!isInsideGrid(grid, nextHead.x, nextHead.y)) return { type: "boundary" };
  const cell = layer.cells[cellKey(nextHead.x, nextHead.y)];
  if (!cell?.path) return { type: "off-path" };
  const head = snake.body[0];
  const headCell = layer.cells[cellKey(head.x, head.y)];
  if (gateBlocks(headCell?.element, direction) || gateBlocks(cell.element, direction)) return { type: "gate", element: cell.element ?? headCell?.element };
  if (!ignoreSelfCollision
    && snake.body.some((part) => !part.hiddenInTunnel && part.x === nextHead.x && part.y === nextHead.y)
    && !bridgeAllowsDifferentAxisOverlap(layer, snake, nextHead, direction)) return { type: "self" };
  if (cell.item?.kind === "obstacle") return { type: "obstacle", item: cell.item };
  return null;
}


// ---- js/gameplay/delivery-system.js ----
function collectFruit(inventory, fruitType) {
  return { ...inventory, [fruitType]: (inventory[fruitType] ?? 0) + 1 };
}

function deliverToTruck(inventory, truck) {
  const available = inventory[truck.fruitType] ?? 0;
  const delivered = Math.min(available, Number(truck.capacity) || 0);
  return {
    delivered,
    inventory: { ...inventory, [truck.fruitType]: available - delivered },
    complete: delivered === Number(truck.capacity)
  };
}


// ---- js/gameplay/win-condition.js ----
function isWinState(state) {
  return state.remainingFruits === 0 && state.inventoryTotal === 0 && state.pendingTruckCapacity === 0;
}


// ---- js/gameplay/simulator.js ----







function findSnakeStart(layer) {
  for (const [key, cell] of Object.entries(layer.cells)) {
    if (cell.item?.kind === "snake") {
      const [x, y] = key.split(",").map(Number);
      return { x, y, direction: cell.item.direction ?? "right" };
    }
  }
  return null;
}

function createSimulation(level) {
  const layer = structuredClone(createMergedLayer(level));
  const start = findSnakeStart(layer);
  if (!start) throw new Error("Không thể mô phỏng: thiếu điểm bắt đầu của rắn.");
  delete layer.cells[cellKey(start.x, start.y)].item;
  return {
    grid: structuredClone(level.grid),
    layer,
    tunnels: normalizeTunnelElement(level.tunnelElement),
    oneWays: normalizeOneWayElement(level.oneWayElement).map((oneWay) => ({
      ...oneWay,
      currentDirection: normalizeOneWayDirection(oneWay.entryPoints[0]?.direction),
      passedEntries: []
    })),
    snake: { body: [{ x: start.x, y: start.y }], direction: start.direction },
    inventory: {},
    delivered: {},
    status: "running",
    lastCollision: null
  };
}

function oneWayEntryAtIndex(oneWays, index) {
  for (const oneWay of Array.isArray(oneWays) ? oneWays : []) {
    const entryIndex = oneWay.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) return { oneWay, entryIndex, entryPoint: oneWay.entryPoints[entryIndex] };
  }
  return null;
}

function updateOneWayRuntime(state, headIndex) {
  const entry = oneWayEntryAtIndex(state.oneWays, headIndex);
  if (!entry) return;
  const runtime = state.oneWays.find((oneWay) => oneWay.oneWayId === entry.oneWay.oneWayId);
  if (!runtime) return;
  runtime.passedEntries = [...new Set([...(runtime.passedEntries ?? []), entry.entryIndex])];
  if (runtime.passedEntries.length >= 2) {
    runtime.currentDirection = reverseOneWayDirection(runtime.currentDirection);
    runtime.entryPoints = runtime.entryPoints.map((point) => ({ ...point, direction: runtime.currentDirection }));
    runtime.passedEntries = [];
  }
}

function tunnelEntryAtIndex(tunnels, index) {
  for (const tunnel of normalizeTunnelElement(tunnels)) {
    const entryIndex = tunnel.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) return { tunnel, entryPoint: tunnel.entryPoints[entryIndex], exitPoint: tunnel.entryPoints[entryIndex === 0 ? 1 : 0] };
  }
  return null;
}

function tunnelBodySlotVisible(state, position) {
  return isInsideGrid(state.grid, position.x, position.y)
    && Boolean(state.layer.cells[cellKey(position.x, position.y)]?.path);
}

function tunnelExitPathDirections(state, exitPosition, incomingDirection) {
  return Object.entries({
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  }).filter(([direction, vector]) => {
    const nextPosition = { x: exitPosition.x + vector.x, y: exitPosition.y + vector.y };
    const nextIndex = (nextPosition.y * state.grid.columns) + nextPosition.x;
    const oneWayEntry = oneWayEntryAtIndex(state.oneWays, nextIndex);
    if (oneWayEntry && oneWayDirectionKey(oneWayEntry.oneWay.currentDirection) !== direction) return false;
    const tempState = { ...state, snake: { ...state.snake, body: [{ ...exitPosition }], direction: incomingDirection } };
    return !detectCollision(tempState, nextPosition, direction, { ignoreSelfCollision: true });
  }).map(([direction]) => direction);
}

function actualTunnelExitDirection(state, exitPosition, incomingDirection) {
  const directions = tunnelExitPathDirections(state, exitPosition, incomingDirection);
  return directions.includes(incomingDirection) ? incomingDirection : directions[0] ?? incomingDirection;
}

function rebuildBodyFromTunnelExit(state, body, exitPosition, exitDirection) {
  const vector = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  }[exitDirection];
  return body.map((segment, index) => {
    const position = {
      x: exitPosition.x - (vector.x * index),
      y: exitPosition.y - (vector.y * index)
    };
    return {
      ...segment,
      ...position,
      direction: exitDirection,
      hiddenInTunnel: index > 0 && !tunnelBodySlotVisible(state, position)
    };
  });
}

function moveSimulationSnake(snake, direction) {
  const head = nextPosition(snake.body[0], direction);
  return {
    ...snake,
    direction,
    body: [
      { ...head, direction, hiddenInTunnel: false },
      ...snake.body.slice(0, -1).map((segment, index) => ({
        ...segment,
        hiddenInTunnel: Boolean(snake.body[index].hiddenInTunnel)
      }))
    ]
  };
}

function stepSimulation(simulation, direction = simulation.snake.direction) {
  if (simulation.status !== "running") return simulation;
  const state = structuredClone(simulation);
  const head = nextPosition(state.snake.body[0], direction);
  const nextIndex = (head.y * state.grid.columns) + head.x;
  const tunnelEntry = tunnelEntryAtIndex(state.tunnels, nextIndex);
  const collision = detectCollision(state, head, direction, { ignoreSelfCollision: Boolean(tunnelEntry) });
  if (collision) {
    state.status = "lost";
    state.lastCollision = collision;
    return state;
  }
  const oneWayEntry = oneWayEntryAtIndex(state.oneWays, nextIndex);
  if (oneWayEntry && oneWayDirectionKey(oneWayEntry.oneWay.currentDirection) !== direction) {
    state.status = "lost";
    state.lastCollision = { type: "one-way", element: oneWayEntry.oneWay };
    return state;
  }

  state.snake = moveSimulationSnake(state.snake, direction);
  if (tunnelEntry) {
    const exit = { x: tunnelEntry.exitPoint.index % state.grid.columns, y: Math.floor(tunnelEntry.exitPoint.index / state.grid.columns) };
    state.snake.direction = actualTunnelExitDirection(state, exit, direction);
    state.snake.body = rebuildBodyFromTunnelExit(state, state.snake.body, exit, state.snake.direction);
  }
  const finalHead = state.snake.body[0];
  updateOneWayRuntime(state, (finalHead.y * state.grid.columns) + finalHead.x);
  const key = cellKey(finalHead.x, finalHead.y);
  const item = state.layer.cells[key]?.item;
  if (item?.kind === "fruit") {
    state.inventory = collectFruit(state.inventory, item.fruitType);
    state.layer.cells[key].item = null;
  } else if (item?.kind === "truck") {
    const result = deliverToTruck(state.inventory, item);
    state.inventory = result.inventory;
    state.delivered[item.fruitType] = (state.delivered[item.fruitType] ?? 0) + result.delivered;
    if (result.complete) state.layer.cells[key].item = null;
  }

  const items = Object.values(state.layer.cells).map((cell) => cell.item).filter(Boolean);
  const summary = {
    remainingFruits: items.filter((itemValue) => itemValue.kind === "fruit").length,
    inventoryTotal: Object.values(state.inventory).reduce((sum, value) => sum + value, 0),
    pendingTruckCapacity: items.filter((itemValue) => itemValue.kind === "truck").reduce((sum, truck) => sum + Number(truck.capacity || 0), 0)
  };
  if (isWinState(summary)) state.status = "won";
  return state;
}


// ---- js/gameplay/shovel-booster.js ----

const DEFAULT_SHOVEL_COUNT = Infinity;
const SHOVEL_COUNT_LABEL = "∞";

const SHOVEL_STATUS = Object.freeze({
  TARGETING: "shovel-targeting",
  TELEPORTING: "shovel-teleporting",
  AWAIT_DIRECTION: "shovel-await-direction",
  RESTORE_TAIL: "shovel-restore-tail"
});

function createShovelBoosterRuntime(count = DEFAULT_SHOVEL_COUNT) {
  return {
    count,
    targetKeys: [],
    restoreActive: false
  };
}

function validShovelTargetKeys(session) {
  if (!session?.priorityPoints || !session?.snake?.body?.[0]) return [];
  const head = session.snake.body[0];
  const headKey = cellKey(head.x, head.y);
  const deliverKeys = new Set((session.trays ?? []).map((tray) => tray.checkpointKey));
  return Object.keys(session.priorityPoints).filter((key) => key !== headKey && !deliverKeys.has(key));
}

function canUseShovelBooster(session) {
  return Boolean(session?.shovel && !session.shovel.restoreActive && validShovelTargetKeys(session).length > 0);
}

function beginShovelTargeting(session) {
  if (!canUseShovelBooster(session)) return false;
  session.shovel.targetKeys = validShovelTargetKeys(session);
  session.status = SHOVEL_STATUS.TARGETING;
  return true;
}

function cancelShovelTargeting(session, fallbackStatus) {
  if (!session?.shovel) return false;
  session.shovel.targetKeys = [];
  session.status = fallbackStatus;
  return true;
}

function shovelTargetKeyFromIndex(session, index) {
  if (!Number.isInteger(index) || !session?.grid?.columns) return null;
  const key = cellKey(index % session.grid.columns, Math.floor(index / session.grid.columns));
  return session.shovel?.targetKeys?.includes(key) ? key : null;
}

function teleportWithShovel(session, targetKey) {
  if (!session?.shovel?.targetKeys?.includes(targetKey)) return false;
  const [x, y] = targetKey.split(",").map(Number);
  const previousBody = session.snake.body.map((segment) => ({ ...segment }));
  session.shovel.targetKeys = [];
  session.shovel.restoreActive = previousBody.length > 1;
  session.tailDisabled = previousBody.length > 1;
  session.snake.direction = null;
  session.snake.body = [
    { ...previousBody[0], x, y, direction: null, hiddenInTunnel: false, hiddenInShovel: false },
    ...previousBody.slice(1).map((segment) => ({
      ...segment,
      hiddenInTunnel: false,
      hiddenInShovel: true
    }))
  ];
  session.status = SHOVEL_STATUS.AWAIT_DIRECTION;
  return true;
}

function beginShovelTailRestore(session) {
  if (!session?.shovel?.restoreActive) return false;
  session.tailDisabled = false;
  session.status = SHOVEL_STATUS.RESTORE_TAIL;
  return true;
}

function revealNextShovelTailSegment(session) {
  if (!session?.shovel?.restoreActive) return false;
  const segment = session.snake.body.find((part, index) => index > 0 && part.hiddenInShovel);
  if (segment) segment.hiddenInShovel = false;
  const stillHidden = session.snake.body.some((part, index) => index > 0 && part.hiddenInShovel);
  if (!stillHidden) {
    session.shovel.restoreActive = false;
    session.tailDisabled = false;
  }
  return Boolean(segment);
}

function isShovelRestoring(session) {
  return Boolean(session?.shovel?.restoreActive);
}


// ---- js/gameplay/tray-fill-system.js ----

function activeTrayLayer(tray) {
  return tray.layers[tray.activeIndex] ?? null;
}

function layerIsComplete(layer) {
  return FRUIT_TYPES.every((type) => (layer.delivered[type] ?? 0) >= (layer.recipe[type] ?? 0));
}

function advanceCompletedTrayLayers(tray) {
  const before = tray.activeIndex;
  while (activeTrayLayer(tray) && layerIsComplete(activeTrayLayer(tray))) tray.activeIndex += 1;
  return tray.activeIndex - before;
}

function fillFruitIntoTray(tray, fruitType) {
  advanceCompletedTrayLayers(tray);
  const layer = activeTrayLayer(tray);
  if (!layer || (layer.recipe[fruitType] ?? 0) <= (layer.delivered[fruitType] ?? 0)) {
    return { filled: false, completedLayerCount: 0 };
  }
  layer.delivered[fruitType] += 1;
  const completedLayerCount = advanceCompletedTrayLayers(tray);
  if (tray.activeIndex >= tray.layers.length && !tray.completed) {
    tray.completed = true;
  }
  return { filled: true, completedLayerCount };
}

function fillFruitIntoAnyTray(session, fruitType) {
  for (const tray of session.trays ?? []) {
    const result = fillFruitIntoTray(tray, fruitType);
    if (result.filled) return { ...result, tray };
  }
  return { filled: false, completedLayerCount: 0, tray: null };
}

function nextDeliverableCargoIndex(session, tray) {
  advanceCompletedTrayLayers(tray);
  const layer = activeTrayLayer(tray);
  if (!layer) return -1;
  return session.snake.body.findIndex((segment, index) => {
    if (index === 0 || !segment.fruitType) return false;
    return (layer.recipe[segment.fruitType] ?? 0) > (layer.delivered[segment.fruitType] ?? 0);
  });
}


// ---- js/gameplay/tray-slot-visual.js ----


const TRAY_SLOT_COUNT = 9;

function trayLayerSlotDescriptors(layer) {
  if (!layer) return [];
  const slots = [];
  FRUIT_TYPES.forEach((type) => {
    const required = Math.max(0, Number(layer.recipe?.[type]) || 0);
    const delivered = Math.min(Math.max(0, Number(layer.delivered?.[type]) || 0), required);
    for (let index = 0; index < required && slots.length < TRAY_SLOT_COUNT; index += 1) {
      const meta = blockVisualMeta(type);
      slots.push({
        type,
        color: meta.color,
        label: meta.label,
        filled: index < delivered
      });
    }
  });
  while (slots.length < TRAY_SLOT_COUNT) {
    slots.push({ type: null, color: "#cbd5e1", label: "Chua setup requirement", filled: false, placeholder: true });
  }
  return slots;
}

function trayLayerNeedTitle(layer) {
  if (!layer) return "Khay da hoan thanh";
  const needs = trayLayerSlotDescriptors(layer)
    .filter((slot) => !slot.placeholder)
    .reduce((summary, slot) => {
      summary[slot.type] ??= { label: slot.label, required: 0, delivered: 0 };
      summary[slot.type].required += 1;
      if (slot.filled) summary[slot.type].delivered += 1;
      return summary;
    }, {});
  const text = Object.values(needs).map((need) => `${need.label} ${need.delivered}/${need.required}`);
  return text.length > 0 ? `Khay can: ${text.join(", ")}` : "Layer khong co requirement";
}

function createTrayRequirementSlot(slot) {
  const element = document.createElement("span");
  element.className = `tray-requirement-slot${slot?.filled ? " filled" : " empty"}${slot?.placeholder ? " placeholder" : ""}`;
  element.style.setProperty("--block-color", slot?.color ?? "#cbd5e1");
  element.title = slot?.placeholder
    ? "Chua setup requirement"
    : slot?.filled ? `${slot.label} da dien` : `${slot.label} con thieu`;
  return element;
}

function renderTraySlotGrid(container, layer) {
  container.replaceChildren();
  if (!layer) {
    container.textContent = "✓";
    container.classList.add("complete");
    return;
  }
  container.classList.remove("complete");
  trayLayerSlotDescriptors(layer).forEach((slot) => {
    container.appendChild(createTrayRequirementSlot(slot));
  });
}


// ---- js/gameplay/lose-revive.js ----

const LOSE_REASON = Object.freeze({
  SELF_COLLISION: "self-collision",
  OTHER: "other"
});

function canReviveLoseReason(reason) {
  return reason === LOSE_REASON.SELF_COLLISION;
}

function markLose(session, { message, reason = LOSE_REASON.OTHER, status }) {
  session.status = status;
  session.lastReason = message;
  session.loseReason = reason;
  session.reviveAvailable = canReviveLoseReason(reason);
  session.delivery = null;
  session.deliveryEffect = null;
  session.teleporting = false;
  session.tailDisabled = false;
}

function reviveSession(session, { onTrayLayerComplete = () => {}, onAfterFill = () => {} } = {}) {
  if (!session || !canReviveLoseReason(session.loseReason)) {
    return { revived: false, reason: "revive-unavailable", transferred: 0, target: 0 };
  }
  const cargo = session.snake.body.slice(1);
  const target = Math.floor(cargo.length * 0.8);
  if (target <= 0) {
    session.reviveAvailable = false;
    session.loseReason = null;
    return { revived: true, reason: "no-transfer-target", transferred: 0, target };
  }

  const originalBody = session.snake.body.map((part) => ({ ...part }));
  const removedIndexes = new Set();
  let transferred = 0;
  session.reviving = true;
  session.tailDisabled = true;
  session.delivery = null;
  session.deliveryEffect = null;

  for (let index = 1; index < originalBody.length && transferred < target; index += 1) {
    const segment = originalBody[index];
    if (!segment.fruitType) continue;
    const result = fillFruitIntoAnyTray(session, segment.fruitType);
    if (!result.filled) continue;
    removedIndexes.add(index);
    transferred += 1;
    onTrayLayerComplete(result.completedLayerCount);
    onAfterFill();
  }

  if (transferred > 0) {
    const positions = originalBody.map(({ x, y }) => ({ x, y }));
    session.snake.body = originalBody
      .filter((_, index) => index === 0 || !removedIndexes.has(index))
      .map((part, index) => ({
        ...part,
        ...positions[index],
        direction: session.snake.direction,
        hiddenInTunnel: false,
        hiddenInShovel: false
      }));
  }

  session.reviving = false;
  session.tailDisabled = false;
  session.reviveAvailable = false;
  session.loseReason = null;
  return { revived: true, transferred, target };
}


// ---- js/gameplay/playable-settings.js ----
const PLAYABLE_SETTING_LIMITS = Object.freeze({
  trainMoveSpeed: Object.freeze({ min: 5, max: 30, step: 1 }),
  trayFillSpeed: Object.freeze({ min: 1, max: 20, step: 1 })
});

const DEFAULT_PLAYABLE_SETTINGS = Object.freeze({
  trainMoveSpeed: 15,
  trayFillSpeed: 9
});

const PLAYABLE_SETTINGS_STORAGE_KEY = "railwayDash.playableSettings";

function clampSetting(key, value) {
  const limits = PLAYABLE_SETTING_LIMITS[key];
  const fallback = DEFAULT_PLAYABLE_SETTINGS[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(number)));
}

function normalizePlayableSettings(settings = {}) {
  return {
    trainMoveSpeed: clampSetting("trainMoveSpeed", settings.trainMoveSpeed ?? settings.speed),
    trayFillSpeed: clampSetting("trayFillSpeed", settings.trayFillSpeed)
  };
}

function changePlayableSetting(settings, key, delta) {
  if (!PLAYABLE_SETTING_LIMITS[key]) return normalizePlayableSettings(settings);
  return normalizePlayableSettings({
    ...settings,
    [key]: clampSetting(key, Number(settings?.[key] ?? DEFAULT_PLAYABLE_SETTINGS[key]) + delta)
  });
}

function loadPlayableSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(PLAYABLE_SETTINGS_STORAGE_KEY);
    return normalizePlayableSettings(raw ? JSON.parse(raw) : DEFAULT_PLAYABLE_SETTINGS);
  } catch {
    return normalizePlayableSettings(DEFAULT_PLAYABLE_SETTINGS);
  }
}

function savePlayableSettings(settings, storage = globalThis.localStorage) {
  const normalized = normalizePlayableSettings(settings);
  try {
    storage?.setItem(PLAYABLE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Runtime settings still apply even if browser storage is unavailable.
  }
  return normalized;
}

function playableSettingIntervalMs(value) {
  return 1000 / Math.max(1, Number(value) || 1);
}


// ---- js/gameplay/layer-spawn-runtime.js ----

const HORIZONTAL_DIRECTIONS = new Set(["left", "right"]);
const VERTICAL_DIRECTIONS = new Set(["up", "down"]);

function visibleTrainSegments(session) {
  return (session?.snake?.body ?? []).filter((segment, index) => (
    !segment.hiddenInTunnel
    && !segment.hiddenInShovel
    && !(session?.tailDisabled && index > 0)
  ));
}

function occupiedTrainIndexMap(session) {
  return new Map(visibleTrainSegments(session).map((segment) => [
    positionToIndex(segment.x, segment.y, session.grid.columns),
    segment
  ]));
}

function offsetSideForSegment(segment) {
  if (HORIZONTAL_DIRECTIONS.has(segment?.direction)) return "up";
  if (VERTICAL_DIRECTIONS.has(segment?.direction)) return "right";
  return "up";
}

function resetLayerSpawnRuntime(session) {
  session.waitingNextLayerSpawn = false;
  session.pendingFruitLayerIndex = null;
  session.itemVisualOffsets = {};
  session.clearedFruitLayerIndexes = [];
}

function markFruitLayerClearIfNeeded(session) {
  if (session.remainingFruits !== 0) return false;
  session.clearedFruitLayerIndexes = [...new Set([...(session.clearedFruitLayerIndexes ?? []), session.activeFruitLayerIndex])];
  if (session.activeFruitLayerIndex + 1 >= session.fruitLayers.length) {
    session.waitingNextLayerSpawn = false;
    session.pendingFruitLayerIndex = null;
    return false;
  }
  session.waitingNextLayerSpawn = true;
  session.pendingFruitLayerIndex = session.activeFruitLayerIndex + 1;
  return true;
}

function trackSpawnedItemOffsets(session, spawnedKeys) {
  const occupied = occupiedTrainIndexMap(session);
  session.itemVisualOffsets ??= {};
  spawnedKeys.forEach((key) => {
    const cell = session.layer.cells[key];
    if (cell?.item?.kind !== "fruit") return;
    const [x, y] = key.split(",").map(Number);
    const index = positionToIndex(x, y, session.grid.columns);
    const segment = occupied.get(index);
    if (!segment) return;
    session.itemVisualOffsets[key] = { side: offsetSideForSegment(segment) };
  });
}

function restoreReleasedItemOffsets(session) {
  const offsets = session.itemVisualOffsets ?? {};
  const keys = Object.keys(offsets);
  if (keys.length === 0) return;
  const occupied = occupiedTrainIndexMap(session);
  keys.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    const index = positionToIndex(x, y, session.grid.columns);
    if (!occupied.has(index)) delete offsets[key];
  });
}

function temporaryItemOffsetClass(session, key) {
  const side = session?.itemVisualOffsets?.[key]?.side;
  return side ? ` item-offset-${side}` : "";
}


// ---- js/gameplay/playable-controller.js ----
















const PLAY_STATUS = Object.freeze({
  READY: "ready",
  MOVING: "moving",
  DELIVERING: "delivering",
  WAITING: "waiting",
  PAUSED: "paused",
  WON: "won",
  LOST: "lost",
  BLOCKED: "blocked",
  TELEPORTING: "teleporting",
  SHOVEL_TARGETING: SHOVEL_STATUS.TARGETING,
  SHOVEL_TELEPORTING: SHOVEL_STATUS.TELEPORTING,
  SHOVEL_AWAIT_DIRECTION: SHOVEL_STATUS.AWAIT_DIRECTION,
  SHOVEL_RESTORE_TAIL: SHOVEL_STATUS.RESTORE_TAIL,
  REVIVING: "reviving"
});

const OPPOSITE = Object.freeze({ up: "down", down: "up", left: "right", right: "left" });
const DIRECTION_LABELS = Object.freeze({ up: "↑ Lên", down: "↓ Xuống", left: "← Trái", right: "→ Phải" });
const STATUS_COPY = Object.freeze({
  ready: ["Sẵn sàng", "Chọn một hướng hợp lệ để bắt đầu."],
  moving: ["Đang chạy", "Rắn đang tự di chuyển trên đoạn đường hiện tại."],
  delivering: ["Đang giao hàng", "Rắn dừng tại checkpoint; vật phẩm phù hợp đang được đưa vào khay lần lượt."],
  waiting: ["Chờ hướng", "Rắn đã dừng. Hãy chọn hướng tiếp theo."],
  paused: ["Đã pause", "Nhấn Resume để tiếp tục phiên chơi."],
  won: ["Hoàn thành", "Tất cả layer của mọi khay đã được giao đủ."],
  lost: ["Thua", "Rắn đã va chạm hoặc không còn hướng hợp lệ."],
  blocked: ["Chưa thể chơi", "Hãy sửa các lỗi level được liệt kê bên dưới."],
  teleporting: ["Đang qua Tunnel", "Train đang được đặt lại theo cổng ra."],
  reviving: ["Đang Revive", "Train đang tự chuyển Fruit vào khay và rebuild lại."],
  [SHOVEL_STATUS.TARGETING]: ["Chọn điểm Xẻng", "Chọn một PriorityPoint đang sáng để dịch chuyển Head."],
  [SHOVEL_STATUS.TELEPORTING]: ["Đang dùng Xẻng", "Tail đang tạm ẩn và Head được đưa tới điểm đích."],
  [SHOVEL_STATUS.AWAIT_DIRECTION]: ["Chờ hướng sau Xẻng", "Head đã tới PriorityPoint mới. Chọn hướng tiếp tục."],
  [SHOVEL_STATUS.RESTORE_TAIL]: ["Đang hồi Tail", "Tail xuất hiện dần theo đường Head vừa đi."]
});

function gateAllowsMovement(element, direction) {
  return !isGateElement(element) || gateDirectionFromMovement(direction) === normalizeGateDirection(element.direction);
}

function tunnelEntryAtIndex(tunnels, index) {
  for (const tunnel of normalizeTunnelElement(tunnels)) {
    const entryIndex = tunnel.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) {
      return {
        tunnel,
        entryIndex,
        entryPoint: tunnel.entryPoints[entryIndex],
        exitPoint: tunnel.entryPoints[entryIndex === 0 ? 1 : 0]
      };
    }
  }
  return null;
}

function tunnelBodySlotVisible(session, position) {
  return isInsideGrid(session.grid, position.x, position.y)
    && Boolean(session.layer.cells[cellKey(position.x, position.y)]?.path);
}

function rebuildBodyFromTunnelExit(session, body, exitPosition, exitDirection) {
  const vector = DIRECTIONS[exitDirection];
  return body.map((segment, index) => {
    const position = {
      x: exitPosition.x - (vector.x * index),
      y: exitPosition.y - (vector.y * index)
    };
    return {
      ...segment,
      ...position,
      direction: exitDirection,
      hiddenInTunnel: index > 0 && !tunnelBodySlotVisible(session, position)
    };
  });
}

function nextTailPosition(session, body, direction) {
  const tail = body[body.length - 1];
  const vector = DIRECTIONS[direction];
  const position = {
    x: tail.x - vector.x,
    y: tail.y - vector.y
  };
  return {
    ...position,
    direction,
    hiddenInTunnel: Boolean(tail.hiddenInTunnel) || !tunnelBodySlotVisible(session, position)
  };
}

function tailLogicDisabled(session) {
  return Boolean(
    session?.teleporting
    || session?.reviving
    || session?.tailDisabled
    || session?.status === SHOVEL_STATUS.TARGETING
    || session?.status === SHOVEL_STATUS.TELEPORTING
    || session?.status === SHOVEL_STATUS.AWAIT_DIRECTION
  );
}

function visibleTailLength(session) {
  return (session?.snake?.body ?? []).filter((part, index) => index > 0 && !part.hiddenInTunnel && !part.hiddenInShovel).length;
}

function tunnelExitPathDirections(session, exitPosition, incomingDirection) {
  const exitCell = session.layer.cells[cellKey(exitPosition.x, exitPosition.y)];
  return Object.entries(DIRECTIONS).filter(([direction, vector]) => {
    if (isBridgeElement(exitCell?.element) && incomingDirection && direction !== incomingDirection) return false;
    const nextPosition = { x: exitPosition.x + vector.x, y: exitPosition.y + vector.y };
    const nextCell = session.layer.cells[cellKey(nextPosition.x, nextPosition.y)];
    if (!gateAllowsMovement(exitCell?.element, direction) || !gateAllowsMovement(nextCell?.element, direction)) return false;
    if (!oneWayAllowsMovement(session, positionToIndex(nextPosition.x, nextPosition.y, session.grid.columns), direction)) return false;
    return cellIsTraversable(session, nextPosition, direction, { ignoreSelfCollision: true });
  }).map(([direction]) => direction);
}

function actualTunnelExitDirection(session, exitPosition, incomingDirection) {
  const directions = tunnelExitPathDirections(session, exitPosition, incomingDirection);
  const autoDirection = nextAutoDirection({ ...session, snake: { body: [{ ...exitPosition }], direction: incomingDirection } }, directions);
  return autoDirection ?? (directions.includes(incomingDirection) ? incomingDirection : directions[0] ?? incomingDirection);
}

function oneWayEntryAtIndex(oneWays, index) {
  for (const oneWay of Array.isArray(oneWays) ? oneWays : []) {
    const entryIndex = oneWay.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) {
      return {
        oneWay,
        entryIndex,
        entryPoint: oneWay.entryPoints[entryIndex]
      };
    }
  }
  return null;
}

function firstFruitLayerId(level) {
  return level?.layers?.[0]?.id ?? level?.activeLayerId;
}

function activeLayer(level, layerId = level?.activeLayerId) {
  return createMergedLayer(level, layerId);
}

function fruitLayersForPlayable(level) {
  if (!level?.sharedCells) {
    const layer = activeLayer(level);
    return layer ? [{ id: layer.id, name: layer.name, cells: structuredClone(layer.cells ?? {}) }] : [];
  }
  return (level.layers ?? []).map((layer, index) => ({
    id: layer.id,
    name: layer.name ?? `Layer ${String(index + 1).padStart(2, "0")}`,
    cells: Object.fromEntries(Object.entries(layer.cells ?? {}).filter(([, cell]) => cell?.item?.kind === "fruit"))
  }));
}

function entriesWithPosition(layer) {
  return Object.entries(layer?.cells ?? {}).map(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    return { key, x, y, cell };
  });
}

function normalizeTrayLayers(item) {
  if (item.kind === "truck") {
    return [{ id: `${item.id ?? "legacy-truck"}-layer`, recipe: { [item.fruitType]: Number(item.capacity) || 0 } }];
  }
  return (item.trayLayers ?? []).map((layer, index) => ({
    id: layer.id ?? `tray-layer-${index + 1}`,
    recipe: Object.fromEntries(FRUIT_TYPES.map((type) => [type, Number(layer.recipe?.[type]) || 0]))
  }));
}

function validatePlayableLevel(level) {
  ensureTerrainState(level);
  const errors = [];
  const mapIndex = (x, y) => positionToIndex(x, y, level?.grid?.columns ?? 0);
  const layer = activeLayer(level ?? {}, firstFruitLayerId(level));
  if (!level?.grid || !layer) return { valid: false, errors: ["Level chưa có grid hoặc layer để chơi."], layer: null };

  const entries = entriesWithPosition(layer);
  const starts = entries.filter(({ cell }) => cell.item?.kind === "snake");
  const trays = entries.filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind));
  const fruitLayers = fruitLayersForPlayable(level);
  const fruits = fruitLayers.flatMap((fruitLayer, layerIndex) => entriesWithPosition(fruitLayer)
    .filter(({ cell }) => cell.item?.kind === "fruit")
    .map((entry) => ({ ...entry, layerIndex })));
  if (starts.length !== 1) errors.push(`Cần đúng 1 đầu rắn trong layer đang chơi (hiện có ${starts.length}).`);
  if (fruits.length === 0) errors.push("Cần ít nhất 1 trái cây trên map.");
  if (trays.length === 0) errors.push("Cần ít nhất 1 khay chứa trên map.");
  Object.keys(level.priorityPoints ?? {}).forEach((key) => {
    if (!level.sharedCells?.[key]?.path) errors.push(`PriorityPoint Index ${mapIndex(...key.split(",").map(Number))} phải thuộc Path.`);
  });
  entries.forEach(({ x, y, cell }) => {
    if (!isGateElement(cell.element)) return;
    if (!cell.path) errors.push(`Gate tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
    if (!isValidGateDirection(cell.element.direction)) errors.push(`Gate tại Index ${mapIndex(x, y)} có direction không hợp lệ.`);
  });
  const barrierIndexes = new Set();
  const barrierEndpointIndexes = new Set();
  normalizeCountBarrierElement(level.countBarrierElement).forEach((barrier) => {
    const localIndexes = new Set(barrier.index);
    barrierEndpointIndexes.add(barrier.startIndex);
    barrierEndpointIndexes.add(barrier.endIndex);
    if (barrier.index.length < 2) errors.push(`Count Barrier ${barrier.barrierId} phải khóa ít nhất 2 ô Path.`);
    if (barrier.startIndex === barrier.endIndex) errors.push(`Count Barrier ${barrier.barrierId} phải có startIndex và endIndex khác nhau.`);
    if (!localIndexes.has(barrier.startIndex) || !localIndexes.has(barrier.endIndex)) errors.push(`Count Barrier ${barrier.barrierId} start/end phải nằm trong index.`);
    barrier.index.forEach((index) => {
      const { x, y } = { x: index % level.grid.columns, y: Math.floor(index / level.grid.columns) };
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`Count Barrier ${barrier.barrierId} Index ${index} nằm ngoài map.`);
        return;
      }
      if (!layer.cells[cellKey(x, y)]?.path) errors.push(`Count Barrier ${barrier.barrierId} Index ${index} phải nằm trên Path.`);
      if (barrierIndexes.has(index)) errors.push(`Count Barrier không được chồng index ${index}.`);
      barrierIndexes.add(index);
    });
  });
  const tunnelIndexes = new Set();
  normalizeTunnelElement(level.tunnelElement).forEach((tunnel) => {
    if (tunnel.entryPoints.length !== 2) errors.push(`Tunnel ${tunnel.tunnelId} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    tunnel.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = { x: point.index % level.grid.columns, y: Math.floor(point.index / level.grid.columns) };
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`Tunnel ${tunnel.tunnelId} Entry ${name} Index ${point.index} nằm ngoài map.`);
        return;
      }
      if (!layer.cells[cellKey(x, y)]?.path) errors.push(`Tunnel ${tunnel.tunnelId} Entry ${name} Index ${point.index} phải nằm trên Path.`);
      if (!isValidTunnelDirection(point.direction)) errors.push(`Tunnel ${tunnel.tunnelId} Entry ${name} direction không hợp lệ.`);
      if (localIndexes.has(point.index)) errors.push(`Tunnel ${tunnel.tunnelId} không được dùng cùng index cho hai entryPoint.`);
      if (tunnelIndexes.has(point.index)) errors.push(`Tunnel không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      tunnelIndexes.add(point.index);
    });
  });
  const oneWayIndexes = new Set();
  normalizeOneWayElement(level.oneWayElement).forEach((oneWay) => {
    if (oneWay.entryPoints.length !== 2) errors.push(`One Way ${oneWay.oneWayId} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    oneWay.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = { x: point.index % level.grid.columns, y: Math.floor(point.index / level.grid.columns) };
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`One Way ${oneWay.oneWayId} Entry ${name} Index ${point.index} nằm ngoài map.`);
        return;
      }
      if (!layer.cells[cellKey(x, y)]?.path) errors.push(`One Way ${oneWay.oneWayId} Entry ${name} Index ${point.index} phải nằm trên Path.`);
      if (!isValidOneWayDirection(point.direction)) errors.push(`One Way ${oneWay.oneWayId} Entry ${name} direction không hợp lệ.`);
      if (localIndexes.has(point.index)) errors.push(`One Way ${oneWay.oneWayId} không được dùng cùng index cho hai entryPoint.`);
      if (oneWayIndexes.has(point.index)) errors.push(`One Way không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      oneWayIndexes.add(point.index);
    });
  });

  starts.forEach(({ x, y, cell }) => {
    if (!cell.path) errors.push(`${cell.item.label ?? cell.item.kind} tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
  });

  trays.forEach(({ x, y, cell }) => {
    const visualCells = getTrayVisualCells(cell.item, { x, y });
    const outsideVisual = visualCells.filter((visual) => !isInsideGrid(level.grid, visual.x, visual.y));
    if (outsideVisual.length > 0) errors.push(`Visual khay 3x4 tại checkpoint Index ${mapIndex(x, y)} nằm ngoài map.`);
    if (!cell.path) errors.push(`Checkpoint khay tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
    visualCells.forEach((visual) => {
      if (!isInsideGrid(level.grid, visual.x, visual.y)) return;
      const visualCell = layer.cells[cellKey(visual.x, visual.y)];
      if (visualCell?.path || visualCell?.item || visualCell?.element) errors.push(`Ô visual khay Index ${mapIndex(visual.x, visual.y)} phải để trống.`);
    });
  });
  const visualKeys = trays.flatMap(({ x, y, cell }) => getTrayVisualCells(cell.item, { x, y }).map((visual) => cellKey(visual.x, visual.y)));
  if (new Set(visualKeys).size !== visualKeys.length) errors.push("Có nhiều khay đang overlap footprint visual 3x4.");

  fruits.forEach(({ x, y, cell, layerIndex }) => {
    const index = mapIndex(x, y);
    const sharedCell = level.sharedCells?.[cellKey(x, y)];
    const sharedPath = sharedCell?.path ?? cell.path;
    if (!sharedPath) errors.push(`${cell.item.label ?? cell.item.kind} tại Index ${index} trong fruit layer ${layerIndex + 1} phải nằm trên đường đi.`);
    if (sharedCell?.item && (!isPlayerHeadItem(sharedCell.item) || layerIndex === 0)) errors.push(`Fruit layer ${layerIndex + 1} tại Index ${index} trùng ${sharedCell.item.kind} dùng chung.`);
    if (barrierEndpointIndexes.has(index)) errors.push(`Fruit layer ${layerIndex + 1} không được đặt tại endpoint Count Barrier Index ${index}.`);
    if (cell.item.unknown || !FRUIT_TYPES.includes(cell.item.fruitType)) errors.push(`Unknown item #${cell.item.itemId ?? cell.item.id} trong fruit layer ${layerIndex + 1} chưa được Playable hỗ trợ.`);
  });

  const fruitTotals = Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
  fruits.forEach(({ cell }) => { fruitTotals[cell.item.fruitType] = (fruitTotals[cell.item.fruitType] ?? 0) + 1; });
  const recipeTotals = Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
  trays.forEach(({ x, y, cell }) => {
    const layers = normalizeTrayLayers(cell.item);
    if (layers.length === 0) errors.push(`Khay tại Index ${mapIndex(x, y)} chưa có layer recipe.`);
    layers.forEach((trayLayer, index) => {
      const total = Object.values(trayLayer.recipe).reduce((sum, amount) => sum + amount, 0);
      const expected = cell.item.kind === "tray" ? 9 : Number(cell.item.capacity) || 0;
      if (total !== expected) errors.push(`Khay Index ${mapIndex(x, y)} · layer ${index + 1} cần đủ ${expected} item (hiện ${total}).`);
      FRUIT_TYPES.forEach((type) => { recipeTotals[type] += trayLayer.recipe[type] ?? 0; });
    });
    if ((cell.item.trayLayers ?? []).some((trayLayer) => (trayLayer.unknownItems ?? []).some((item) => Number(item.count) > 0))) {
      errors.push(`Khay Index ${mapIndex(x, y)} còn item recipe chưa được hỗ trợ.`);
    }
  });
  FRUIT_TYPES.forEach((type) => {
    if (fruitTotals[type] !== recipeTotals[type]) {
      errors.push(`${blockLabelForFruitType(type)} ${type}: map có ${fruitTotals[type]}, recipe cần ${recipeTotals[type]}.`);
    }
  });
  return { valid: errors.length === 0, errors, layer, fruitLayers };
}

function createTrayRuntime(entry) {
  const checkpoint = { x: entry.x, y: entry.y };
  const visual = getTrayVisualPosition(entry.cell.item, checkpoint);
  return {
    id: entry.cell.item.id ?? `tray-${entry.cell.item.trayId ?? entry.key}`,
    trayId: entry.cell.item.trayId,
    item: structuredClone(entry.cell.item),
    key: entry.key,
    visualKey: cellKey(visual.x, visual.y),
    visualCells: getTrayVisualCells(entry.cell.item, checkpoint),
    checkpointKey: cellKey(checkpoint.x, checkpoint.y),
    checkpoint,
    x: visual.x,
    y: visual.y,
    layers: normalizeTrayLayers(entry.cell.item).map((layer) => ({ ...layer, delivered: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])) })),
    activeIndex: 0
  };
}

function createPlayableSession(level, { mode = "continuous", ...rawSettings } = {}) {
  const report = validatePlayableLevel(level);
  if (!report.valid) throw new Error(report.errors.join(" "));
  const playableSettings = normalizePlayableSettings(rawSettings);
  const layer = structuredClone(report.layer);
  const entries = entriesWithPosition(layer);
  const start = entries.find(({ cell }) => cell.item?.kind === "snake");
  layer.cells[start.key].item = null;
  const session = {
    grid: structuredClone(level.grid),
    layer,
    grassCells: structuredClone(level.grassCells),
    priorityPoints: structuredClone(level.priorityPoints),
    mysteryFruitElement: structuredClone(level.mysteryFruitElement ?? []),
    mysteryFruitDebug: Boolean(level.mysteryFruitDebug),
    countBarriers: normalizeCountBarrierElement(level.countBarrierElement).map((barrier) => ({ ...barrier, remainingCount: barrier.count })),
    tunnels: normalizeTunnelElement(level.tunnelElement),
    oneWays: normalizeOneWayElement(level.oneWayElement).map((oneWay) => ({
      ...oneWay,
      entryPoints: oneWay.entryPoints.map((point) => ({ ...point, direction: normalizeOneWayDirection(point.direction) })),
      passedEntries: []
    })),
    fruitLayers: structuredClone(report.fruitLayers),
    activeFruitLayerIndex: 0,
    snake: { body: [{ x: start.x, y: start.y }], direction: null },
    turnpointKeys: Object.keys(level.priorityPoints ?? {}),
    trays: entries.filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind)).map(createTrayRuntime),
    remainingFruits: entries.filter(({ cell }) => cell.item?.kind === "fruit").length,
    mode,
    trainMoveSpeed: playableSettings.trainMoveSpeed,
    trayFillSpeed: playableSettings.trayFillSpeed,
    speed: playableSettings.trainMoveSpeed,
    status: PLAY_STATUS.READY,
    resumeStatus: PLAY_STATUS.READY,
    lastReason: null,
    loseReason: null,
    reviveAvailable: false,
    reviving: false,
    delivery: null,
    deliveryEffect: null,
    teleporting: false,
    tailDisabled: false,
    shovel: createShovelBoosterRuntime()
  };
  resetLayerSpawnRuntime(session);
  markFruitLayerClearIfNeeded(session);
  return session;
}

function activateFruitLayer(session, nextIndex) {
  Object.values(session.layer.cells).forEach((cell) => {
    if (cell?.item?.kind === "fruit") cell.item = null;
  });
  const nextLayer = session.fruitLayers[nextIndex];
  if (!nextLayer) return false;
  const spawnedKeys = [];
  Object.entries(nextLayer.cells ?? {}).forEach(([key, fruitCell]) => {
    if (fruitCell?.item?.kind !== "fruit") return;
    session.layer.cells[key] ??= { path: false, element: null, item: null };
    session.layer.cells[key].item = structuredClone(fruitCell.item);
    spawnedKeys.push(key);
  });
  session.activeFruitLayerIndex = nextIndex;
  session.remainingFruits = Object.values(nextLayer.cells ?? {}).filter((cell) => cell?.item?.kind === "fruit").length;
  trackSpawnedItemOffsets(session, spawnedKeys);
  return true;
}

function spawnPendingFruitLayerAtPoint(session, key) {
  if (!session.waitingNextLayerSpawn || session.pendingFruitLayerIndex == null) return false;
  if (!isDecisionStopPoint(session, key)) return false;
  const spawned = activateFruitLayer(session, session.pendingFruitLayerIndex);
  if (spawned) {
    session.waitingNextLayerSpawn = false;
    session.pendingFruitLayerIndex = null;
  }
  return spawned;
}

function allFruitLayersComplete(session) {
  return session.remainingFruits === 0 && session.activeFruitLayerIndex >= session.fruitLayers.length - 1;
}

function cellIsTraversable(session, position, direction = null, { ignoreSelfCollision = false } = {}) {
  if (!isInsideGrid(session.grid, position.x, position.y)) return false;
  const index = positionToIndex(position.x, position.y, session.grid.columns);
  if (session.countBarriers?.some((barrier) => barrier.remainingCount > 0 && barrier.index.includes(index))) return false;
  const cell = session.layer.cells[cellKey(position.x, position.y)];
  if (!cell?.path) return false;
  if (session.trays.some((tray) => tray.visualKey === cellKey(position.x, position.y))) return false;
  if (cell.item?.kind === "obstacle" || cell.element?.kind === "obstacle") return false;
  if (ignoreSelfCollision || tailLogicDisabled(session)) return true;
  const hitsSelf = session.snake.body.some((part) => !part.hiddenInTunnel && !part.hiddenInShovel && part.x === position.x && part.y === position.y);
  if (!hitsSelf) return true;
  return bridgeAllowsDifferentAxisOverlap(session.layer, session.snake, position, direction);
}

function oneWayAllowsMovement(session, index, direction) {
  const oneWayEntry = oneWayEntryAtIndex(session.oneWays, index);
  if (!oneWayEntry) return true;
  return oneWayDirectionKey(oneWayEntry.entryPoint.direction) === direction;
}

function availableDirections(session) {
  const head = session.snake.body[0];
  const headCell = session.layer.cells[cellKey(head.x, head.y)];
  const reverse = OPPOSITE[session.snake.direction];
  return Object.entries(DIRECTIONS).filter(([direction, vector]) => {
    if (isBridgeElement(headCell?.element) && session.snake.direction && direction !== session.snake.direction) return false;
    const nextPosition = { x: head.x + vector.x, y: head.y + vector.y };
    const nextIndex = positionToIndex(nextPosition.x, nextPosition.y, session.grid.columns);
    const nextTunnelEntry = tunnelEntryAtIndex(session.tunnels, nextIndex);
    if (!nextTunnelEntry && !tailLogicDisabled(session) && visibleTailLength(session) > 0 && direction === reverse) return false;
    const nextCell = session.layer.cells[cellKey(nextPosition.x, nextPosition.y)];
    if (!gateAllowsMovement(headCell?.element, direction) || !gateAllowsMovement(nextCell?.element, direction)) return false;
    if (!oneWayAllowsMovement(session, nextIndex, direction)) return false;
    return cellIsTraversable(session, nextPosition, direction, { ignoreSelfCollision: Boolean(nextTunnelEntry) });
  }).map(([direction]) => direction);
}

function updateOneWayRuntime(session, headIndex) {
  const entry = oneWayEntryAtIndex(session.oneWays, headIndex);
  if (!entry) return;
  const runtime = session.oneWays.find((oneWay) => oneWay.oneWayId === entry.oneWay.oneWayId);
  if (!runtime) return;
  runtime.passedEntries = [...new Set([...(runtime.passedEntries ?? []), entry.entryIndex])];
  if (runtime.passedEntries.length >= 2) {
    runtime.entryPoints = runtime.entryPoints.map((point) => ({ ...point, direction: reverseOneWayDirection(point.direction) }));
    runtime.passedEntries = [];
  }
}

function decrementCountBarriers(session, amount = 1) {
  const step = Math.max(0, Math.floor(Number(amount)) || 0);
  if (step === 0) return [];
  (session.countBarriers ?? []).forEach((barrier) => {
    if (barrier.remainingCount > 0) barrier.remainingCount -= step;
  });
  const unlocked = (session.countBarriers ?? []).filter((barrier) => barrier.remainingCount <= 0);
  session.countBarriers = (session.countBarriers ?? []).filter((barrier) => barrier.remainingCount > 0);
  return unlocked;
}

function removeUnlockedBarrierEndpointFruits(session, barriers) {
  barriers.forEach((barrier) => {
    [barrier.startIndex, barrier.endIndex].forEach((index) => {
      const key = cellKey(index % session.grid.columns, Math.floor(index / session.grid.columns));
      const cell = session.layer.cells[key];
      if (cell?.item?.kind !== "fruit") return;
      cell.item = null;
      session.remainingFruits = Math.max(0, session.remainingFruits - 1);
    });
  });
}

function beginCheckpointDelivery(session, tray) {
  if (!tray || nextDeliverableCargoIndex(session, tray) < 1) return false;
  session.delivery = { trayId: tray.id };
  session.deliveryEffect = null;
  session.status = PLAY_STATUS.DELIVERING;
  return true;
}

function deliverNextCargo(session) {
  const tray = session.trays.find((candidate) => candidate.id === session.delivery?.trayId);
  const cargoIndex = tray ? nextDeliverableCargoIndex(session, tray) : -1;
  if (!tray || cargoIndex < 1) {
    session.delivery = null;
    session.deliveryEffect = null;
    setPostDeliveryStatus(session);
    return { delivered: false, status: session.status };
  }

  const positions = session.snake.body.map(({ x, y }) => ({ x, y }));
  const [segment] = session.snake.body.splice(cargoIndex, 1);
  const fillResult = fillFruitIntoTray(tray, segment.fruitType);
  session.snake.body = session.snake.body.map((part, index) => ({ ...part, ...positions[index] }));
  session.deliveryEffect = {
    fruitType: segment.fruitType,
    itemId: segment.itemId,
    checkpointKey: tray.checkpointKey,
    visualKey: tray.visualKey,
    nonce: `${Date.now()}-${session.snake.body.length}`
  };

  const unlockedBarriers = decrementCountBarriers(session, fillResult.completedLayerCount);
  removeUnlockedBarrierEndpointFruits(session, unlockedBarriers);
  markFruitLayerClearIfNeeded(session);
  if (nextDeliverableCargoIndex(session, tray) < 1) {
    session.delivery = null;
    setPostDeliveryStatus(session);
  } else {
    session.status = PLAY_STATUS.DELIVERING;
  }
  return { delivered: true, fruitType: segment.fruitType, status: session.status };
}

function allTraysComplete(session) {
  return session.trays.length > 0 && session.trays.every((tray) => tray.activeIndex >= tray.layers.length);
}

function isDecisionStopPoint(session, key) {
  return session.turnpointKeys.includes(key) || session.trays.some((tray) => tray.checkpointKey === key);
}

function nextAutoDirection(session, available) {
  const reverse = OPPOSITE[session.snake.direction];
  const onward = available.filter((direction) => direction !== reverse);
  if (onward.includes(session.snake.direction)) return session.snake.direction;
  if (onward.length === 1) return onward[0];
  if (onward.length === 0 && available.length === 1) return available[0];
  return null;
}

function directionBlockedBySelfCollision(session, direction) {
  const head = session.snake.body[0];
  const vector = DIRECTIONS[direction];
  const nextPosition = { x: head.x + vector.x, y: head.y + vector.y };
  const nextIndex = positionToIndex(nextPosition.x, nextPosition.y, session.grid.columns);
  const headCell = session.layer.cells[cellKey(head.x, head.y)];
  const nextCell = session.layer.cells[cellKey(nextPosition.x, nextPosition.y)];
  if (!gateAllowsMovement(headCell?.element, direction) || !gateAllowsMovement(nextCell?.element, direction)) return false;
  if (!oneWayAllowsMovement(session, nextIndex, direction)) return false;
  if (!cellIsTraversable(session, nextPosition, direction, { ignoreSelfCollision: true })) return false;
  const hitsSelf = session.snake.body.some((part) => !part.hiddenInTunnel && !part.hiddenInShovel && part.x === nextPosition.x && part.y === nextPosition.y);
  return hitsSelf && !bridgeAllowsDifferentAxisOverlap(session.layer, session.snake, nextPosition, direction);
}

function loseReasonForBlockedDirections(session, directions = Object.keys(DIRECTIONS)) {
  return directions.some((direction) => directionBlockedBySelfCollision(session, direction))
    ? LOSE_REASON.SELF_COLLISION
    : LOSE_REASON.OTHER;
}

function loseSession(session, message, reason = LOSE_REASON.OTHER) {
  markLose(session, { message, reason, status: PLAY_STATUS.LOST });
}

function setPostDeliveryStatus(session) {
  if (allFruitLayersComplete(session) && allTraysComplete(session)) {
    session.status = PLAY_STATUS.WON;
    return;
  }
  if (availableDirections(session).length === 0) {
    loseSession(session, "Không còn hướng hợp lệ sau checkpoint giao hàng.", loseReasonForBlockedDirections(session));
    return;
  }
  session.status = PLAY_STATUS.WAITING;
}

function setPostMoveStatus(session) {
  if (allFruitLayersComplete(session) && allTraysComplete(session)) {
    session.status = PLAY_STATUS.WON;
    return;
  }
  const available = availableDirections(session);
  const head = session.snake.body[0];
  const key = cellKey(head.x, head.y);
  const headCell = session.layer.cells[key];
  if (isBridgeElement(headCell?.element)) {
    if (available.includes(session.snake.direction)) session.status = PLAY_STATUS.MOVING;
    else {
      loseSession(
        session,
        "Bridge yêu cầu rắn tiếp tục đi thẳng nhưng phía trước không hợp lệ.",
        loseReasonForBlockedDirections(session, [session.snake.direction])
      );
    }
    return;
  }
  if (isDecisionStopPoint(session, key)) {
    if (available.length === 0) {
      loseSession(session, session.turnpointKeys.includes(key)
        ? "Không còn hướng di chuyển hợp lệ tại PriorityPoint."
        : "Không còn hướng hợp lệ tại checkpoint khay.", loseReasonForBlockedDirections(session));
    } else session.status = PLAY_STATUS.WAITING;
    return;
  }
  const autoDirection = nextAutoDirection(session, available);
  if (autoDirection) {
    session.snake.direction = autoDirection;
    session.status = PLAY_STATUS.MOVING;
  } else if (available.length === 0) {
    loseSession(session, "Rắn đã tới ngõ cụt và không thể quay đầu khi đang có đuôi.", loseReasonForBlockedDirections(session));
  } else {
    loseSession(session, "Ngã rẽ cần PriorityPoint để rắn dừng và chọn hướng.");
  }
}

function movePlayableSession(session, direction) {
  if (!availableDirections(session).includes(direction)) {
    if (directionBlockedBySelfCollision(session, direction)) {
      loseSession(session, "Đầu tàu tự đâm vào thân.", LOSE_REASON.SELF_COLLISION);
      return { moved: false, reason: "self-collision", status: session.status };
    }
    return { moved: false, reason: "invalid-direction" };
  }
  session.deliveryEffect = null;
  const vector = DIRECTIONS[direction];
  const previousBody = session.snake.body.map((part) => ({ ...part }));
  const head = previousBody[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y, direction };
  const tunnelEntry = tunnelEntryAtIndex(session.tunnels, positionToIndex(nextHead.x, nextHead.y, session.grid.columns));
  if (tunnelEntry) {
    session.teleporting = true;
    session.tailDisabled = true;
    session.status = PLAY_STATUS.TELEPORTING;
  }
  const previousCargo = previousBody.slice(1);
  const movedBody = [
    { ...nextHead, hiddenInTunnel: false },
    ...previousCargo.map((segment, index) => ({
      ...segment,
      x: previousBody[index].x,
      y: previousBody[index].y,
      direction,
      hiddenInTunnel: Boolean(previousBody[index].hiddenInTunnel),
      hiddenInShovel: Boolean(segment.hiddenInShovel)
    }))
  ];
  if (tunnelEntry) {
    const exit = {
      x: tunnelEntry.exitPoint.index % session.grid.columns,
      y: Math.floor(tunnelEntry.exitPoint.index / session.grid.columns)
    };
    session.snake.direction = actualTunnelExitDirection(session, exit, direction);
    session.snake.body = rebuildBodyFromTunnelExit(session, movedBody, exit, session.snake.direction);
    session.tailDisabled = false;
    session.teleporting = false;
  } else {
    session.snake.direction = direction;
    session.snake.body = movedBody;
  }
  restoreReleasedItemOffsets(session);

  const finalHead = session.snake.body[0];
  updateOneWayRuntime(session, positionToIndex(finalHead.x, finalHead.y, session.grid.columns));
  const key = cellKey(finalHead.x, finalHead.y);
  const cell = session.layer.cells[key];
  const spawnedNextLayer = spawnPendingFruitLayerAtPoint(session, key);
  if (!spawnedNextLayer && cell.item?.kind === "fruit") {
    const tailPosition = tunnelEntry ? nextTailPosition(session, session.snake.body, session.snake.direction) : previousBody[previousBody.length - 1];
    session.snake.body.push({ ...tailPosition, fruitType: cell.item.fruitType, itemId: blockItemIdFromItem(cell.item), hiddenInShovel: isShovelRestoring(session) });
    cell.item = null;
    session.remainingFruits -= 1;
    markFruitLayerClearIfNeeded(session);
  }
  revealNextShovelTailSegment(session);
  const tray = session.trays.find((candidate) => candidate.checkpointKey === key);
  if (!beginCheckpointDelivery(session, tray)) setPostMoveStatus(session);
  if (isShovelRestoring(session) && session.status === PLAY_STATUS.MOVING) session.status = PLAY_STATUS.SHOVEL_RESTORE_TAIL;
  return { moved: true, status: session.status };
}

function statusText(status) {
  return STATUS_COPY[status] ?? STATUS_COPY.ready;
}

function createPlayableController({ getLevel, elements, onExitEditor }) {
  let session = null;
  let validationErrors = [];
  let timer = null;
  let isActive = false;
  let swipeStart = null;
  let playableSettings = loadPlayableSettings();

  function currentLevelState() {
    return ensureTerrainState(getLevel());
  }

  function updateSettingInputs() {
    if (!elements.playTrainSpeedInput || !elements.playTrayFillSpeedInput) return;
    elements.playTrainSpeedInput.value = String(playableSettings.trainMoveSpeed);
    elements.playTrayFillSpeedInput.value = String(playableSettings.trayFillSpeed);
  }

  function applySettings(nextSettings) {
    playableSettings = savePlayableSettings(nextSettings);
    if (session) {
      session.trainMoveSpeed = playableSettings.trainMoveSpeed;
      session.trayFillSpeed = playableSettings.trayFillSpeed;
      session.speed = playableSettings.trainMoveSpeed;
    }
    updateSettingInputs();
    scheduleNext();
    render();
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function fitBoard() {
    const grid = session?.grid ?? currentLevelState()?.grid;
    if (!grid || !elements.playableCanvasArea.clientWidth || !elements.playableCanvasArea.clientHeight) return;
    const areaStyle = getComputedStyle(elements.playableCanvasArea);
    const wrapStyle = getComputedStyle(elements.playableBoardWrap);
    const width = elements.playableCanvasArea.clientWidth - parseFloat(areaStyle.paddingLeft) - parseFloat(areaStyle.paddingRight);
    const height = elements.playableCanvasArea.clientHeight - parseFloat(areaStyle.paddingTop) - parseFloat(areaStyle.paddingBottom);
    const frameX = parseFloat(wrapStyle.paddingLeft) + parseFloat(wrapStyle.paddingRight) + 2;
    const frameY = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom) + 2;
    const widthFromHeight = Math.max(0, height - frameY) * (grid.columns / grid.rows) + frameX;
    elements.playableBoardWrap.style.width = `${Math.max(120, Math.min(790, width, widthFromHeight))}px`;
  }

  function renderBoard() {
    const levelState = currentLevelState();
    const previewLayerIndex = levelState?.layers?.findIndex((layer) => layer.id === levelState.activeLayerId) ?? 0;
    const level = session
      ? { grid: session.grid, layer: session.layer, mysteryFruitElement: session.mysteryFruitElement, mysteryFruitDebug: session.mysteryFruitDebug, activeFruitLayerIndex: session.activeFruitLayerIndex, countBarriers: session.countBarriers, tunnels: session.tunnels, oneWays: session.oneWays }
      : levelState
        ? { grid: levelState.grid, layer: activeLayer(levelState), mysteryFruitElement: levelState.mysteryFruitElement, mysteryFruitDebug: levelState.mysteryFruitDebug, activeFruitLayerIndex: Math.max(0, previewLayerIndex), countBarriers: normalizeCountBarrierElement(levelState.countBarrierElement).map((barrier) => ({ ...barrier, remainingCount: barrier.count })), tunnels: normalizeTunnelElement(levelState.tunnelElement), oneWays: normalizeOneWayElement(levelState.oneWayElement) }
        : null;
    elements.playableGridBoard.innerHTML = "";
    if (!level?.layer) return;
    applyVisualScaleConfig(elements.playableGridBoard);
    elements.playableGridBoard.style.gridTemplateColumns = `repeat(${level.grid.columns}, minmax(0, 1fr))`;
    const snakeParts = new Map((session?.snake.body ?? [])
      .filter((part, index) => !part.hiddenInTunnel && !(session?.tailDisabled && index > 0))
      .map((part, index) => [cellKey(part.x, part.y), { ...part, index }]));
    const boardTrays = session?.trays ?? entriesWithPosition(level.layer)
      .filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind))
      .map(createTrayRuntime);
    const traysByVisualKey = new Map(boardTrays.flatMap((tray) => tray.visualCells.map((visual) => [cellKey(visual.x, visual.y), {
      ...tray,
      visualRole: visual.role,
      visualCenter: visual.center,
      visualSlotIndex: visual.slotIndex
    }])));
    const traysByCheckpointKey = new Map(boardTrays.map((tray) => [tray.checkpointKey, tray]));
    const grassCells = session?.grassCells ?? levelState?.grassCells ?? {};
    const priorityPoints = session?.priorityPoints ?? levelState?.priorityPoints ?? {};
    const shovelTargetKeys = new Set(session?.status === PLAY_STATUS.SHOVEL_TARGETING ? session.shovel.targetKeys : []);
    const shovelTargeting = shovelTargetKeys.size > 0;
    for (let y = 0; y < level.grid.rows; y += 1) {
      for (let x = 0; x < level.grid.columns; x += 1) {
        const key = cellKey(x, y);
        const index = positionToIndex(x, y, level.grid.columns);
        const cellData = level.layer.cells[key] ?? { path: false, item: null };
        const countBarrier = level.countBarriers?.find((barrier) => barrier.index.includes(index));
        const tunnelEntry = tunnelEntryAtIndex(level.tunnels, index);
        const oneWayEntry = oneWayEntryAtIndex(level.oneWays, index);
        const lockedBarrier = countBarrier && countBarrier.remainingCount > 0;
        const barrierEndpoint = lockedBarrier && (countBarrier.startIndex === index || countBarrier.endIndex === index);
        const tray = traysByVisualKey.get(key);
        const checkpointTray = traysByCheckpointKey.get(key);
        const cell = document.createElement("div");
        const shovelClass = shovelTargeting && priorityPoints[key]
          ? shovelTargetKeys.has(key) ? " shovel-target" : " shovel-target-disabled"
          : "";
        cell.className = `grid-cell playable-cell${grassCells[key] ? " grass" : " terrain-empty"}${cellData.path ? " path" : ""}${priorityPoints[key] ? " priority-point" : ""}${shovelClass}${lockedBarrier ? " count-barrier-cell" : ""}${barrierEndpoint ? " count-barrier-endpoint" : ""}${tunnelEntry ? " tunnel-cell" : ""}${oneWayEntry ? " one-way-cell" : ""}${tray ? " tray-visual-cell" : ""}${checkpointTray ? " tray-checkpoint-cell" : ""}`;
        cell.dataset.cellIndex = String(index);
        if (tunnelEntry) cell.style.setProperty("--tunnel-color", tunnelColor(tunnelEntry.tunnel.tunnelId));
        if (oneWayEntry) cell.style.setProperty("--one-way-color", oneWayColor(oneWayEntry.oneWay.oneWayId));
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `Ô chơi Index ${index}`);
        if (isBridgeElement(cellData.element)) {
          const bridge = document.createElement("span");
          bridge.className = "bridge-preview bridge-joined";
          bridge.title = `Bridge Center #${index}`;
          for (let segment = 0; segment < 3; segment += 1) {
            const icon = document.createElement("span");
            icon.textContent = "🟰";
            bridge.appendChild(icon);
          }
          cell.appendChild(bridge);
        }
        if (isGateElement(cellData.element)) {
          const gate = document.createElement("span");
          gate.className = `gate-preview ${gateDirectionClass(cellData.element.direction)}`;
          gate.title = `Gate ${gateDirectionLabel(cellData.element.direction)}`;
          cell.appendChild(gate);
        }
        if (barrierEndpoint) {
          const barrier = document.createElement("span");
          barrier.className = "count-barrier-preview";
          barrier.title = `Count Barrier ${countBarrier.barrierId} · còn ${countBarrier.remainingCount}`;
          barrier.textContent = String(countBarrier.remainingCount);
          cell.appendChild(barrier);
        }
        if (tunnelEntry) {
          const tunnel = document.createElement("span");
          tunnel.className = `tunnel-preview ${tunnelDirectionClass(tunnelEntry.entryPoint.direction)}`;
          tunnel.style.setProperty("--tunnel-color", tunnelColor(tunnelEntry.tunnel.tunnelId));
          const symbol = document.createElement("span");
          symbol.className = "tunnel-symbol";
          symbol.textContent = tunnelDirectionIcon(tunnelEntry.entryPoint.direction);
          tunnel.appendChild(symbol);
          cell.appendChild(tunnel);
        }
        if (oneWayEntry) {
          const direction = oneWayEntry.entryPoint.direction;
          const oneWay = document.createElement("span");
          oneWay.className = `one-way-preview ${oneWayDirectionClass(direction)}`;
          oneWay.style.setProperty("--one-way-color", oneWayColor(oneWayEntry.oneWay.oneWayId));
          oneWay.textContent = oneWayDirectionIcon(direction);
          cell.appendChild(oneWay);
        }
        const hideLockedBarrierFruit = lockedBarrier && cellData.item?.kind === "fruit";
        if (cellData.item && !hideLockedBarrierFruit && !["tray", "truck"].includes(cellData.item.kind) && !(session && cellData.item.kind === "snake")) {
          const hiddenFruit = cellData.item.kind === "fruit"
            && isMysteryFruitAt(level, level.activeFruitLayerIndex ?? 0, index)
            && !level.mysteryFruitDebug;
          const icon = document.createElement("span");
          icon.className = `placed-icon ${cellData.item.kind}${hiddenFruit ? " mystery-fruit-preview" : ""}${temporaryItemOffsetClass(session, key)}`;
          if (cellData.item.kind === "fruit") applyBlockItemVisual(icon, cellData.item, { mystery: hiddenFruit });
          else icon.textContent = cellData.item.icon;
          cell.appendChild(icon);
        }
        if (tray) {
          const footprint = document.createElement("span");
          const layer = activeTrayLayer(tray);
          footprint.className = `tray-footprint ${tray.visualRole}${tray.visualCenter ? " center" : ""}${!layer ? " complete" : ""}`;
          if (tray.visualRole === "main") {
            const slot = trayLayerSlotDescriptors(layer)[tray.visualSlotIndex];
            if (slot) footprint.appendChild(createTrayRequirementSlot(slot));
            else if (tray.visualCenter) footprint.textContent = "✓";
          }
          cell.appendChild(footprint);
        }
        if (checkpointTray) {
          const checkpoint = document.createElement("span");
          checkpoint.className = `delivery-checkpoint${session?.delivery?.trayId === checkpointTray.id ? " active" : ""}`;
          checkpoint.title = `Checkpoint giao hàng cho khay tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, level.grid.columns)}`;
          checkpoint.textContent = "⭕";
          cell.appendChild(checkpoint);
        }
        if (session?.deliveryEffect?.checkpointKey === key) {
          const flyingFruit = document.createElement("span");
          flyingFruit.className = "delivery-flying-fruit";
          applyBlockItemVisual(flyingFruit, session.deliveryEffect);
          flyingFruit.dataset.effect = session.deliveryEffect.nonce;
          cell.appendChild(flyingFruit);
        }
        const snakePart = snakeParts.get(cellKey(x, y));
        if (snakePart) {
          const token = document.createElement("span");
          const tokenDirection = snakePart.direction ? ` dir-${snakePart.direction}` : "";
          token.className = `playable-token ${snakePart.index === 0 ? "head" : "cargo"}${tokenDirection}`;
          if (snakePart.index === 0) token.textContent = TRAIN_HEAD_ICON;
          else applyBlockItemVisual(token, snakePart);
          cell.appendChild(token);
        }
        elements.playableGridBoard.appendChild(cell);
      }
    }
    const fruitLayerMeta = session ? ` · fruit layer ${session.activeFruitLayerIndex + 1}/${session.fruitLayers.length}` : "";
    elements.playableGridMeta.textContent = `${level.grid.columns} × ${level.grid.rows}${fruitLayerMeta} · LevelState chung`;
    requestAnimationFrame(fitBoard);
  }

  function renderCargo() {
    const cargo = session?.snake.body.slice(1) ?? [];
    elements.playableCargoCount.textContent = String(cargo.length);
    elements.playableCargo.innerHTML = "";
    if (cargo.length === 0) {
      elements.playableCargo.innerHTML = '<span class="cargo-empty">Chưa thu thập trái cây</span>';
      return;
    }
    cargo.forEach((segment) => {
      const chip = document.createElement("span");
      chip.className = "cargo-chip";
      applyBlockItemVisual(chip, segment);
      chip.title = blockLabelForFruitType(segment.fruitType);
      elements.playableCargo.appendChild(chip);
    });
  }

  function renderTrays() {
    elements.playableTrayProgress.innerHTML = "";
    elements.playableTrayCount.textContent = String(session?.trays.length ?? 0);
    (session?.trays ?? []).forEach((tray, index) => {
      const complete = tray.activeIndex >= tray.layers.length;
      const layer = activeTrayLayer(tray);
      const card = document.createElement("div");
      card.className = `runtime-tray${complete ? " complete" : " active"}`;
      const head = document.createElement("div");
      head.innerHTML = `<strong>Khay #${String(index + 1).padStart(2, "0")}</strong><small>${complete ? "Hoàn thành" : `Layer ${tray.activeIndex + 1}/${tray.layers.length}`}</small>`;
      card.appendChild(head);
      const recipes = document.createElement("div");
      recipes.className = "tray-requirement-strip";
      renderTraySlotGrid(recipes, layer);
      recipes.title = trayLayerNeedTitle(layer);
      card.appendChild(recipes);
      elements.playableTrayProgress.appendChild(card);
    });
  }

  function renderShovelControl() {
    if (!elements.playableShovelBtn) return;
    const targeting = session?.status === PLAY_STATUS.SHOVEL_TARGETING;
    const validCount = session ? validShovelTargetKeys(session).length : 0;
    elements.playableShovelBtn.textContent = targeting ? "Hủy Xẻng" : `🪏 Xẻng ${SHOVEL_COUNT_LABEL}`;
    elements.playableShovelBtn.classList.toggle("active", targeting);
    elements.playableShovelBtn.disabled = !session || (!targeting && !canUseShovelBooster(session));
    elements.playableShovelBtn.title = isShovelRestoring(session)
      ? "Tail cần restore xong trước khi dùng Xẻng tiếp"
      : validCount === 0
      ? "Không có PriorityPoint hợp lệ để dùng Xẻng"
      : targeting ? "Hủy chọn target Xẻng" : "Chọn PriorityPoint để dịch chuyển Head";
  }

  function render() {
    const status = session?.status ?? PLAY_STATUS.BLOCKED;
    const [label, copy] = statusText(status);
    elements.playableStatusBadge.textContent = label;
    elements.playableStatusBadge.className = `play-status-badge ${status}`;
    elements.playableStatusCopy.textContent = copy;
    elements.playableBlocker.classList.toggle("hidden", validationErrors.length === 0);
    elements.playableBlocker.innerHTML = "";
    if (validationErrors.length) {
      const heading = document.createElement("strong");
      heading.textContent = "Level chưa hợp lệ";
      const list = document.createElement("ul");
      validationErrors.forEach((error) => {
        const item = document.createElement("li");
        item.textContent = error;
        list.appendChild(item);
      });
      elements.playableBlocker.append(heading, list);
    }
    const directions = session && [PLAY_STATUS.READY, PLAY_STATUS.WAITING, PLAY_STATUS.SHOVEL_AWAIT_DIRECTION].includes(session.status) ? availableDirections(session) : [];
    elements.playableDirectionHint.innerHTML = directions.length
      ? `<strong>Hướng hợp lệ:</strong> ${directions.map((direction) => DIRECTION_LABELS[direction]).join(" · ")}`
      : [PLAY_STATUS.MOVING, PLAY_STATUS.SHOVEL_RESTORE_TAIL].includes(status) ? "Rắn đang di chuyển; input mới sẽ bị bỏ qua." : "Không nhận input hướng ở trạng thái hiện tại.";
    elements.playModeSelect.value = session?.mode ?? elements.playModeSelect.value;
    updateSettingInputs();
    elements.playPauseBtn.textContent = status === PLAY_STATUS.PAUSED ? "Resume" : "Pause";
    elements.playPauseBtn.disabled = !session || [PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(status);
    elements.playModeSelect.disabled = !session;
    [elements.playTrainSpeedInput, elements.playTrayFillSpeedInput].forEach((input) => {
      if (input) input.disabled = !session;
    });
    elements.playableSettings?.querySelectorAll("[data-playable-setting]").forEach((button) => {
      button.disabled = !session;
    });
    elements.playableEndOverlay.classList.toggle("hidden", ![PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(status));
    if (status === PLAY_STATUS.WON) {
      elements.playableEndIcon.textContent = "🏆";
      elements.playableEndTitle.textContent = "Hoàn thành màn chơi";
      elements.playableEndCopy.textContent = "Tất cả khay chứa đã nhận đủ recipe.";
      if (elements.playReviveBtn) elements.playReviveBtn.classList.add("hidden");
      elements.playAgainBtn.textContent = "Chơi lại";
      elements.playAgainBtn.classList.remove("hidden");
      elements.exitPlayableBtn.textContent = "Về Editor";
    } else if (status === PLAY_STATUS.LOST) {
      elements.playableEndIcon.textContent = "💥";
      elements.playableEndTitle.textContent = "Bạn đã thua";
      elements.playableEndCopy.textContent = session.lastReason ?? "Rắn không thể tiếp tục di chuyển.";
      if (elements.playReviveBtn) {
        elements.playReviveBtn.classList.toggle("hidden", !session.reviveAvailable);
        elements.playReviveBtn.disabled = !session.reviveAvailable;
      }
      elements.playAgainBtn.textContent = "Restart";
      elements.playAgainBtn.classList.remove("hidden");
      elements.exitPlayableBtn.textContent = "Give Up";
    }
    renderBoard();
    renderCargo();
    renderTrays();
    renderShovelControl();
  }

  function scheduleNext() {
    clearTimer();
    if (!isActive || !session) return;
    if (session.status === PLAY_STATUS.DELIVERING) {
      timer = setTimeout(() => {
        deliverNextCargo(session);
        render();
        scheduleNext();
      }, playableSettingIntervalMs(session.trayFillSpeed));
      return;
    }
    if (![PLAY_STATUS.MOVING, PLAY_STATUS.SHOVEL_RESTORE_TAIL].includes(session.status)) return;
    timer = setTimeout(() => {
      movePlayableSession(session, session.snake.direction);
      render();
      scheduleNext();
    }, playableSettingIntervalMs(session.trainMoveSpeed));
  }

  function chooseDirection(direction) {
    if (!isActive || !session || ![PLAY_STATUS.READY, PLAY_STATUS.WAITING, PLAY_STATUS.SHOVEL_AWAIT_DIRECTION].includes(session.status)) return false;
    if (!availableDirections(session).includes(direction)) {
      if (directionBlockedBySelfCollision(session, direction)) {
        loseSession(session, "Đầu tàu tự đâm vào thân.", LOSE_REASON.SELF_COLLISION);
        clearTimer();
        render();
      }
      return false;
    }
    if (session.status === PLAY_STATUS.SHOVEL_AWAIT_DIRECTION) beginShovelTailRestore(session);
    session.status = isShovelRestoring(session) ? PLAY_STATUS.SHOVEL_RESTORE_TAIL : PLAY_STATUS.MOVING;
    movePlayableSession(session, direction);
    render();
    scheduleNext();
    return true;
  }

  function toggleShovelTargeting() {
    if (!isActive || !session) return false;
    if (session.status === PLAY_STATUS.SHOVEL_TARGETING) {
      cancelShovelTargeting(session, session.resumeStatus ?? PLAY_STATUS.WAITING);
      render();
      scheduleNext();
      return true;
    }
    if (![PLAY_STATUS.READY, PLAY_STATUS.MOVING, PLAY_STATUS.WAITING].includes(session.status) || !canUseShovelBooster(session)) return false;
    clearTimer();
    session.resumeStatus = session.status === PLAY_STATUS.MOVING ? PLAY_STATUS.MOVING : session.status;
    beginShovelTargeting(session);
    render();
    return true;
  }

  function confirmShovelTarget(index) {
    if (!session || session.status !== PLAY_STATUS.SHOVEL_TARGETING) return false;
    const targetKey = shovelTargetKeyFromIndex(session, index);
    if (!targetKey) return false;
    session.status = PLAY_STATUS.SHOVEL_TELEPORTING;
    if (!teleportWithShovel(session, targetKey)) return false;
    render();
    return true;
  }

  function revive() {
    if (!session || session.status !== PLAY_STATUS.LOST || !session.reviveAvailable) return false;
    clearTimer();
    session.status = PLAY_STATUS.REVIVING;
    render();
    const result = reviveSession(session, {
      onTrayLayerComplete(completedLayerCount) {
        const unlockedBarriers = decrementCountBarriers(session, completedLayerCount);
        removeUnlockedBarrierEndpointFruits(session, unlockedBarriers);
      },
      onAfterFill() {
        markFruitLayerClearIfNeeded(session);
      }
    });
    if (!result.revived) return false;
    session.lastReason = result.transferred > 0
      ? `Revive đã chuyển ${result.transferred}/${result.target} Fruit vào khay.`
      : "Revive không có Fruit phù hợp để chuyển vào khay.";
    session.delivery = null;
    session.deliveryEffect = null;
    if (allFruitLayersComplete(session) && allTraysComplete(session)) {
      session.status = PLAY_STATUS.WON;
    } else {
      session.status = session.snake.direction ? PLAY_STATUS.WAITING : PLAY_STATUS.READY;
      session.resumeStatus = session.status;
    }
    render();
    scheduleNext();
    return true;
  }

  function restart() {
    clearTimer();
    const levelState = currentLevelState();
    const report = validatePlayableLevel(levelState);
    validationErrors = report.errors;
    if (!report.valid) session = null;
    else session = createPlayableSession(levelState, { mode: elements.playModeSelect.value, ...playableSettings });
    render();
  }

  function togglePause() {
    if (!session || [PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(session.status)) return;
    if (session.status === PLAY_STATUS.PAUSED) {
      session.status = session.resumeStatus ?? PLAY_STATUS.WAITING;
      render();
      scheduleNext();
      return;
    }
    session.resumeStatus = session.status;
    session.status = PLAY_STATUS.PAUSED;
    clearTimer();
    render();
  }

  function enter() {
    isActive = true;
    restart();
  }

  function leave() {
    isActive = false;
    clearTimer();
    if (session && [PLAY_STATUS.READY, PLAY_STATUS.MOVING, PLAY_STATUS.DELIVERING, PLAY_STATUS.WAITING, PLAY_STATUS.SHOVEL_TARGETING, PLAY_STATUS.SHOVEL_AWAIT_DIRECTION, PLAY_STATUS.SHOVEL_RESTORE_TAIL].includes(session.status)) {
      session.resumeStatus = session.status;
      session.status = PLAY_STATUS.PAUSED;
      render();
    }
  }

  elements.playModeSelect.addEventListener("change", () => {
    if (!session) return;
    session.mode = elements.playModeSelect.value;
    elements.playModeSelect.blur();
    render();
  });
  elements.playableSettings?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-playable-setting]");
    if (!button || !session) return;
    applySettings(changePlayableSetting(playableSettings, button.dataset.playableSetting, Number(button.dataset.delta) || 0));
  });
  elements.playTrainSpeedInput?.addEventListener("change", () => {
    applySettings({ ...playableSettings, trainMoveSpeed: elements.playTrainSpeedInput.value });
  });
  elements.playTrayFillSpeedInput?.addEventListener("change", () => {
    applySettings({ ...playableSettings, trayFillSpeed: elements.playTrayFillSpeedInput.value });
  });
  elements.playTrainSpeedInput?.addEventListener("blur", updateSettingInputs);
  elements.playTrayFillSpeedInput?.addEventListener("blur", updateSettingInputs);
  elements.playTrainSpeedInput?.setAttribute("min", String(PLAYABLE_SETTING_LIMITS.trainMoveSpeed.min));
  elements.playTrainSpeedInput?.setAttribute("max", String(PLAYABLE_SETTING_LIMITS.trainMoveSpeed.max));
  elements.playTrainSpeedInput?.setAttribute("step", String(PLAYABLE_SETTING_LIMITS.trainMoveSpeed.step));
  elements.playTrayFillSpeedInput?.setAttribute("min", String(PLAYABLE_SETTING_LIMITS.trayFillSpeed.min));
  elements.playTrayFillSpeedInput?.setAttribute("max", String(PLAYABLE_SETTING_LIMITS.trayFillSpeed.max));
  elements.playTrayFillSpeedInput?.setAttribute("step", String(PLAYABLE_SETTING_LIMITS.trayFillSpeed.step));
  updateSettingInputs();
  elements.playPauseBtn.addEventListener("click", togglePause);
  elements.playRestartBtn.addEventListener("click", restart);
  elements.playReviveBtn?.addEventListener("click", revive);
  elements.playAgainBtn.addEventListener("click", restart);
  elements.playableShovelBtn?.addEventListener("click", toggleShovelTargeting);
  elements.exitPlayableBtn.addEventListener("click", onExitEditor);
  elements.playableGridBoard.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  elements.playableGridBoard.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      const cell = event.target.closest(".playable-cell");
      if (cell) confirmShovelTarget(Number(cell.dataset.cellIndex));
      return;
    }
    if (session?.status === PLAY_STATUS.SHOVEL_TARGETING) return;
    chooseDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  document.addEventListener("keydown", (event) => {
    if (!isActive || ["INPUT", "TEXTAREA"].includes(event.target?.tagName)) return;
    if (event.key === "Escape" && session?.status === PLAY_STATUS.SHOVEL_TARGETING) {
      event.preventDefault();
      cancelShovelTargeting(session, session.resumeStatus ?? PLAY_STATUS.WAITING);
      render();
      scheduleNext();
      return;
    }
    const direction = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" }[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    if (event.target?.tagName === "SELECT") event.target.blur();
    chooseDirection(direction);
  });
  new ResizeObserver(fitBoard).observe(elements.playableCanvasArea);

  return { enter, leave, restart, resize: fitBoard, chooseDirection, getSession: () => session };
}


// ---- js/app.js ----



































const byId = (id) => document.getElementById(id);
const elements = Object.fromEntries([
  "gridBoard", "boardWrap", "canvasArea", "mapWidthInput", "mapHeightInput", "gridMeta", "assetPalette", "assetCount",
  "zoomOutBtn", "zoomInBtn", "zoomResetBtn", "zoomValue",
  "layerSelect", "toggleActiveLayerVisibilityBtn", "mysteryFruitDebugBtn", "deleteActiveLayerBtn", "contextPanelTitle", "contextPanelSubtitle", "contextPanelCloseBtn", "trayPanel", "dataSummary", "validationList", "inspectorBody", "inspectorDetails",
  "undoBtn", "redoBtn", "activeToolBadge", "topbarEyebrow", "levelWorkspace", "playableWorkspace", "levelLayerPicker", "levelRightRail", "jsonFolderCard", "generateResultCard",
  "placeholderView", "placeholderIcon", "placeholderTitle", "placeholderCopy", "levelControls", "generateControls", "playableControls", "jsonControls", "levelActions", "generateActions", "jsonActions",
  "playableGridBoard", "playableBoardWrap", "playableCanvasArea", "playableGridMeta", "playableStatusBadge", "playableStatusCopy", "playableBlocker",
  "playModeSelect", "playableSettings", "playTrainSpeedInput", "playTrayFillSpeedInput", "playPauseBtn", "playRestartBtn", "playableShovelBtn", "playableDirectionHint", "playableCargoCount", "playableCargo",
  "playableTrayCount", "playableTrayProgress", "playableEndOverlay", "playableEndIcon", "playableEndTitle", "playableEndCopy", "playReviveBtn", "playAgainBtn", "exitPlayableBtn",
  "toast", "saveStatus", "fileInput", "newLevelBtn", "jsonImportBtn", "jsonDownloadBtn", "chooseFolderBtn", "reconnectFolderBtn", "refreshFolderBtn",
  "jsonFileNameInput", "levelValidityBadge", "levelValidationPopover", "folderStatus", "jsonFileList", "jsonPreview", "jsonValidationStatus", "jsonDirtyStatus",
  "generateValidateBtn", "generatePreviewBtn", "generateApplyBtn", "generateAndApplyBtn", "generateResetBtn", "generateSaveBtn", "generateExportBtn"
].map((id) => [id, byId(id)]));

const editor = new EditorState(loadSavedState());
const fileManager = new LevelFileManager();
const SELECTED_DATA_FILE_STORAGE_KEY = "railwaydash:lastSelectedDataFile";
const folderFileState = {
  directoryHandle: null,
  directoryName: "",
  permission: fileManager.supported ? "unknown" : "unsupported",
  files: [],
  selectedFileName: readSelectedDataFileName(),
  loading: false,
  error: null,
  scanId: 0
};
let folderFiles = [];
let fileDirty = editor.data.fileDirty ?? !editor.data.sourceFileName;
let activePaletteCategory = "item";
let generatePreviewState = null;
let generateLastResult = null;
let generateLastAppliedBackup = null;
const playable = createPlayableController({
  getLevel: () => editor.data,
  elements,
  onExitEditor: () => switchTab("level")
});
initPanelResizers();
const gridIndexTooltip = createGridIndexTooltip({
  grid: elements.gridBoard,
  getGrid: () => editor.data.grid,
  isEnabled: () => ["level", "generate", "json"].includes(editor.data.tab)
});
const editorCamera = new CameraController({
  onChange: updateZoomUi
});

function updateZoomUi() {
  if (elements.zoomValue) elements.zoomValue.textContent = `${Math.round(editorCamera.zoom * 100)}%`;
  if (elements.zoomOutBtn) elements.zoomOutBtn.disabled = editorCamera.zoom <= editorCamera.min;
  if (elements.zoomInBtn) elements.zoomInBtn.disabled = editorCamera.zoom >= editorCamera.max;
  if (elements.zoomResetBtn) elements.zoomResetBtn.disabled = Math.abs(editorCamera.zoom - 1) < 0.001;
  fitBoardToCanvas();
}

function switchTab(tab) {
  if (tab === "playable") gridIndexTooltip.hide();
  if (editor.data.tab === "playable" && tab !== "playable") playable.leave();
  activateTab(tab, editor.data, elements);
  if (tab === "playable") playable.enter();
  requestAnimationFrame(() => {
    fitBoardToCanvas();
    playable.resize();
  });
}

function hasPlacedObject(objectId) {
  return Object.values(editor.data.sharedCells ?? {}).some((cell) => cell.item?.id === objectId);
}

function fitBoardToCanvas() {
  const areaWidth = elements.canvasArea.clientWidth;
  const areaHeight = elements.canvasArea.clientHeight;
  if (!areaWidth || !areaHeight) return;

  const areaStyle = getComputedStyle(elements.canvasArea);
  const boardStyle = getComputedStyle(elements.boardWrap);
  const availableWidth = areaWidth - parseFloat(areaStyle.paddingLeft) - parseFloat(areaStyle.paddingRight);
  const availableHeight = areaHeight - parseFloat(areaStyle.paddingTop) - parseFloat(areaStyle.paddingBottom);
  const frameWidth = parseFloat(boardStyle.paddingLeft) + parseFloat(boardStyle.paddingRight)
    + parseFloat(boardStyle.borderLeftWidth) + parseFloat(boardStyle.borderRightWidth);
  const frameHeight = parseFloat(boardStyle.paddingTop) + parseFloat(boardStyle.paddingBottom)
    + parseFloat(boardStyle.borderTopWidth) + parseFloat(boardStyle.borderBottomWidth);
  const ratio = editor.data.grid.columns / editor.data.grid.rows;
  const widthFromHeight = Math.max(0, availableHeight - frameHeight) * ratio + frameWidth;
  const fittedWidth = Math.max(120, Math.min(790, availableWidth, widthFromHeight));

  const zoomedWidth = fittedWidth * editorCamera.zoom;
  elements.boardWrap.style.width = `${zoomedWidth}px`;
  elements.canvasArea.classList.toggle("map-zoomed", editorCamera.zoom > 1);
}

function loadSavedState() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { return deserializeEditorState(raw); }
        catch {
          const legacy = migrateLevel(JSON.parse(raw));
          return { grid: legacy.grid, sharedCells: legacy.sharedCells ?? {}, layers: legacy.layers, activeLayerId: legacy.activeLayerId ?? legacy.layers?.[0]?.id, selectedCell: null, activeTrayCell: null, selectedAssetId: "snake-start", tool: "path", eraseMode: "smart", tab: "level", fileName: "untitled-level.json", sourceFileName: null, fileDirty: true };
        }
      }
    } catch (error) {
      console.warn("Không thể đọc level đã lưu", error);
    }
  }
  return undefined;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeEditorState(editor.data)));
    elements.saveStatus.textContent = "Đã lưu";
  } catch (error) {
    elements.saveStatus.textContent = "Lỗi lưu";
    console.warn(error);
  }
}

function renderLayers() {
  reindexLayers(editor.data.layers);
  elements.layerSelect.innerHTML = "";
  editor.data.layers.forEach((layer, index) => {
    const option = document.createElement("option");
    option.value = layer.id;
    const fruitCount = Object.values(layer.cells ?? {}).filter((cell) => cell?.item?.kind === "fruit").length;
    const numLabel = String(index + 1).padStart(2, "0");
    option.textContent = `${numLabel} · ${layer.name} · ${fruitCount} fruit${layer.visible ? "" : " · Đang ẩn"}`;
    elements.layerSelect.appendChild(option);
  });
  elements.layerSelect.value = editor.data.activeLayerId;
  elements.toggleActiveLayerVisibilityBtn.textContent = editor.activeLayer.visible ? "◉" : "○";
  elements.toggleActiveLayerVisibilityBtn.title = editor.activeLayer.visible ? "Ẩn hoa quả của layer đang chọn" : "Hiện hoa quả của layer đang chọn";
  elements.mysteryFruitDebugBtn.classList.toggle("active", Boolean(editor.data.mysteryFruitDebug));
  elements.mysteryFruitDebugBtn.title = editor.data.mysteryFruitDebug ? "Tắt Debug Mystery Fruit" : "Bật Debug Mystery Fruit";
  elements.mysteryFruitDebugBtn.setAttribute("aria-pressed", String(Boolean(editor.data.mysteryFruitDebug)));
  elements.deleteActiveLayerBtn.disabled = editor.data.layers.length === 1;
}

function readSelectedDataFileName() {
  try { return localStorage.getItem(SELECTED_DATA_FILE_STORAGE_KEY); }
  catch { return null; }
}

function rememberSelectedDataFileName(fileName) {
  folderFileState.selectedFileName = fileName;
  try {
    if (fileName) localStorage.setItem(SELECTED_DATA_FILE_STORAGE_KEY, fileName);
    else localStorage.removeItem(SELECTED_DATA_FILE_STORAGE_KEY);
  } catch (error) {
    console.warn("Không thể lưu file data đang chọn", error);
  }
}

function renderValidation(layer) {
  const report = validateLevel(editor.data);
  const issues = [...report.errors, ...report.warnings];
  const summary = report.errors.length > 0
    ? `⚠ Level không hợp lệ — ${report.errors.length} lỗi`
    : report.warnings.length > 0
      ? `⚠ Level chưa hợp lệ — ${report.warnings.length} vấn đề`
      : "✓ Level hợp lệ";
  elements.validationList.innerHTML = `<div class="validation-row ${report.errors.length === 0 && report.warnings.length === 0 ? "ok" : "warn"}"><span>${issues.length === 0 ? "✓" : "⚠"}</span><span>${summary}</span></div>`
    + issues.map((message) => `<div class="validation-row warn"><span>•</span><span>${message}</span></div>`).join("");
  return report.stats;
}

function tunnelDraftBadge(draft) {
  if (!draft) return "Select Tunnel Point A";
  return {
    "direction-a": "Point A selected — Choose direction",
    "point-b": "Point A complete — Select Tunnel Point B",
    "direction-b": "Point B selected — Choose direction"
  }[draft.step] ?? "Select Tunnel Point A";
}

function oneWayDraftBadge(draft) {
  if (!draft) return "Select One Way Point A";
  return {
    "direction-a": "Point A selected — Choose direction",
    "point-b": "Point A complete — Select One Way Point B",
    "direction-b": "Point B selected — Choose direction"
  }[draft.step] ?? "Select One Way Point A";
}

function renderAll() {
  const layer = editor.activeLayer;
  editor.data.generateSettings = normalizeGenerateSettings(editor.data.generateSettings);
  const paletteObjects = objectsByCategory(activePaletteCategory);
  renderObjectPalette(elements.assetPalette, paletteObjects, editor.data.selectedAssetId, {
    emptyLabel: activePaletteCategory === "element" ? "Element sẽ được bổ sung ở bước tiếp theo." : `Chưa có ${activePaletteCategory}.`,
    unavailableIds: (hasPlacedObject("snake-start") || !isPlayerHeadLayer(editor.data)) ? ["snake-start"] : [],
    unavailableReasons: { "snake-start": hasPlacedObject("snake-start") ? "Đã có trên map" : "Chỉ đặt tại Layer 1" },
    bridgeAxis: editor.data.selectedBridgeAxis ?? 0,
    countBarrierCount: normalizeCountBarrierCount(editor.data.selectedCountBarrierCount)
  });
  document.querySelectorAll("[data-palette-tab]").forEach((button) => {
    const active = button.dataset.paletteTab === activePaletteCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  const gridState = editor.data.tab === "generate" && generatePreviewState ? generatePreviewState : editor.data;
  renderGrid(elements.gridBoard, gridState);
  renderLayers();
  if (editor.data.selectedCell) {
    elements.trayPanel.classList.add("inspector-mode");
    elements.contextPanelTitle.textContent = `Ô ${getSelectedCellIndex(editor.data)}`;
    elements.contextPanelSubtitle.textContent = "Chỉnh sửa nội dung tại ô đang chọn";
    elements.contextPanelCloseBtn.classList.remove("hidden");
    renderInspector(elements.trayPanel, editor.data);
  } else {
    elements.trayPanel.classList.remove("inspector-mode");
    elements.contextPanelTitle.textContent = "Khay chứa";
    elements.contextPanelSubtitle.textContent = "Hiển thị và setup layer của từng khay";
    elements.contextPanelCloseBtn.classList.add("hidden");
    renderTrayEditor(elements.trayPanel, editor.data);
  }
  elements.inspectorDetails.classList.add("hidden");
  const dataSummary = renderDataSummary(elements.dataSummary, editor.data);
  renderToolbar(editor, elements);
  if (editor.data.tool === "terrain") elements.activeToolBadge.textContent = findObject(editor.data.selectedAssetId)?.label ?? "Chỉnh terrain";
  else if (editor.data.tool === "item") elements.activeToolBadge.textContent = findObject(editor.data.selectedAssetId)?.label ?? "Đặt item";
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "mystery-fruit") elements.activeToolBadge.textContent = "Mystery Fruit";
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "count-barrier") {
    const activeId = Number.isInteger(editor.data.activeBarrierId) ? ` · Active ${editor.data.activeBarrierId}` : "";
    elements.activeToolBadge.textContent = `Count Barrier${activeId} · ${normalizeCountBarrierCount(editor.data.selectedCountBarrierCount)}`;
  }
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "tunnel") {
    const activeId = Number.isInteger(editor.data.activeTunnelId) ? ` · Active ${editor.data.activeTunnelId}` : "";
    elements.activeToolBadge.textContent = editor.data.tunnelDraft ? tunnelDraftBadge(editor.data.tunnelDraft) : `Tunnel${activeId || " · Select Point A"}`;
  }
  if (editor.data.tool === "item" && findObject(editor.data.selectedAssetId)?.kind === "one-way") {
    const activeId = Number.isInteger(editor.data.activeOneWayId) ? ` · Active ${editor.data.activeOneWayId}` : "";
    elements.activeToolBadge.textContent = editor.data.oneWayDraft ? oneWayDraftBadge(editor.data.oneWayDraft) : `One Way${activeId || " · Select Point A"}`;
  }
  renderValidation(layer);
  elements.mapWidthInput.value = String(editor.data.grid.columns);
  elements.mapHeightInput.value = String(editor.data.grid.rows);
  elements.gridMeta.textContent = `${editor.data.grid.columns} × ${editor.data.grid.rows} · ${layer.name} · chỉ hoa quả thay đổi`;
  if (editor.data.tab === "level") elements.topbarEyebrow.textContent = "Level Design / Layer fruit đang chọn";
  if (editor.data.tab === "generate") elements.topbarEyebrow.textContent = generatePreviewState ? "Sinh màn / Xem trước chưa áp dụng" : "Sinh màn / Tự động sinh vật phẩm";
  elements.boardWrap.classList.remove("hidden-layer");
  elements.assetCount.textContent = `${paletteObjects.length} ${activePaletteCategory}`;
  renderGenerateWorkspace();
  renderJsonWorkspace();
  requestAnimationFrame(fitBoardToCanvas);
  persist();
}

function mutate(mutator) {
  fileDirty = true;
  editor.data.fileDirty = true;
  return editor.mutate(mutator);
}

function clearGeneratePreview() {
  generatePreviewState = null;
  generateLastResult = null;
}

function renderJsonWorkspace() {
  editor.data.fileName = normalizeFileName(editor.data.fileName);
  if (document.activeElement !== elements.jsonFileNameInput) elements.jsonFileNameInput.value = editor.data.fileName;
  const report = validateLevel(editor.data);
  const documentData = serializeLevel(editor.data);
  elements.jsonPreview.textContent = stringifyJson(documentData);
  elements.jsonValidationStatus.textContent = report.valid
    ? (report.warnings.length ? `Hợp lệ · ${report.warnings.length} cảnh báo` : "Hợp lệ · sẵn sàng lưu")
    : `${report.errors.length} lỗi · vẫn có thể lưu`;
  elements.jsonDownloadBtn.disabled = false;
  byId("exportBtn").disabled = false;
  renderLevelValidityBadge(report);
  elements.jsonDirtyStatus.textContent = fileDirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ file";
  elements.jsonDirtyStatus.classList.toggle("clean", !fileDirty);
  elements.chooseFolderBtn.disabled = !fileManager.supported || folderFileState.loading;
  elements.chooseFolderBtn.textContent = fileManager.connected ? "Đổi thư mục" : "Mở thư mục";
  elements.refreshFolderBtn.disabled = !fileManager.connected || folderFileState.permission !== "granted" || folderFileState.loading;
  elements.reconnectFolderBtn.classList.toggle("hidden", !fileManager.connected || folderFileState.permission === "granted" || folderFileState.permission === "unknown");
  elements.reconnectFolderBtn.disabled = folderFileState.loading;
  elements.folderStatus.textContent = folderStatusText();
  renderFolderFiles();
}

function renderLevelValidityBadge(report) {
  if (!elements.levelValidityBadge || !elements.levelValidationPopover) return;
  const invalid = !report.valid;
  elements.levelValidityBadge.textContent = invalid ? "! Invalid" : "Valid";
  elements.levelValidityBadge.classList.toggle("valid", !invalid);
  elements.levelValidityBadge.classList.toggle("invalid", invalid);
  elements.levelValidityBadge.title = invalid ? "Level hiện đang có lỗi" : "Level hợp lệ";
  const issues = invalid ? report.errors : report.warnings;
  const summary = invalid
    ? `Level hiện đang có ${report.errors.length} lỗi`
    : report.warnings.length ? `Level hợp lệ, có ${report.warnings.length} cảnh báo` : "Level hợp lệ";
  const issueRows = issues.length
    ? issues.slice(0, 8).map((message) => `<li>${escapeHtml(message)}</li>`).join("")
    : "<li>Không có lỗi validation.</li>";
  const more = issues.length > 8 ? `<p>Còn ${issues.length - 8} mục khác trong panel Kiểm tra level.</p>` : "";
  elements.levelValidationPopover.innerHTML = `<strong>${summary}</strong><ul>${issueRows}</ul>${more}<button class="btn" type="button" data-show-validation-panel>Xem lỗi</button>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFolderFilePlayableStatus(file) {
  if (file.status === "invalid") return { valid: false, label: "JSON lỗi", errorMessage: file.errorMessage };
  if (file.status === "unreadable") return { valid: false, label: "Không đọc được", errorMessage: file.errorMessage };
  try {
    const level = deserializeLevel(file.data, { fileName: file.name });
    const report = validatePlayableLevel(level);
    return {
      valid: report.valid,
      label: report.valid ? "Hợp lệ" : "Không hợp lệ",
      errorMessage: report.valid ? null : report.errors[0]
    };
  } catch (error) {
    return { valid: false, label: "Không hợp lệ", errorMessage: error.message };
  }
}

function folderStatusText() {
  if (!fileManager.supported) return "Trình duyệt không hỗ trợ mở folder trực tiếp; vẫn có thể Nhập file và Tải xuống.";
  if (folderFileState.loading) return `Loading folder${folderFileState.directoryName ? ` ${folderFileState.directoryName}` : ""}...`;
  if (folderFileState.error) return folderFileState.error;
  if (!fileManager.connected) return "Chưa chọn thư mục. File mới sẽ được tải xuống.";
  if (folderFileState.permission === "prompt" || folderFileState.permission === "denied") return `${folderFileState.directoryName} · Cần cấp lại quyền để mở folder.`;
  if (folderFileState.permission === "unknown") return `${folderFileState.directoryName} · Đang kiểm tra quyền truy cập.`;
  const invalidCount = folderFiles.filter((file) => !getFolderFilePlayableStatus(file).valid).length;
  return `${folderFileState.directoryName} · ${folderFiles.length} file JSON${invalidCount ? ` · ${invalidCount} file lỗi` : ""}`;
}

function renderFolderFiles() {
  elements.jsonFileList.innerHTML = "";
  if (folderFileState.loading) {
    const loading = document.createElement("div");
    loading.className = "json-file-empty";
    loading.textContent = "Loading folder...";
    elements.jsonFileList.appendChild(loading);
    return;
  }
  if (fileManager.connected && folderFileState.permission !== "granted") {
    const reconnect = document.createElement("div");
    reconnect.className = "json-file-empty";
    reconnect.textContent = "Cần cấp lại quyền để mở folder.";
    elements.jsonFileList.appendChild(reconnect);
    return;
  }
  if (!fileManager.connected || folderFiles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "json-file-empty";
    empty.textContent = fileManager.connected ? "Thư mục chưa có file JSON." : "Chọn một thư mục để quản lý các level JSON đã có trên ổ đĩa.";
    elements.jsonFileList.appendChild(empty);
    return;
  }
  folderFiles.forEach((file) => {
    const playableStatus = getFolderFilePlayableStatus(file);
    const row = document.createElement("div");
    row.className = `json-file-row${editor.data.sourceFileName === file.name ? " active" : ""}${playableStatus.valid ? "" : " file-error"}`;
    row.dataset.fileName = file.name;
    const copy = document.createElement("div");
    copy.className = "json-file-copy";
    const title = document.createElement("strong");
    title.textContent = `${playableStatus.valid ? "" : "! "}${file.name}`;
    const meta = document.createElement("small");
    const updatedAt = file.lastModified ? new Date(file.lastModified).toLocaleString("vi-VN") : "Không rõ thời gian";
    meta.textContent = `${playableStatus.label} · ${Math.max(1, Math.ceil(file.size / 1024))} KB · ${updatedAt}`;
    if (playableStatus.errorMessage) meta.title = playableStatus.errorMessage;
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "json-file-actions";
    [["open", "Mở"], ["save", "Lưu đè"], ["rename", "Đổi tên"], ["delete", "Xóa"]].forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.fileAction = action; button.textContent = label;
      if (action === "delete") button.className = "danger";
      if (action === "open" && file.status !== "valid") {
        button.title = file.errorMessage ?? "File không thể mở vào editor.";
      }
      actions.appendChild(button);
    });
    row.append(copy, actions);
    elements.jsonFileList.appendChild(row);
  });
}

function showEraseFeedback(result) {
  if (result?.reason === "fruit-on-other-layer") {
    showNotification(elements.toast, "Ô này vẫn còn fruit ở layer khác. Chuyển sang layer đó để xóa fruit trước khi xóa đường đi.");
  }
}

let eraseChoiceMenu = null;
let directionPicker = null;

function hideEraseChoiceMenu() {
  eraseChoiceMenu?.remove();
  eraseChoiceMenu = null;
}

function showEraseChoiceMenu(position, targets) {
  hideEraseChoiceMenu();
  const cell = elements.gridBoard.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`);
  const rect = cell?.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "erase-choice-menu";
  menu.innerHTML = `<strong>XÓA TẠI INDEX ${positionToIndex(position.x, position.y, editor.data.grid.columns)}</strong>`;
  targets.forEach((target) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.eraseChoiceMode = target.mode;
    button.dataset.eraseChoiceX = String(position.x);
    button.dataset.eraseChoiceY = String(position.y);
    button.textContent = target.label;
    menu.appendChild(button);
  });
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.dataset.eraseChoiceCancel = "true";
  cancel.textContent = "Hủy";
  menu.appendChild(cancel);
  document.body.appendChild(menu);
  const left = rect ? rect.left + rect.width + 8 : window.innerWidth / 2;
  const top = rect ? rect.top : window.innerHeight / 2;
  menu.style.left = `${Math.min(left, window.innerWidth - menu.offsetWidth - 12)}px`;
  menu.style.top = `${Math.min(top, window.innerHeight - menu.offsetHeight - 12)}px`;
  eraseChoiceMenu = menu;
}

function directionLabel(type, step) {
  if (type === "gate") return "Gate Direction";
  const point = step?.endsWith("b") ? "B" : "A";
  return `${type === "tunnel" ? "Tunnel" : "One Way"} Point ${point}`;
}

function hideDirectionPicker({ force = false } = {}) {
  if (!directionPicker) return;
  if (!force && directionPicker.mode === "draft") return;
  directionPicker.element.remove();
  directionPicker = null;
}

function showDirectionPicker(type, position, { mode = "draft", id = null, entryIndex = 0, step = "direction-a" } = {}) {
  hideDirectionPicker({ force: true });
  const cell = elements.gridBoard.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`);
  const rect = cell?.getBoundingClientRect();
  const picker = document.createElement("div");
  picker.className = `direction-popover ${type}-direction-popover`;
  picker.dataset.directionPickerType = type;
  picker.dataset.directionPickerMode = mode;
  picker.dataset.directionPickerId = id ?? "";
  picker.dataset.directionPickerEntry = String(entryIndex);
  picker.innerHTML = `<strong>${directionLabel(type, step)}</strong>`;
  [
    ["0", "↑", "Up"],
    ["1", "↓", "Down"],
    ["2", "→", "Right"],
    ["3", "←", "Left"]
  ].forEach(([value, icon, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.floatingDirection = value;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.textContent = icon;
    picker.appendChild(button);
  });
  if (type !== "gate") {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "direction-popover-cancel";
    cancel.dataset.directionPickerCancel = type;
    cancel.textContent = "×";
    cancel.title = "Cancel";
    picker.appendChild(cancel);
  }
  document.body.appendChild(picker);
  const left = rect ? rect.left + rect.width + 8 : window.innerWidth / 2;
  const top = rect ? rect.top : window.innerHeight / 2;
  picker.style.left = `${Math.min(left, window.innerWidth - picker.offsetWidth - 12)}px`;
  picker.style.top = `${Math.min(top, window.innerHeight - picker.offsetHeight - 12)}px`;
  directionPicker = { element: picker, type, mode, id, entryIndex, position };
}

function eraseSmartAt(position) {
  hideEraseChoiceMenu();
  const result = mutate((state) => eraseAtPosition(state, position, "smart"));
  if (!result?.changed) {
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    return;
  }
  showEraseFeedback(result);
}

function eraseSelectAt(position) {
  const targets = getDeleteTargets(editor.data, position);
  if (targets.length === 0) {
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    return;
  }
  selectCell(editor.data, position.x, position.y);
  editor.notify();
  showEraseChoiceMenu(position, targets);
}

const input = new InputController({
  isEnabled: () => editor.data.tab === "level",
  canDrag: () => editor.data.tool !== "select" && !(editor.data.tool === "item" && ["tunnel", "one-way", "gate"].includes(findObject(editor.data.selectedAssetId)?.kind)),
  onStrokeStart: () => {
    editor.beginTransaction();
  },
  onStrokeEnd: () => {
    editor.endTransaction();
  },
  onCell(x, y, { eraseOverride = false } = {}) {
    const visualTray = Object.entries(editor.data.sharedCells ?? {}).map(([key, cell]) => {
      if (!["tray", "truck"].includes(cell.item?.kind)) return null;
      const [deliverX, deliverY] = key.split(",").map(Number);
      const hasVisualCell = getTrayVisualCells(cell.item, { x: deliverX, y: deliverY })
        .some((visual) => visual.x === x && visual.y === y);
      return hasVisualCell ? { x: deliverX, y: deliverY } : null;
    }).find(Boolean);
    const isDeleteFlow = eraseOverride || editor.data.tool === "erase";
    const routeVisualToTray = visualTray && !isDeleteFlow && editor.data.tool !== "terrain";
    if (routeVisualToTray && !eraseOverride && editor.data.tool !== "erase") {
      editor.data.tool = "select";
      selectCell(editor.data, visualTray.x, visualTray.y);
      editor.notify();
      return;
    }
    const targetX = routeVisualToTray ? visualTray.x : x;
    const targetY = routeVisualToTray ? visualTray.y : y;
    const clickedBarrier = findCountBarrierAtIndex(editor.data, positionToIndex(targetX, targetY, editor.data.grid.columns));
    if (clickedBarrier && !eraseOverride) {
      editor.data.activeBarrierId = clickedBarrier.barrierId;
      editor.data.selectedCountBarrierCount = normalizeCountBarrierCount(clickedBarrier.count);
    }
    const clickedTunnel = findTunnelAtIndex(editor.data, positionToIndex(targetX, targetY, editor.data.grid.columns));
    if (clickedTunnel && !eraseOverride && !editor.data.tunnelDraft && !editor.data.oneWayDraft && editor.data.tool !== "erase") {
      const clickedIndex = positionToIndex(targetX, targetY, editor.data.grid.columns);
      const entryIndex = clickedTunnel.entryPoints.findIndex((point) => point.index === clickedIndex);
      editor.data.activeTunnelId = clickedTunnel.tunnelId;
      selectCell(editor.data, targetX, targetY);
      editor.notify();
      showDirectionPicker("tunnel", { x: targetX, y: targetY }, { mode: "edit", id: clickedTunnel.tunnelId, entryIndex, step: entryIndex === 1 ? "direction-b" : "direction-a" });
      return;
    }
    const clickedOneWay = findOneWayAtIndex(editor.data, positionToIndex(targetX, targetY, editor.data.grid.columns));
    if (clickedOneWay && !eraseOverride && !editor.data.tunnelDraft && !editor.data.oneWayDraft && editor.data.tool !== "erase") {
      const clickedIndex = positionToIndex(targetX, targetY, editor.data.grid.columns);
      const entryIndex = clickedOneWay.entryPoints.findIndex((point) => point.index === clickedIndex);
      editor.data.activeOneWayId = clickedOneWay.oneWayId;
      selectCell(editor.data, targetX, targetY);
      editor.notify();
      showDirectionPicker("one-way", { x: targetX, y: targetY }, { mode: "edit", id: clickedOneWay.oneWayId, entryIndex, step: entryIndex === 1 ? "direction-b" : "direction-a" });
      return;
    }
    const clickedCell = getMergedCell(editor.data, targetX, targetY);
    const clickedTray = ["tray", "truck"].includes(clickedCell?.item?.kind);
    if (clickedTray && !eraseOverride && editor.data.tool !== "erase") {
      editor.data.tool = "select";
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else if (eraseOverride || editor.data.tool === "erase") {
      const activeEraseMode = editor.data.tool === "erase" ? (editor.data.eraseMode ?? "smart") : "smart";
      if (activeEraseMode === "smart") eraseSmartAt({ x: targetX, y: targetY });
      else if (activeEraseMode === "select") eraseSelectAt({ x: targetX, y: targetY });
      else showEraseFeedback(mutate((state) => eraseAtPosition(state, { x: targetX, y: targetY }, activeEraseMode)));
    } else if (editor.data.tool === "select" && !eraseOverride) {
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else {
      hideEraseChoiceMenu();
      const selectedObject = findObject(editor.data.selectedAssetId);
      const result = mutate((state) => applyTool(state, targetX, targetY, eraseOverride ? "smart-erase" : null));
      if (result?.reason === "unique-object-exists") {
        showNotification(elements.toast, "Map chỉ được có một đầu rắn. Hãy xóa đầu rắn hiện tại trước khi đặt lại.");
      } else if (result?.reason === "player-head-layer-locked") {
        showNotification(elements.toast, "Train Head chỉ được đặt hoặc xóa tại Layer 1.");
      } else if (result?.reason === "tray-visual-outside-grid") {
        showNotification(elements.toast, "Không thể đặt khay: footprint visual 3x4 nằm ngoài map.");
      } else if (result?.reason === "tray-checkpoint-needs-road") {
        showNotification(elements.toast, "Hãy vẽ đường trước, sau đó đặt khay trực tiếp lên checkpoint đó.");
      } else if (result?.reason === "gate-needs-path") {
        showNotification(elements.toast, "Gate chỉ được đặt trên Path.");
      } else if (result?.reason === "gate-needs-priority-point") {
        showNotification(elements.toast, "Gate phải đứng trước PriorityPoint.");
      } else if (result?.reason === "mystery-needs-fruit") {
        showNotification(elements.toast, "Mystery Fruit chỉ đánh dấu Fruit trong layer đang chọn.");
      } else if (result?.reason === "fruit-on-barrier-endpoint") {
        showNotification(elements.toast, "Không đặt Fruit tại 2 đầu Count Barrier. Hãy đặt Fruit ở ô giữa Barrier hoặc Path khác.");
      } else if (result?.reason === "barrier-needs-path") {
        showNotification(elements.toast, "Count Barrier chỉ có thể vẽ trên Path.");
      } else if (result?.reason === "tunnel-needs-path") {
        showNotification(elements.toast, "Tunnel chỉ có thể đặt trên Path.");
      } else if (result?.reason === "tunnel-needs-dead-end") {
        showNotification(elements.toast, "Tunnel chỉ được đặt tại Dead End.");
      } else if (result?.reason === "tunnel-same-point") {
        showNotification(elements.toast, "Point B không được trùng Point A.");
      } else if (result?.reason === "tunnel-overlap") {
        showNotification(elements.toast, "Ô này đã thuộc Tunnel khác.");
      } else if (result?.reason === "tunnel-needs-direction-a") {
        showNotification(elements.toast, "Chọn direction cho Point A trước.");
      } else if (result?.reason === "tunnel-needs-direction-b") {
        showNotification(elements.toast, "Chọn direction cho Point B trước.");
      } else if (result?.reason === "one-way-needs-path") {
        showNotification(elements.toast, "One Way chỉ có thể đặt trên Path.");
      } else if (result?.reason === "one-way-same-point") {
        showNotification(elements.toast, "Point B không được trùng Point A.");
      } else if (result?.reason === "one-way-overlap") {
        showNotification(elements.toast, "Ô này đã thuộc One Way khác.");
      } else if (result?.reason === "one-way-needs-direction-a") {
        showNotification(elements.toast, "Chọn direction cho Point A trước.");
      } else if (result?.reason === "one-way-needs-direction-b") {
        showNotification(elements.toast, "Chọn direction cho Point B trước.");
      } else if (result?.reason === "barrier-overlap") {
        showNotification(elements.toast, "Ô Path này đã thuộc một Count Barrier khác.");
      } else if (result?.reason === "tray-visual-occupied") {
        showNotification(elements.toast, "Footprint visual khay đang overlap dữ liệu khác.");
      } else if (["shared-position-occupied", "fruit-position-occupied"].includes(result?.reason)) {
        showNotification(elements.toast, "Ô này đã có object dùng chung hoặc fruit ở một layer khác.");
      } else if (result?.reason === "element-position-occupied") {
        showNotification(elements.toast, "Ô này đã có element khác.");
      } else if (result?.reason === "bridge-needs-crossroad") {
        showNotification(elements.toast, "Bridge chỉ được đặt tại ngã 4.");
      } else if (result?.reason === "bridge-outside-grid") {
        showNotification(elements.toast, "Bridge cần đủ 3 ô ngang.");
      } else if (result?.reason === "bridge-item-overlap") {
        showNotification(elements.toast, "Bridge không cho phép Item trong vùng 1 ô xung quanh.");
      } else if (result?.reason === "grass-on-path") {
        showNotification(elements.toast, "Grass không thể trùng Path. Hãy xóa Path trước.");
      } else if (result?.reason === "terrain-on-path") {
        showNotification(elements.toast, "Không thể chuyển ô Path thành Terrain trống. Hãy xóa Path trước.");
      } else if (result?.reason === "priority-needs-path") {
        showNotification(elements.toast, "PriorityPoint chỉ được đặt trên Path.");
      } else if (result?.action === "tunnel-point-a-selected") {
        showNotification(elements.toast, "Point A complete — Select Tunnel Point B");
      } else if (result?.action === "tunnel-point-b-selected") {
        showNotification(elements.toast, `Tunnel #${result.tunnelId} created`);
      } else if (result?.action === "one-way-point-a-selected") {
        showNotification(elements.toast, "Point A selected — Choose direction");
        showDirectionPicker("one-way", { x: targetX, y: targetY }, { mode: "draft", id: result.oneWayId, entryIndex: 0, step: "direction-a" });
      } else if (result?.action === "one-way-point-b-selected") {
        showNotification(elements.toast, "Point B selected — Choose direction");
        showDirectionPicker("one-way", { x: targetX, y: targetY }, { mode: "draft", id: result.oneWayId, entryIndex: 1, step: "direction-b" });
      } else showEraseFeedback(result);
    }
  },
  onShortcut({ key, shift }) {
    if (key === "z") shift ? editor.redo() : editor.undo();
    else if (key === "y") editor.redo();
    else if (["delete", "backspace"].includes(key) && editor.data.selectedCell) showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, "smart")));
    else if (["1", "2", "3", "4"].includes(key)) {
      editor.data.tool = ["path", "item", "select", "erase"][Number(key) - 1];
      editor.notify();
    }
  }
});
input.connect(elements.gridBoard);

document.querySelector(".tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (button) switchTab(button.dataset.tab);
});

function setGenerateSetting(key, value, type = "text") {
  const current = normalizeGenerateSettings(editor.data.generateSettings);
  const nextValue = type === "percent" ? Number(value) / 100 : value;
  editor.data.generateSettings = normalizeGenerateSettings({ ...current, [key]: nextValue });
  clearGeneratePreview();
  editor.notify();
}

function validateGenerateSourceOnly() {
  const source = analyzeGenerateSource(editor.data);
  generateLastResult = { ok: source.valid, source, settings: normalizeGenerateSettings(editor.data.generateSettings), issues: source.issues };
  renderAll();
  showNotification(elements.toast, source.valid ? "Nguồn sinh hợp lệ." : `Nguồn sinh có ${source.issues.length} lỗi.`);
  return source.valid;
}

function createGeneratePreviewResult({ silent = false } = {}) {
  const result = generatePreview(editor.data, editor.data.generateSettings);
  generateLastResult = result;
  generatePreviewState = result.ok ? result.preview : null;
  if (!result.ok) {
    editor.data.generationMeta = { ...(editor.data.generationMeta ?? {}), status: "Error" };
  }
  renderAll();
  if (!silent) {
    showNotification(elements.toast, result.ok ? `Đã tạo bản xem trước ${result.generatedItems.length} vật phẩm.` : `Sinh lỗi: ${result.issues[0]?.code ?? "GENERATION_FAILED"}`);
  }
  return result;
}

function applyGeneratePreviewResult() {
  if (!generatePreviewState) {
    showNotification(elements.toast, "Chưa có bản xem trước để áp dụng.");
    return false;
  }
  generateLastAppliedBackup = structuredClone(editor.data);
  const changed = mutate((state) => applyGeneratedPreview(state, generatePreviewState));
  if (!changed) return false;
  generatePreviewState = null;
  generateLastResult = { ok: true, source: analyzeGenerateSource(editor.data), settings: editor.data.generateSettings, issues: [], generatedItems: editor.data.generatedItems, meta: editor.data.generationMeta };
  renderAll();
  showNotification(elements.toast, "Đã áp dụng vật phẩm đã sinh vào màn hiện tại.");
  return true;
}

elements.generateControls.addEventListener("change", (event) => {
  const setting = event.target.closest("[data-generate-setting]");
  if (setting) setGenerateSetting(setting.dataset.generateSetting, setting.value, setting.dataset.settingType);
});

elements.generateControls.addEventListener("click", async (event) => {
  const preset = event.target.closest("[data-generate-preset]");
  if (preset) {
    editor.data.generateSettings = applyGeneratePreset(editor.data.generateSettings, preset.dataset.generatePreset);
    clearGeneratePreview();
    editor.notify();
    return;
  }
});

elements.generateValidateBtn.addEventListener("click", validateGenerateSourceOnly);
elements.generatePreviewBtn.addEventListener("click", () => createGeneratePreviewResult());
elements.generateApplyBtn.addEventListener("click", applyGeneratePreviewResult);
elements.generateAndApplyBtn.addEventListener("click", () => {
  const result = createGeneratePreviewResult({ silent: true });
  if (result.ok) applyGeneratePreviewResult();
  else showNotification(elements.toast, `Sinh lỗi: ${result.issues[0]?.code ?? "GENERATION_FAILED"}`);
});
elements.generateResetBtn.addEventListener("click", () => {
  const backup = generateLastAppliedBackup;
  if (!backup) {
    showNotification(elements.toast, "Chưa có lần áp dụng gần nhất để khôi phục.");
    return;
  }
  mutate((state) => resetGeneratedItems(state, backup));
  generateLastAppliedBackup = null;
  clearGeneratePreview();
  renderAll();
  showNotification(elements.toast, "Đã khôi phục vật phẩm về trước lần áp dụng gần nhất.");
});
elements.generateSaveBtn.addEventListener("click", downloadCurrentLevel);
elements.generateExportBtn.addEventListener("click", downloadCurrentLevel);

document.querySelector(".tool-list").addEventListener("click", (event) => {
  const eraseAction = event.target.closest("[data-erase-action]");
  if (eraseAction?.dataset.eraseAction === "all") {
    if (!confirm("Xóa toàn bộ đường đi, item và element trên tất cả layer? Hành động này có thể hoàn tác bằng Undo.")) return;
    const result = mutate(clearEntireMap);
    showNotification(elements.toast, result.changed ? `Đã xóa ${result.removedCells} ô dữ liệu trên toàn bộ map` : "Map hiện đang trống");
    return;
  }
  const eraseMode = event.target.closest("[data-erase-mode]");
  if (eraseMode) {
    editor.data.eraseMode = eraseMode.dataset.eraseMode;
    editor.data.tool = "erase";
    setEraseMenuExpanded(false);
    editor.notify();
    return;
  }
  const button = event.target.closest("[data-tool]");
  if (button && TOOL_LABELS[button.dataset.tool]) { editor.data.tool = button.dataset.tool; editor.notify(); }
});
const eraseToolMenu = document.querySelector(".erase-tool-menu");
const setEraseMenuExpanded = (expanded) => {
  eraseToolMenu.classList.toggle("open", expanded);
  byId("eraseToolBtn").setAttribute("aria-expanded", String(expanded));
};
byId("eraseToolBtn").addEventListener("click", (event) => {
  event.stopPropagation();
  editor.data.tool = "erase";
  setEraseMenuExpanded(byId("eraseToolBtn").getAttribute("aria-expanded") !== "true");
  editor.notify();
});
document.addEventListener("click", (event) => {
  if (!eraseToolMenu.contains(event.target)) setEraseMenuExpanded(false);
});
document.addEventListener("click", (event) => {
  const choice = event.target.closest("[data-erase-choice-mode]");
  if (choice) {
    const mode = choice.dataset.eraseChoiceMode;
    const position = { x: Number(choice.dataset.eraseChoiceX), y: Number(choice.dataset.eraseChoiceY) };
    hideEraseChoiceMenu();
    showEraseFeedback(mutate((state) => eraseAtPosition(state, position, mode)));
    return;
  }
  if (event.target.closest("[data-erase-choice-cancel]")) hideEraseChoiceMenu();
  else if (eraseChoiceMenu && !eraseChoiceMenu.contains(event.target)) hideEraseChoiceMenu();
});
document.addEventListener("click", (event) => {
  const direction = event.target.closest("[data-floating-direction]");
  if (direction && directionPicker?.element.contains(direction)) {
    const value = Number(direction.dataset.floatingDirection);
    const current = directionPicker;
    let result = null;
    if (current.type === "tunnel" && current.mode === "draft") {
      result = mutate((state) => setTunnelDraftDirection(state, value));
      if (result?.action === "tunnel-created") showNotification(elements.toast, `Tunnel #${result.tunnelId} created`);
      else if (result?.action === "tunnel-direction-a-selected") showNotification(elements.toast, "Point A complete — Select Tunnel Point B");
    } else if (current.type === "one-way" && current.mode === "draft") {
      result = mutate((state) => setOneWayDraftDirection(state, value));
      if (result?.action === "one-way-created") showNotification(elements.toast, `One Way #${result.oneWayId} created`);
      else if (result?.action === "one-way-direction-a-selected") showNotification(elements.toast, "Point A complete — Select One Way Point B");
    } else if (current.type === "tunnel") {
      mutate((state) => setTunnelEntryDirection(state, Number(current.id), Number(current.entryIndex), value));
      showNotification(elements.toast, "Đã cập nhật direction Tunnel.");
    } else if (current.type === "one-way") {
      mutate((state) => setOneWayEntryDirection(state, Number(current.id), Number(current.entryIndex), value));
      showNotification(elements.toast, "Đã cập nhật direction One Way.");
    } else if (current.type === "gate") {
      mutate((state) => {
        const key = `${current.position.x},${current.position.y}`;
        const element = state.sharedCells?.[key]?.element;
        if (!isGateElement(element)) return false;
        element.direction = normalizeGateDirection(value);
        state.selectedGateDirection = element.direction;
        state.selectedCell = { ...current.position };
        return true;
      });
      showNotification(elements.toast, "Đã chọn hướng Gate.");
    }
    hideDirectionPicker({ force: true });
    return;
  }
  const cancel = event.target.closest("[data-direction-picker-cancel]");
  if (cancel && directionPicker?.element.contains(cancel)) {
    const type = directionPicker.type;
    if (directionPicker.mode === "draft") {
      mutate(type === "tunnel" ? cancelTunnelDraft : cancelOneWayDraft);
      showNotification(elements.toast, type === "tunnel" ? "Đã hủy Tunnel Draft." : "Đã hủy One Way Draft.");
    }
    hideDirectionPicker({ force: true });
    return;
  }
  if (directionPicker && !directionPicker.element.contains(event.target)) hideDirectionPicker();
});
elements.assetPalette.addEventListener("click", (event) => {
  const bridgeAxis = event.target.closest("[data-bridge-axis]");
  if (bridgeAxis) editor.data.selectedBridgeAxis = normalizeBridgeAxis(bridgeAxis.dataset.bridgeAxis);
  const button = event.target.closest("[data-asset]");
  if (!button || !findObject(button.dataset.asset)) return;
  if (button.getAttribute("aria-disabled") === "true") {
    showNotification(elements.toast, "Item này đã đạt số lượng tối đa trên map.");
    return;
  }
  editor.data.selectedAssetId = button.dataset.asset;
  editor.data.tool = activePaletteCategory === "terrain" ? "terrain" : "item";
  editor.notify();
});
document.querySelector(".palette-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-palette-tab]");
  if (!button || button.dataset.paletteTab === activePaletteCategory) return;
  activePaletteCategory = button.dataset.paletteTab;
  renderAll();
});
function confirmResizeRemove() {
  return confirm("Khu vực này đang chứa dữ liệu.\n\nChọn OK để xóa và loại bỏ dữ liệu hoặc Cancel để hủy.");
}

document.querySelector(".dimension-card").addEventListener("click", (event) => {
  const edgeButton = event.target.closest("[data-map-resize-edge]");
  if (edgeButton) {
    const edge = edgeButton.dataset.mapResizeEdge;
    const delta = Number(edgeButton.dataset.delta);
    if (delta < 0 && hasDataOnResizeEdge(editor.data, edge) && !confirmResizeRemove()) return;
    const probe = resizeMapEdge(structuredClone(editor.data), edge, delta, { allowRemove: true });
    if (!probe.changed) {
      if (probe.reason === "limit") showNotification(elements.toast, "Kích thước map tối thiểu là 1 ô.");
      return;
    }
    const result = mutate((state) => resizeMapEdge(state, edge, delta, { allowRemove: true }));
    if (!result.changed && result.reason === "limit") showNotification(elements.toast, "Kích thước map tối thiểu là 1 ô.");
    return;
  }
  const button = event.target.closest("[data-map-dimension]");
  if (!button) return;
  const dimension = button.dataset.mapDimension;
  const next = editor.data.grid[dimension] + Number(button.dataset.delta);
  const result = changeMapDimension(structuredClone(editor.data), dimension, next);
  if (!result.changed && result.reason === "occupied" && !confirmResizeRemove()) return;
  if (!result.changed) return;
  mutate((state) => changeMapDimension(state, dimension, next, { allowRemove: true }));
});
[elements.mapWidthInput, elements.mapHeightInput].forEach((inputElement) => inputElement.addEventListener("change", () => {
  const dimension = inputElement === elements.mapWidthInput ? "columns" : "rows";
  const next = Math.max(1, Math.floor(Number(inputElement.value) || 1));
  const probe = changeMapDimension(structuredClone(editor.data), dimension, next);
  if (!probe.changed && probe.reason === "occupied") {
    if (confirmResizeRemove()) mutate((state) => changeMapDimension(state, dimension, next, { allowRemove: true }));
    else renderAll();
  }
  else if (probe.changed) mutate((state) => changeMapDimension(state, dimension, next, { allowRemove: true }));
  else renderAll();
}));
elements.layerSelect.addEventListener("change", () => {
  editor.data.activeLayerId = elements.layerSelect.value;
  editor.notify();
});
elements.toggleActiveLayerVisibilityBtn.addEventListener("click", () => mutate((state) => {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId);
  layer.visible = !layer.visible;
}));
elements.mysteryFruitDebugBtn.addEventListener("click", () => mutate((state) => {
  state.mysteryFruitDebug = !state.mysteryFruitDebug;
}));

function deleteActiveLayer() {
  if (editor.data.layers.length <= 1 || !confirm("Xóa layer fruit đang chọn và toàn bộ hoa quả trong layer này? Map, rắn và khay chứa sẽ được giữ nguyên.")) return;
  mutate((state) => {
    const deletedId = state.activeLayerId;
    const deletedIndex = state.layers.findIndex((layer) => layer.id === deletedId);
    const deletedLayerNumber = Number.isInteger(state.layers[deletedIndex]?.layer) ? state.layers[deletedIndex].layer : deletedIndex;
    state.mysteryFruitElement = (state.mysteryFruitElement ?? []).flatMap((entry) => {
      if (entry.layer === deletedLayerNumber) return [];
      return [{ ...entry, layer: entry.layer > deletedLayerNumber ? entry.layer - 1 : entry.layer }];
    });
    state.layers = state.layers.filter((layer) => layer.id !== deletedId);
    reindexLayers(state.layers);
    const nextIndex = Math.min(deletedIndex, state.layers.length - 1);
    state.activeLayerId = state.layers[Math.max(0, nextIndex)].id;
  });
}
elements.deleteActiveLayerBtn.addEventListener("click", deleteActiveLayer);
elements.contextPanelCloseBtn.addEventListener("click", () => {
  editor.data.selectedCell = null;
  editor.notify();
});

function selectedLayerNumber(state) {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId) ?? state.layers[0];
  return Number.isInteger(layer?.layer) ? layer.layer : Math.max(0, state.layers.indexOf(layer));
}

function placeInspectorElement(assetId) {
  if (!editor.data.selectedCell) return;
  const { x, y } = editor.data.selectedCell;
  const result = mutate((state) => {
    const previousTool = state.tool;
    const previousAsset = state.selectedAssetId;
    state.tool = "item";
    state.selectedAssetId = assetId;
    const placement = applyTool(state, x, y);
    state.tool = previousTool;
    state.selectedAssetId = previousAsset;
    return placement;
  });
  if (result?.reason === "gate-needs-path") showNotification(elements.toast, "Gate chỉ có thể đặt trên Path.");
  else if (result?.reason === "gate-needs-priority-point") showNotification(elements.toast, "Gate phải đứng trước PriorityPoint.");
  else if (result?.reason === "tunnel-needs-path") showNotification(elements.toast, "Tunnel chỉ có thể đặt trên Path.");
  else if (result?.reason === "tunnel-needs-dead-end") showNotification(elements.toast, "Tunnel chỉ được đặt tại Dead End.");
  else if (result?.reason === "tunnel-same-point") showNotification(elements.toast, "Point B không được trùng Point A.");
  else if (result?.reason === "tunnel-overlap") showNotification(elements.toast, "Ô này đã thuộc Tunnel khác.");
  else if (result?.reason === "tunnel-needs-direction-a") showNotification(elements.toast, "Chọn direction cho Point A trước.");
  else if (result?.reason === "tunnel-needs-direction-b") showNotification(elements.toast, "Chọn direction cho Point B trước.");
  else if (result?.reason === "one-way-needs-path") showNotification(elements.toast, "One Way chỉ có thể đặt trên Path.");
  else if (result?.reason === "one-way-same-point") showNotification(elements.toast, "Point B không được trùng Point A.");
  else if (result?.reason === "one-way-overlap") showNotification(elements.toast, "Ô này đã thuộc One Way khác.");
  else if (result?.reason === "one-way-needs-direction-a") showNotification(elements.toast, "Chọn direction cho Point A trước.");
  else if (result?.reason === "one-way-needs-direction-b") showNotification(elements.toast, "Chọn direction cho Point B trước.");
  else if (result?.reason === "element-position-occupied") showNotification(elements.toast, "Ô này đã có element khác.");
  else if (result?.reason === "bridge-needs-crossroad") showNotification(elements.toast, "Bridge chỉ được đặt tại ngã 4.");
  else if (result?.reason === "bridge-outside-grid") showNotification(elements.toast, "Bridge cần đủ 3 ô ngang.");
  else if (result?.reason === "bridge-item-overlap") showNotification(elements.toast, "Bridge không cho phép Item trong vùng 1 ô xung quanh.");
  else showNotification(elements.toast, `Đã thêm ${assetId === "gate" ? "Gate" : assetId === "count-barrier" ? "Count Barrier" : assetId === "tunnel" ? "Tunnel" : assetId === "one-way" ? "One Way" : "Bridge"}`);
}

function renderGenerateWorkspace() {
  if (!elements.generateControls || !elements.generateResultCard) return;
  renderGenerateControls(elements.generateControls, editor.data);
  renderGenerateResults(elements.generateResultCard, editor.data, generateLastResult);
  const hasPreview = Boolean(generatePreviewState);
  elements.generateApplyBtn.disabled = !hasPreview;
  elements.generateResetBtn.disabled = !generateLastAppliedBackup;
}

elements.trayPanel.addEventListener("click", (event) => {
  if (event.target.closest("[data-deselect-cell]")) {
    editor.data.selectedCell = null;
    editor.notify();
    return;
  }
  const bridgeAxis = event.target.closest("[data-inspector-bridge-axis]");
  if (bridgeAxis && editor.data.selectedCell) {
    mutate((state) => {
      const key = `${state.selectedCell.x},${state.selectedCell.y}`;
      const element = state.sharedCells?.[key]?.element;
      if (!isBridgeElement(element)) return false;
      element.axis = normalizeBridgeAxis(bridgeAxis.dataset.inspectorBridgeAxis);
      state.selectedBridgeAxis = element.axis;
      return true;
    });
    showNotification(elements.toast, `Bridge chuyển sang ${Number(bridgeAxis.dataset.inspectorBridgeAxis) === 1 ? "Vertical" : "Horizontal"}`);
    return;
  }
  const gateDirection = event.target.closest("[data-inspector-gate-direction]");
  if (gateDirection && editor.data.selectedCell) {
    mutate((state) => {
      const key = `${state.selectedCell.x},${state.selectedCell.y}`;
      const element = state.sharedCells?.[key]?.element;
      if (!isGateElement(element)) return false;
      element.direction = normalizeGateDirection(gateDirection.dataset.inspectorGateDirection);
      state.selectedGateDirection = element.direction;
      return true;
    });
    showNotification(elements.toast, `Đã đổi hướng Gate`);
    return;
  }
  const tunnelDraftDirection = event.target.closest("[data-inspector-tunnel-draft-direction]");
  if (tunnelDraftDirection) {
    const result = mutate((state) => setTunnelDraftDirection(state, Number(tunnelDraftDirection.dataset.inspectorTunnelDraftDirection)));
    if (result?.action === "tunnel-created") showNotification(elements.toast, `Tunnel #${result.tunnelId} created`);
    else if (result?.action === "tunnel-direction-a-selected") showNotification(elements.toast, "Point A complete — Select Tunnel Point B");
    else showNotification(elements.toast, "Không thể cập nhật Tunnel Draft.");
    return;
  }
  if (event.target.closest("[data-inspector-tunnel-draft-cancel]")) {
    mutate(cancelTunnelDraft);
    showNotification(elements.toast, "Đã hủy Tunnel Draft.");
    return;
  }
  const tunnelFocus = event.target.closest("[data-inspector-tunnel-focus]");
  if (tunnelFocus) {
    const tunnel = findTunnelById(editor.data, Number(tunnelFocus.dataset.inspectorTunnelFocus));
    const entry = tunnel?.entryPoints?.[Number(tunnelFocus.dataset.tunnelEntry)];
    if (!entry) return;
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    editor.data.activeTunnelId = tunnel.tunnelId;
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    return;
  }
  const tunnelMove = event.target.closest("[data-inspector-tunnel-move]");
  if (tunnelMove && editor.data.selectedCell) {
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    const changed = mutate((state) => setTunnelEntryIndex(
      state,
      Number(tunnelMove.dataset.inspectorTunnelMove),
      Number(tunnelMove.dataset.tunnelEntry),
      targetIndex
    ));
    showNotification(elements.toast, changed ? "Đã cập nhật vị trí Tunnel." : "Không thể đặt 2 entryPoint cùng một Index.");
    return;
  }
  const oneWayFocus = event.target.closest("[data-inspector-one-way-focus]");
  if (oneWayFocus) {
    const oneWay = findOneWayById(editor.data, Number(oneWayFocus.dataset.inspectorOneWayFocus));
    const entry = oneWay?.entryPoints?.[Number(oneWayFocus.dataset.oneWayEntry)];
    if (!entry) return;
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    editor.data.activeOneWayId = oneWay.oneWayId;
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    return;
  }
  const oneWayMove = event.target.closest("[data-inspector-one-way-move]");
  if (oneWayMove && editor.data.selectedCell) {
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    const changed = mutate((state) => setOneWayEntryIndex(
      state,
      Number(oneWayMove.dataset.inspectorOneWayMove),
      Number(oneWayMove.dataset.oneWayEntry),
      targetIndex
    ));
    showNotification(elements.toast, changed ? "Đã cập nhật vị trí One Way." : "Không thể đặt 2 entryPoint cùng một Index.");
    return;
  }
  if (event.target.closest("[data-inspector-mystery-toggle]") && editor.data.selectedCell) {
    mutate((state) => {
      const layerNumber = selectedLayerNumber(state);
      const { x, y } = state.selectedCell;
      const index = positionToIndex(x, y, state.grid.columns);
      const hidden = !isMysteryFruitAt(state, layerNumber, index);
      setMysteryFruitAt(state, layerNumber, index, hidden);
      return hidden;
    });
    showNotification(elements.toast, "Đã cập nhật Mystery Fruit");
    return;
  }
  const inspectorDelete = event.target.closest("[data-inspector-delete]");
  if (inspectorDelete && editor.data.selectedCell) {
    const mode = inspectorDelete.dataset.inspectorDelete;
    const label = mode === "mystery-fruit" ? "Mystery Fruit" : mode === "item" ? "Item" : mode === "tray" ? "Tray" : mode === "count-barrier" ? "Count Barrier" : mode === "tunnel" ? "Tunnel" : mode === "one-way" ? "One Way" : mode;
    if (mode === "tray" && !confirm("Xóa khay chứa tại ô đang chọn?")) return;
    if (mode === "tunnel") {
      const tunnel = findTunnelAtIndex(editor.data, positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns))
        ?? findTunnelById(editor.data, editor.data.activeTunnelId);
      if (tunnel) mutate((state) => removeTunnelById(state, tunnel.tunnelId));
    } else if (mode === "one-way") {
      const oneWay = findOneWayAtIndex(editor.data, positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns))
        ?? findOneWayById(editor.data, editor.data.activeOneWayId);
      if (oneWay) mutate((state) => removeOneWayById(state, oneWay.oneWayId));
    } else {
      showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, mode)));
    }
    showNotification(elements.toast, `Đã xóa ${label}`);
    return;
  }
  const newBarrier = event.target.closest("[data-inspector-count-barrier-new]");
  if (newBarrier) {
    mutate((state) => {
      createNewActiveCountBarrier(state);
      state.selectedAssetId = "count-barrier";
      state.tool = "item";
    });
    showNotification(elements.toast, `Đã tạo Barrier mới #${editor.data.activeBarrierId}`);
    return;
  }
  const removeBarrierCell = event.target.closest("[data-inspector-count-barrier-remove-cell]");
  if (removeBarrierCell && editor.data.selectedCell) {
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    const changed = mutate((state) => removeCountBarrierCell(state, Number(removeBarrierCell.dataset.inspectorCountBarrierRemoveCell), targetIndex));
    showNotification(elements.toast, changed ? "Đã xóa cell khỏi Barrier." : "Không thể xóa cell khỏi Barrier.");
    return;
  }
  const barrierStart = event.target.closest("[data-inspector-count-barrier-start]");
  const barrierEnd = event.target.closest("[data-inspector-count-barrier-end]");
  if ((barrierStart || barrierEnd) && editor.data.selectedCell) {
    const target = barrierStart ?? barrierEnd;
    const targetIndex = positionToIndex(editor.data.selectedCell.x, editor.data.selectedCell.y, editor.data.grid.columns);
    mutate((state) => {
      const barrier = findCountBarrierById(state, Number(target.dataset.inspectorCountBarrierStart ?? target.dataset.inspectorCountBarrierEnd));
      if (!barrier?.index.includes(targetIndex)) return false;
      const current = state.countBarrierElement.find((entry) => entry.barrierId === barrier.barrierId);
      if (!current) return false;
      if (barrierStart) current.startIndex = targetIndex;
      else current.endIndex = targetIndex;
      return true;
    });
    showNotification(elements.toast, barrierStart ? "Đã đặt startIndex cho Barrier." : "Đã đặt endIndex cho Barrier.");
    return;
  }
  const inspectorAdd = event.target.closest("[data-inspector-add]");
  if (inspectorAdd && !inspectorAdd.disabled) {
    placeInspectorElement(inspectorAdd.dataset.inspectorAdd);
    return;
  }
  if (event.target.closest("[data-tray-add-layer]")) {
    mutate(addTrayLayer);
    showNotification(elements.toast, "Đã thêm layer khay mới · recipe 0/9");
    return;
  }
  const recipeButton = event.target.closest("[data-recipe-step]");
  if (recipeButton) {
    const changed = mutate((state) => changeTrayLayerRecipe(
      state,
      Number(recipeButton.dataset.trayLayerIndex),
      recipeButton.dataset.fruitType,
      Number(recipeButton.dataset.recipeStep)
    ));
    if (!changed && Number(recipeButton.dataset.recipeStep) > 0) showNotification(elements.toast, "Layer đã đủ sức chứa 9/9");
    return;
  }
  const unknownButton = event.target.closest("[data-remove-unknown-item]");
  if (unknownButton) {
    if (!confirm(`Xóa Unknown #${unknownButton.dataset.removeUnknownItem} khỏi recipe?`)) return;
    mutate((state) => removeTrayLayerUnknownItem(state, Number(unknownButton.dataset.trayLayerIndex), unknownButton.dataset.removeUnknownItem));
    return;
  }
  const moveButton = event.target.closest("[data-tray-layer-move]");
  if (moveButton) {
    const fromIndex = Number(moveButton.dataset.trayLayerIndex);
    mutate((state) => moveTrayLayer(state, fromIndex, fromIndex + Number(moveButton.dataset.trayLayerMove)));
    return;
  }
  const deleteButton = event.target.closest("[data-tray-layer-delete]");
  if (deleteButton) {
    const layerIndex = Number(deleteButton.dataset.trayLayerIndex);
    const context = getSelectedTrayContext(editor.data);
    const recipe = context?.item?.trayLayers?.[layerIndex]?.recipe ?? {};
    const hasRecipe = Object.values(recipe).some((amount) => Number(amount) > 0);
    if (hasRecipe && !confirm(`Xóa Layer ${layerIndex + 1} và toàn bộ recipe đã setup?`)) return;
    mutate((state) => removeTrayLayer(state, layerIndex));
    return;
  }
  if (event.target.closest("[data-convert-truck]")) {
    mutate(convertLegacyTruckToTray);
    showNotification(elements.toast, "Đã chuyển xe cũ thành khay chứa sức chứa 9");
    return;
  }
  const blockOption = event.target.closest("[data-tray-block-option]");
  if (blockOption) {
    mutate((state) => setTrayLayerBlock(state, Number(blockOption.dataset.trayLayerIndex), blockOption.dataset.trayBlockOption));
    return;
  }
  const tray = event.target.closest("[data-tray-x]");
  if (!tray) return;
  editor.data.activeTrayCell = { x: Number(tray.dataset.trayX), y: Number(tray.dataset.trayY) };
  editor.data.selectedCell = null;
  editor.notify();
});
elements.trayPanel.addEventListener("change", (event) => {
  const activeTunnel = event.target.closest("[data-inspector-active-tunnel]");
  if (activeTunnel) {
    const tunnel = findTunnelById(editor.data, Number(activeTunnel.value));
    if (!tunnel) return;
    mutate((state) => { state.activeTunnelId = tunnel.tunnelId; });
    const entry = tunnel.entryPoints[0];
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    showNotification(elements.toast, `Đã chọn Tunnel #${tunnel.tunnelId}.`);
    return;
  }
  const activeOneWay = event.target.closest("[data-inspector-active-one-way]");
  if (activeOneWay) {
    const oneWay = findOneWayById(editor.data, Number(activeOneWay.value));
    if (!oneWay) return;
    mutate((state) => { state.activeOneWayId = oneWay.oneWayId; });
    const entry = oneWay.entryPoints[0];
    const position = indexToPosition(entry.index, editor.data.grid.columns);
    selectCell(editor.data, position.x, position.y);
    editor.notify();
    showNotification(elements.toast, `Đã chọn One Way #${oneWay.oneWayId}.`);
    return;
  }
  const tunnelDirection = event.target.closest("[data-inspector-tunnel-direction]");
  if (tunnelDirection) {
    const changed = mutate((state) => setTunnelEntryDirection(
      state,
      Number(tunnelDirection.dataset.inspectorTunnelDirection),
      Number(tunnelDirection.dataset.tunnelEntry),
      Number(tunnelDirection.value)
    ));
    if (changed) showNotification(elements.toast, "Đã cập nhật direction Tunnel.");
    return;
  }
  const oneWayDirection = event.target.closest("[data-inspector-one-way-direction]");
  if (oneWayDirection) {
    const changed = mutate((state) => setOneWayDirection(
      state,
      Number(oneWayDirection.dataset.inspectorOneWayDirection),
      Number(oneWayDirection.value)
    ));
    if (changed) showNotification(elements.toast, "Đã cập nhật direction One Way.");
    return;
  }
  const barrierCount = event.target.closest("[data-inspector-count-barrier-count]");
  if (barrierCount) {
    mutate((state) => {
      const barrier = state.countBarrierElement.find((entry) => entry.barrierId === Number(barrierCount.dataset.inspectorCountBarrierCount));
      if (!barrier) return false;
      barrier.count = normalizeCountBarrierCount(barrierCount.value);
      state.selectedCountBarrierCount = barrier.count;
      return true;
    });
    showNotification(elements.toast, "Đã cập nhật count của Barrier.");
    return;
  }
  const trayPositionInput = event.target.closest("[data-tray-position-index]");
  if (trayPositionInput) {
    const result = mutate((state) => setTrayVisualIndex(state, trayPositionInput.value));
    if (["outside-grid", "tray-position-outside-grid"].includes(result?.reason)) showNotification(elements.toast, "Index trayPosition nằm ngoài map.");
    else if (result?.reason === "deliver-point-outside-grid") showNotification(elements.toast, "deliverPoint tự động nằm ngoài map.");
    else if (result?.reason === "footprint-outside-grid") showNotification(elements.toast, "Footprint Tray 3x4 vượt ngoài map.");
    else if (result?.reason === "deliver-point-occupied") showNotification(elements.toast, "deliverPoint mới đang có item khác.");
    return;
  }
  const trayDeliverInput = event.target.closest("[data-tray-deliver-point-index]");
  if (trayDeliverInput) {
    const result = mutate((state) => setTrayDeliverPointIndex(state, trayDeliverInput.value));
    if (["outside-grid", "deliver-point-outside-grid"].includes(result?.reason)) showNotification(elements.toast, "Index deliverPoint nằm ngoài map.");
    else if (result?.reason === "tray-position-outside-grid") showNotification(elements.toast, "trayPosition tự động nằm ngoài map.");
    else if (result?.reason === "footprint-outside-grid") showNotification(elements.toast, "Footprint Tray 3x4 vượt ngoài map.");
    else if (result?.reason === "deliver-point-occupied") showNotification(elements.toast, "deliverPoint mới đang có item khác.");
    return;
  }
  const amountInput = event.target.closest("[data-tray-layer-amount]");
  if (amountInput) {
    mutate((state) => setTrayLayerAmount(state, Number(amountInput.dataset.trayLayerIndex), amountInput.value));
  }
});

elements.trayPanel.addEventListener("input", (event) => {
  const amountInput = event.target.closest("[data-tray-layer-amount]");
  if (!amountInput) return;
  mutate((state) => setTrayLayerAmount(state, Number(amountInput.dataset.trayLayerIndex), amountInput.value));
});

let draggedTrayLayerIndex = null;
elements.trayPanel.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-tray-layer-index]");
  if (!card || event.target.closest("button, select, input, summary, .tray-block-dropdown")) return;
  draggedTrayLayerIndex = Number(card.dataset.trayLayerIndex);
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
});
elements.trayPanel.addEventListener("dragover", (event) => {
  if (draggedTrayLayerIndex === null || !event.target.closest("[data-tray-layer-index]")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
});
elements.trayPanel.addEventListener("drop", (event) => {
  const card = event.target.closest("[data-tray-layer-index]");
  if (!card || draggedTrayLayerIndex === null) return;
  event.preventDefault();
  const targetIndex = Number(card.dataset.trayLayerIndex);
  mutate((state) => moveTrayLayer(state, draggedTrayLayerIndex, targetIndex));
  draggedTrayLayerIndex = null;
});
elements.trayPanel.addEventListener("dragend", () => {
  draggedTrayLayerIndex = null;
  elements.trayPanel.querySelectorAll(".dragging").forEach((card) => card.classList.remove("dragging"));
});

function addLayer() {
  mutate((state) => {
    reindexLayers(state.layers);
    const nextNumber = state.layers.length;
    const layer = createLayer(nextNumber);
    state.layers.push(layer);
    state.activeLayerId = layer.id;
  });
  showNotification(elements.toast, "Đã thêm layer fruit · map dùng chung được giữ nguyên");
}
byId("addLayerBtn").addEventListener("click", addLayer);
elements.undoBtn.addEventListener("click", () => { editor.undo(); fileDirty = true; editor.data.fileDirty = true; renderAll(); });
elements.redoBtn.addEventListener("click", () => { editor.redo(); fileDirty = true; editor.data.fileDirty = true; renderAll(); });
elements.zoomOutBtn.addEventListener("click", () => editorCamera.zoomOut());
elements.zoomInBtn.addEventListener("click", () => editorCamera.zoomIn());
elements.zoomResetBtn.addEventListener("click", () => editorCamera.reset());
byId("backToLevelBtn").addEventListener("click", () => { switchTab("level"); renderAll(); });
elements.inspectorBody.addEventListener("click", (event) => {
  const capacity = event.target.closest("[data-capacity-step]");
  if (capacity) mutate((state) => changeSelectedTruckCapacity(state, Number(capacity.dataset.capacityStep)));
  else if (event.target.closest("#togglePathBtn")) mutate((state) => togglePathAt(state, state.selectedCell));
  else if (event.target.closest("#deleteCellBtn")) showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, "smart")));
});
elements.inspectorBody.addEventListener("change", (event) => {
  const bridgeAxis = event.target.closest("[data-bridge-axis]");
  if (!bridgeAxis || !editor.data.selectedCell) return;
  mutate((state) => {
    const key = `${state.selectedCell.x},${state.selectedCell.y}`;
    const element = state.sharedCells?.[key]?.element;
    if (bridgeAxis && isBridgeElement(element)) {
      element.axis = normalizeBridgeAxis(bridgeAxis.value);
      state.selectedBridgeAxis = element.axis;
    }
  });
});
function canReplaceCurrentLevel() {
  return !fileDirty || confirm("Level hiện tại có thay đổi chưa lưu hoặc chưa tải xuống. Thay toàn bộ level hiện tại?");
}

async function downloadCurrentLevel() {
  const report = validateLevel(editor.data);
  editor.data.fileName = normalizeFileName(elements.jsonFileNameInput.value || editor.data.fileName);
  const documentData = serializeLevel(editor.data);
  const invalidSuffix = report.valid ? "" : ` · Level hiện có ${report.errors.length} lỗi`;
  if (fileManager.connected && folderFileState.permission === "granted") {
    try {
      await fileManager.write(editor.data.fileName, documentData);
      editor.data.sourceFileName = editor.data.fileName;
      fileDirty = false;
      editor.data.fileDirty = false;
      rememberSelectedDataFileName(editor.data.fileName);
      await scanFolder();
      renderAll();
      showNotification(elements.toast, `Đã lưu ${editor.data.fileName} vào ${folderFileState.directoryName}${invalidSuffix}.`);
      return;
    } catch (error) {
      showNotification(elements.toast, `Không thể lưu vào folder: ${error.message}`);
      return;
    }
  }
  if (fileManager.connected && folderFileState.permission !== "granted") {
    showNotification(elements.toast, "Cần Reconnect folder trước khi lưu vào folder đang mở.");
    return;
  }
  downloadJson(documentData, editor.data.fileName);
  editor.data.sourceFileName = null;
  fileDirty = false;
  editor.data.fileDirty = false;
  renderAll();
  showNotification(elements.toast, `Đã tải xuống ${editor.data.fileName}${invalidSuffix}`);
}

function openImportedData(raw, fileName) {
  const data = deserializeLevel(raw, { fileName });
  editor.history.clear();
  fileDirty = false;
  data.fileDirty = false;
  clearGeneratePreview();
  generateLastAppliedBackup = null;
  editor.replace(data);
  switchTab("level");
  const report = validateLevel(data);
  renderAll();
  showNotification(elements.toast, report.exportable ? `Đã mở ${fileName}` : `Đã mở ${fileName} · có ${report.warnings.length} lỗi cần sửa`);
}

function openFolderDataEntry(entry) {
  if (!entry || entry.status !== "valid") {
    showNotification(elements.toast, `Không thể mở file: ${entry?.errorMessage ?? "File JSON không hợp lệ."}`);
    return false;
  }
  openImportedData(entry.data, entry.name);
  rememberSelectedDataFileName(entry.name);
  return true;
}

byId("exportBtn").addEventListener("click", downloadCurrentLevel);
elements.jsonDownloadBtn.addEventListener("click", downloadCurrentLevel);
const requestImport = () => { if (canReplaceCurrentLevel()) elements.fileInput.click(); };
byId("importBtn").addEventListener("click", requestImport);
elements.jsonImportBtn.addEventListener("click", requestImport);
elements.fileInput.addEventListener("change", async () => {
  try {
    const file = elements.fileInput.files[0];
    if (file) openImportedData(await readJsonFile(file), file.name);
  } catch (error) { showNotification(elements.toast, `Không thể nhập: ${error.message}`); }
  elements.fileInput.value = "";
});

elements.jsonFileNameInput.addEventListener("change", () => {
  editor.data.fileName = normalizeFileName(elements.jsonFileNameInput.value);
  elements.jsonFileNameInput.value = editor.data.fileName;
  fileDirty = true;
  editor.data.fileDirty = true;
  renderAll();
});
elements.levelValidityBadge.addEventListener("click", (event) => {
  event.stopPropagation();
  const hidden = elements.levelValidationPopover.classList.toggle("hidden");
  elements.levelValidityBadge.setAttribute("aria-expanded", String(!hidden));
});
elements.levelValidationPopover.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!event.target.closest("[data-show-validation-panel]")) return;
  elements.levelValidationPopover.classList.add("hidden");
  elements.levelValidityBadge.setAttribute("aria-expanded", "false");
  switchTab("level");
  const validationDetails = document.querySelector(".validation-details");
  if (validationDetails) {
    validationDetails.open = true;
    validationDetails.scrollIntoView({ block: "nearest" });
  }
});
document.addEventListener("click", () => {
  elements.levelValidationPopover.classList.add("hidden");
  elements.levelValidityBadge.setAttribute("aria-expanded", "false");
});

elements.newLevelBtn.addEventListener("click", () => {
  if (!canReplaceCurrentLevel()) return;
  editor.history.clear();
  fileDirty = true;
  clearGeneratePreview();
  generateLastAppliedBackup = null;
  editor.replace(createInitialState());
  renderAll();
});

function applyFolderHandle(handle) {
  folderFileState.directoryHandle = handle ?? null;
  folderFileState.directoryName = handle?.name ?? "";
  fileManager.setDirectory(handle);
}

async function restoreSelectedFolderFile({ askBeforeReplace = false } = {}) {
  const selectedName = folderFileState.selectedFileName ?? readSelectedDataFileName();
  if (!selectedName) return false;
  const entry = folderFiles.find((file) => file.name === selectedName);
  if (!entry) {
    rememberSelectedDataFileName(null);
    return false;
  }
  if (entry.status !== "valid") return false;
  if (fileDirty) {
    if (!askBeforeReplace) return false;
    if (!canReplaceCurrentLevel()) return false;
  }
  return openFolderDataEntry(entry);
}

async function scanFolder({ restoreSelected = false, askBeforeReplace = false } = {}) {
  if (!fileManager.connected) return;
  const scanId = folderFileState.scanId + 1;
  folderFileState.scanId = scanId;
  folderFileState.loading = true;
  folderFileState.error = null;
  renderAll();
  try {
    const files = await fileManager.listFiles({ isCurrent: () => folderFileState.scanId === scanId });
    if (files === null || folderFileState.scanId !== scanId) return;
    folderFiles = files;
    folderFileState.files = files;
    folderFileState.permission = "granted";
    folderFileState.loading = false;
    folderFileState.error = null;
    renderAll();
    if (restoreSelected) await restoreSelectedFolderFile({ askBeforeReplace });
  } catch (error) {
    if (folderFileState.scanId !== scanId) return;
    folderFiles = [];
    folderFileState.files = [];
    folderFileState.loading = false;
    if (error.name === "NotAllowedError") {
      folderFileState.permission = "denied";
      folderFileState.error = `${folderFileState.directoryName} · Cần cấp lại quyền để mở folder.`;
    } else if (error.name === "NotFoundError") {
      folderFileState.permission = "denied";
      folderFileState.error = "Không thể truy cập folder đã lưu. Folder có thể đã bị di chuyển, đổi tên hoặc xóa.";
      fileManager.forgetDirectory().catch((storageError) => console.warn("Không thể xóa folder handle đã lưu", storageError));
      applyFolderHandle(null);
    } else {
      folderFileState.error = `Không thể truy cập folder: ${error.message}`;
    }
    renderAll();
  }
}

elements.chooseFolderBtn.addEventListener("click", async () => {
  try {
    const handle = await fileManager.chooseDirectory();
    applyFolderHandle(handle);
    folderFiles = [];
    folderFileState.files = [];
    folderFileState.permission = "granted";
    folderFileState.error = null;
    await scanFolder({ restoreSelected: true, askBeforeReplace: true });
  }
  catch (error) { if (error.name !== "AbortError") showNotification(elements.toast, error.message); }
});
elements.reconnectFolderBtn.addEventListener("click", async () => {
  try {
    folderFileState.loading = true;
    folderFileState.error = null;
    renderAll();
    folderFileState.permission = await fileManager.requestPermission();
    folderFileState.loading = false;
    if (folderFileState.permission === "granted") await scanFolder({ restoreSelected: true, askBeforeReplace: true });
    else {
      folderFileState.error = `${folderFileState.directoryName} · Người dùng chưa cấp quyền truy cập folder.`;
      renderAll();
    }
  } catch (error) {
    folderFileState.loading = false;
    folderFileState.error = `Không thể reconnect folder: ${error.message}`;
    renderAll();
  }
});
elements.refreshFolderBtn.addEventListener("click", () => scanFolder({ restoreSelected: true, askBeforeReplace: false }));

elements.jsonFileList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-file-action]");
  const row = event.target.closest("[data-file-name]");
  if (!button || !row) return;
  const name = row.dataset.fileName;
  try {
    if (button.dataset.fileAction === "open") {
      const entry = folderFiles.find((file) => file.name === name);
      if (entry?.status !== "valid") {
        showNotification(elements.toast, `Không thể mở ${name}: ${entry?.errorMessage ?? "File JSON không hợp lệ."}`);
        return;
      }
      if (!canReplaceCurrentLevel()) return;
      openFolderDataEntry(entry ?? { name, data: await fileManager.read(name), status: "valid" });
    } else if (button.dataset.fileAction === "save") {
      if (!confirm(`Lưu đè toàn bộ nội dung hiện tại vào ${name}?`)) return;
      const report = validateLevel(editor.data);
      await fileManager.write(name, serializeLevel(editor.data));
      editor.data.fileName = name; editor.data.sourceFileName = name; fileDirty = false;
      editor.data.fileDirty = false;
      rememberSelectedDataFileName(name);
      await scanFolder();
      showNotification(elements.toast, report.valid ? `Đã lưu đè ${name}` : `Đã lưu đè ${name} · Level hiện có ${report.errors.length} lỗi`);
    } else if (button.dataset.fileAction === "rename") {
      const proposed = prompt("Tên file mới:", name);
      if (!proposed) return;
      const nextName = normalizeFileName(proposed);
      if (!confirm(`Đổi tên ${name} thành ${nextName}?`)) return;
      if (folderFiles.some((file) => file.name === nextName)) return showNotification(elements.toast, `${nextName} đã tồn tại.`);
      await fileManager.rename(name, nextName);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = nextName; editor.data.fileName = nextName; }
      if (folderFileState.selectedFileName === name) rememberSelectedDataFileName(nextName);
      await scanFolder(); showNotification(elements.toast, `Đã đổi tên thành ${nextName}`);
    } else if (button.dataset.fileAction === "delete") {
      if (!confirm(`Xóa vĩnh viễn file ${name} khỏi ổ đĩa?`)) return;
      await fileManager.remove(name);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = null; fileDirty = true; editor.data.fileDirty = true; }
      if (folderFileState.selectedFileName === name) rememberSelectedDataFileName(null);
      await scanFolder(); showNotification(elements.toast, `Đã xóa ${name}`);
    }
  } catch (error) { showNotification(elements.toast, `Không thể thao tác file: ${error.message}`); }
});

async function restoreSavedFolder() {
  if (!fileManager.supported) {
    folderFileState.permission = "unsupported";
    renderAll();
    return;
  }
  try {
    const handle = await fileManager.restoreDirectory();
    if (!handle) return;
    applyFolderHandle(handle);
    folderFileState.permission = await fileManager.queryPermission();
    renderAll();
    if (folderFileState.permission === "granted") await scanFolder({ restoreSelected: true, askBeforeReplace: false });
  } catch (error) {
    folderFileState.permission = fileManager.connected ? "denied" : "unknown";
    folderFileState.error = `Không thể đọc folder đã lưu: ${error.message}`;
    renderAll();
  }
}

editor.events.on("change", renderAll);
new ResizeObserver(fitBoardToCanvas).observe(elements.canvasArea);
renderAll();
updateZoomUi();
switchTab(["generate", "playable", "json"].includes(editor.data.tab) ? editor.data.tab : "level");
restoreSavedFolder();

})();
