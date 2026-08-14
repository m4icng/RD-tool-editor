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
  smart: "Thông minh",
  path: "Đường đi",
  item: "Item",
  element: "Element"
});

const TERRAIN_ASSET_IDS = Object.freeze({
  GRASS: "terrain-grass",
  EMPTY: "terrain-empty",
  PRIORITY_POINT: "priority-point"
});

const FRUIT_TYPES = Object.freeze(["apple", "banana", "grape", "eggplant"]);
const FRUIT_SHORT = Object.freeze({ apple: "T", banana: "C", grape: "N", eggplant: "CT" });
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
  if (!state.grassCells) {
    const pathKeys = new Set(Object.entries(state.sharedCells ?? {}).filter(([, cell]) => cell.path).map(([key]) => key));
    state.grassCells = createFullGrassCells(state.grid, pathKeys);
  }
  if (!state.priorityPoints) {
    const merged = createMergedLayer(state);
    state.priorityPoints = Object.fromEntries(Object.keys(merged.cells ?? {})
      .filter((key) => {
        const { x, y } = parseCellKey(key);
        return isPathTurnpoint(merged, x, y);
      })
      .map((key) => [key, "auto"]));
  }
  return state;
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
  return {
    path: Boolean(shared.path),
    element: shared.element ?? null,
    item: shared.item ?? layerCell.item ?? null,
    layerItem: layerCell.item ?? null,
    sharedItem: shared.item ?? null
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
  eggplant: 4
});

function createFruit(fruitType, label, icon) {
  return { id: FRUIT_ITEM_IDS[fruitType] ?? String(fruitType), kind: "fruit", category: "item", fruitType, label, icon };
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


// ---- js/objects/obstacle-object.js ----
function createObstacle(type = "rock", label = "Chướng ngại", icon = "🪨") {
  return { id: `obstacle-${type}`, kind: "obstacle", obstacleType: type, label, icon };
}


// ---- js/objects/object-registry.js ----



const objects = [
  { id: "snake-start", kind: "snake", category: "item", label: "Đầu rắn", icon: "🐍", direction: "right", uniqueOnMap: true },
  createEmptyTray(),
  createFruit("apple", "Táo", "🍎"),
  createFruit("banana", "Chuối", "🍌"),
  createFruit("grape", "Nho", "🍇"),
  createFruit("eggplant", "Cà tím", "🍆"),
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
    layers: [firstLayer],
    activeLayerId: firstLayer.id,
    selectedCell: null,
    selectedAssetId: "snake-start",
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
    layers: structuredClone(editorData.layers)
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
const GAME_FORMAT_FRUIT_META = Object.freeze({
  apple: { label: "Táo", icon: "🍎" }, banana: { label: "Chuối", icon: "🍌" },
  grape: { label: "Nho", icon: "🍇" }, eggplant: { label: "Cà tím", icon: "🍆" }
});

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
  if (!raw.elements || typeof raw.elements !== "object" || Array.isArray(raw.elements)) throw new Error("elements phải là object.");
  if (Object.keys(raw.elements).length > 0) throw new Error("Format element chưa được hỗ trợ; elements hiện phải là object rỗng.");
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
  raw.spawns.forEach((spawn, i) => assertIndex(spawn?.index, total, `spawns[${i}]`));
  raw.itemLayers.forEach((layer, i) => {
    if (!Number.isInteger(layer?.layer) || layer.layer < 0) throw new Error(`itemLayers[${i}].layer phải là số nguyên không âm.`);
    assertArray(layer.items, `itemLayers[${i}].items`);
    layer.items.forEach((item, j) => {
      if (!Number.isInteger(item?.itemId) || item.itemId < 0) throw new Error(`itemLayers[${i}].items[${j}].itemId không hợp lệ.`);
      assertArray(item.index, `itemLayers[${i}].items[${j}].index`);
      item.index.forEach((index, k) => assertIndex(index, total, `itemLayers[${i}].items[${j}].index[${k}]`));
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
    const distance = Math.abs(deliverPoint.x - trayPosition.x) + Math.abs(deliverPoint.y - trayPosition.y);
    if (distance !== 1) throw new Error(`trays[${i}].trayPosition phải nằm liền kề deliverPoint theo hướng trên/dưới/trái/phải.`);
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
  raw.spawns.forEach((spawn) => {
    const { x, y } = indexToPosition(spawn.index, width);
    ensureShared(cellKey(x, y)).item = { id: "snake-start", kind: "snake", category: "item", label: "Đầu rắn", icon: "🐍", direction: "right" };
  });

  const layers = raw.itemLayers
    .slice().sort((a, b) => a.layer - b.layer)
    .map((source, index) => {
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

  return {
    grid: { columns: width, rows: height }, sharedCells, grassCells, priorityPoints, layers, activeLayerId: layers[0].id,
    selectedCell: null, selectedAssetId: "snake-start", tool: "path", eraseMode: "smart", tab: "level",
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
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    const { x, y } = parseCellKey(key);
    const index = positionToIndex(x, y, width);
    if (cell.path) road.push(index);
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
  const itemLayers = (editorData.layers ?? []).map((layer, order) => {
    const groups = new Map();
    Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
      if (cell.item?.kind !== "fruit") return;
      const id = itemIdOf(cell.item);
      const { x, y } = parseCellKey(key);
      const indexes = groups.get(id) ?? [];
      indexes.push(positionToIndex(x, y, width));
      groups.set(id, indexes);
    });
    return {
      layer: Number.isInteger(layer.layer) ? layer.layer : order,
      items: [...groups.entries()].sort(([a], [b]) => a - b).map(([itemId, index]) => ({ itemId, index: [...new Set(index)].sort((a, b) => a - b) }))
    };
  }).filter((layer) => layer.items.length > 0)
    .sort((a, b) => a.layer - b.layer)
    .map((layer, index) => ({
      ...layer,
      layer: index
    }));
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
    elements: {}
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
    capacityByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]))
  };
  Object.values(layer?.cells ?? {}).forEach((cell) => {
    if (cell.path) stats.paths += 1;
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
  const balanced = FRUIT_TYPES.every((type) => stats.allFruitsByType[type] === stats.capacityByType[type]);
  if (!balanced || stats.allFruits === 0) warnings.push("Tổng trái cây của các layer và recipe khay chưa khớp.");
  const roadKeys = new Set(Object.entries(level?.sharedCells ?? {}).filter(([, cell]) => cell.path).map(([key]) => key));
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind === "snake" && !cell.path) warnings.push(`Spawn tại Index ${indexOfKey(key)} phải nằm trên Path.`);
    if (cell.item?.kind === "tray") {
      const { x, y } = parseCellKey(key);
      if (!cell.path) warnings.push(`Checkpoint khay tại Index ${indexOfKey(key)} phải nằm trên Path.`);
      const visual = getTrayVisualPosition(cell.item, { x, y });
      const visualIndex = positionToIndex(visual.x, visual.y, level.grid.columns);
      if (!isInsideGrid(level.grid, visual.x, visual.y)) warnings.push(`Visual khay tại checkpoint Index ${indexOfKey(key)} nằm ngoài map.`);
      const visualKey = `${visual.x},${visual.y}`;
      const visualShared = level.sharedCells?.[visualKey];
      const visualFruit = (level.layers ?? []).some((layer) => layer.cells?.[visualKey]?.item);
      if (isInsideGrid(level.grid, visual.x, visual.y) && (visualShared?.path || visualShared?.item || visualShared?.element || visualFruit)) warnings.push(`Ô visual Index ${visualIndex} của khay checkpoint Index ${indexOfKey(key)} phải để trống.`);
      if (!Number.isInteger(cell.item.trayId) || cell.item.trayId < 0) warnings.push(`Khay tại Index ${indexOfKey(key)} chưa có trayId hợp lệ.`);
      (cell.item.trayLayers ?? []).forEach((trayLayer) => {
        if ((trayLayer.unknownItems ?? []).some((item) => Number(item.count) > 0)) warnings.push(`Khay ${cell.item.trayId} còn item chưa hỗ trợ.`);
      });
    }
  });
  const trayVisualKeys = new Map();
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "tray") return;
    const visual = getTrayVisualPosition(cell.item, parseCellKey(key));
    const visualKey = `${visual.x},${visual.y}`;
    if (trayVisualKeys.has(visualKey)) warnings.push(`Khay ${cell.item.trayId} có visual trùng với khay ${trayVisualKeys.get(visualKey)}.`);
    else trayVisualKeys.set(visualKey, cell.item.trayId);
  });
  (level?.layers ?? []).forEach((layer) => Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "fruit") return;
    if (!roadKeys.has(key)) warnings.push(`Fruit tại Index ${indexOfKey(key)} trong layer ${layer.layer ?? layer.name} phải nằm trên Path.`);
    if (cell.item.unknown) warnings.push(`Layer ${layer.layer ?? layer.name} còn Unknown #${cell.item.itemId ?? cell.item.id}.`);
    if (level.sharedCells?.[key]?.item?.kind === "tray") warnings.push(`Fruit tại Index ${indexOfKey(key)} trùng checkpoint khay.`);
  }));
  return { valid: errors.length === 0, exportable: errors.length === 0 && warnings.length === 0, errors, warnings: [...new Set(warnings)], stats };
}


// ---- js/data/file-manager.js ----

class LevelFileManager {
  constructor() { this.directory = null; }
  get supported() { return typeof window.showDirectoryPicker === "function"; }
  get connected() { return Boolean(this.directory); }

  async chooseDirectory() {
    if (!this.supported) throw new Error("Trình duyệt này không hỗ trợ quản lý thư mục trực tiếp.");
    this.directory = await window.showDirectoryPicker({ id: "railwaydash-levels", mode: "readwrite" });
    return this.listFiles();
  }

  async listFiles() {
    if (!this.directory) return [];
    const files = [];
    for await (const [name, handle] of this.directory.entries()) {
      if (handle.kind !== "file" || !name.toLowerCase().endsWith(".json")) continue;
      const file = await handle.getFile();
      files.push({ name, size: file.size, updatedAt: file.lastModified });
    }
    return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  async read(name) {
    const handle = await this.directory.getFileHandle(name);
    return JSON.parse(await (await handle.getFile()).text());
  }

  async write(name, data) {
    const handle = await this.directory.getFileHandle(name);
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


// ---- js/editor/object-placement.js ----



function cornerKeys(state) {
  const layer = createMergedLayer(state);
  return new Set(Object.keys(layer.cells ?? {}).filter((key) => {
    const { x, y } = parseCellKey(key);
    return isPathTurnpoint(layer, x, y);
  }));
}

function syncAutoPriorityPoints(state, beforeCorners) {
  const afterCorners = cornerKeys(state);
  Object.entries(state.priorityPoints).forEach(([key, source]) => {
    if (source === "auto" && !afterCorners.has(key)) delete state.priorityPoints[key];
  });
  afterCorners.forEach((key) => {
    if (!beforeCorners.has(key) && !state.priorityPoints[key]) state.priorityPoints[key] = "auto";
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

function objectCategory(object) {
  if (!object) return null;
  if (object?.category) return object.category;
  return ["snake", "fruit", "tray", "truck"].includes(object?.kind) ? "item" : "element";
}

function eraseCellLayers(shared, layerCell, mode, { protectPath = false } = {}) {
  const removeLayerItem = () => {
    if (layerCell.item?.kind !== "fruit") return false;
    layerCell.item = null;
    return true;
  };
  const removeSharedItem = () => {
    if (objectCategory(shared.item) !== "item") return false;
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
  if (mode === "element") return { changed: removeElement(), removed: "element" };
  if (mode === "path") return removePath();

  if (removeLayerItem()) return { changed: true, removed: "layer-item" };
  if (removeSharedItem()) return { changed: true, removed: "shared-item" };
  if (removeElement()) return { changed: true, removed: "element" };
  return removePath();
}

function eraseAtPosition(state, position, mode = "smart") {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId);
  if (!layer || !position) return { changed: false };
  ensureTerrainState(state);
  state.sharedCells ??= {};
  const key = cellKey(position.x, position.y);
  if (mode === "smart" && state.priorityPoints[key]) {
    delete state.priorityPoints[key];
    state.selectedCell = { x: position.x, y: position.y };
    return { changed: true, removed: "priority-point" };
  }
  const beforeCorners = cornerKeys(state);
  const shared = structuredClone(state.sharedCells[key] ?? { path: false, item: null, element: null });
  const layerCell = structuredClone(layer.cells[key] ?? { item: null });
  const fruitOnOtherLayer = state.layers.some((candidate) => candidate.id !== layer.id && candidate.cells?.[key]?.item?.kind === "fruit");
  const result = eraseCellLayers(shared, layerCell, mode, { protectPath: mode === "smart" && fruitOnOtherLayer });

  if (result.removed === "path") {
    state.grassCells[key] = true;
    delete state.priorityPoints[key];
  }

  if (!shared.path && !shared.item && !shared.element) delete state.sharedCells[key];
  else state.sharedCells[key] = shared;
  if (!layerCell.item) delete layer.cells[key];
  else layer.cells[key] = layerCell;
  state.selectedCell = { x: position.x, y: position.y };
  if (result.removed === "path") syncAutoPriorityPoints(state, beforeCorners);
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
    const beforeCorners = cornerKeys(state);
    shared.path = true;
    delete state.grassCells[key];
    state.sharedCells[key] = shared;
    syncAutoPriorityPoints(state, beforeCorners);
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
      const placed = object.uniqueOnMap ? findPlacedObject(state, object.id) : null;
      if (placed && placed.key !== key) {
        state.selectedCell = { x, y };
        return { changed: false, reason: "unique-object-exists", objectId: object.id };
      }
      if (object.kind === "fruit") {
        shared.path = true;
        if (shared.item) return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        layerCell.item = cloneObject(object);
      } else {
        if (shared.item && shared.item.id !== object.id) {
          return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        }
        const fruitAtPosition = state.layers.some((candidate) => candidate.cells?.[key]?.item?.kind === "fruit");
        if (fruitAtPosition) return { changed: false, reason: "fruit-position-occupied", objectId: object.id };
        if (["tray", "truck"].includes(object.kind)) {
          if (!shared.path) return { changed: false, reason: "tray-checkpoint-needs-road", objectId: object.id };
          const visualPosition = { x, y: y - 1 };
          if (!isInsideGrid(state.grid, visualPosition.x, visualPosition.y)) return { changed: false, reason: "tray-visual-outside-grid", objectId: object.id };
          const visualKey = cellKey(visualPosition.x, visualPosition.y);
          const visualShared = state.sharedCells[visualKey];
          const visualFruit = state.layers.some((candidate) => candidate.cells?.[visualKey]?.item);
          const overlapsTrayVisual = Object.entries(state.sharedCells).some(([otherKey, otherCell]) => {
            if (!["tray", "truck"].includes(otherCell?.item?.kind)) return false;
            const [otherX, otherY] = otherKey.split(",").map(Number);
            const otherVisual = getTrayVisualPosition(otherCell.item, { x: otherX, y: otherY });
            return otherVisual.x === visualPosition.x && otherVisual.y === visualPosition.y;
          });
          if (visualShared?.path || visualShared?.item || visualShared?.element || visualFruit || overlapsTrayVisual) return { changed: false, reason: "tray-visual-occupied", objectId: object.id };
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
  const beforeCorners = cornerKeys(state);
  cell.path = !cell.path;
  if (cell.path) delete state.grassCells[key];
  else {
    state.grassCells[key] = true;
    delete state.priorityPoints[key];
  }
  if (!cell.path) {
    cell.item = null;
    cell.element = null;
    state.layers.forEach((layer) => { delete layer.cells[key]; });
  }
  if (!cell.path && !cell.item && !cell.element) delete state.sharedCells[key];
  else state.sharedCells[key] = cell;
  syncAutoPriorityPoints(state, beforeCorners);
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
  constructor(element) {
    this.element = element;
    this.zoom = 1;
  }

  setZoom(value) {
    this.zoom = Math.min(2, Math.max(0.5, value));
    this.element.style.transform = `scale(${this.zoom})`;
    this.element.style.transformOrigin = "center";
  }

  reset() { this.setZoom(1); }
}


// ---- js/editor/grid-renderer.js ----



function renderGrid(container, editorData) {
  ensureTerrainState(editorData);
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
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!["tray", "truck"].includes(cell?.item?.kind)) return;
    const [trayX, trayY] = key.split(",").map(Number);
    trayCheckpoints.set(key, { x: trayX, y: trayY, item: cell.item });
    const visual = getTrayVisualPosition(cell.item, { x: trayX, y: trayY });
    trayVisuals.set(cellKey(visual.x, visual.y), { x: trayX, y: trayY, item: cell.item });
  });

  for (let y = 0; y < editorData.grid.rows; y += 1) {
    for (let x = 0; x < editorData.grid.columns; x += 1) {
      const data = getCell(layer, x, y);
      const index = positionToIndex(x, y, editorData.grid.columns);
      const priorityPoint = Boolean(editorData.priorityPoints[cellKey(x, y)]);
      const grass = Boolean(editorData.grassCells[cellKey(x, y)]);
      const checkpointTray = trayCheckpoints.get(cellKey(x, y));
      const visualTray = trayVisuals.get(cellKey(x, y));
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `grid-cell${grass ? " grass" : " terrain-empty"}${data.path ? " path" : ""}${priorityPoint ? " priority-point" : ""}${samePosition(editorData.selectedCell, { x, y }) ? " selected" : ""}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Ô Index ${index}${priorityPoint ? ", PriorityPoint" : ""}${grass ? ", Grass" : data.path ? ", Path" : ", Terrain trống"}`);

      if (data.item && data.item.kind !== "tray") {
        const icon = document.createElement("span");
        icon.className = `placed-icon ${data.item.kind}`;
        icon.textContent = data.item.icon;
        if (data.item.kind === "fruit" || data.item.kind === "truck" || data.item.kind === "tray") {
          const badge = document.createElement("small");
          badge.textContent = data.item.kind === "fruit" ? (data.item.unknown ? `#${data.item.itemId ?? data.item.id}` : FRUIT_SHORT[data.item.fruitType]) : data.item.capacity;
          icon.appendChild(badge);
        }
        cell.appendChild(icon);
      }
      if (visualTray) {
        const icon = document.createElement("span");
        icon.className = "placed-icon tray tray-visual-proxy";
        icon.textContent = visualTray.item.icon ?? "🧺";
        const badge = document.createElement("small");
        badge.textContent = visualTray.item.trayId;
        icon.appendChild(badge);
        cell.appendChild(icon);
      }
      if (checkpointTray) {
        const checkpoint = document.createElement("span");
        checkpoint.className = "delivery-checkpoint editor-checkpoint";
        checkpoint.title = `Checkpoint khay ID ${checkpointTray.item.trayId} tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, editorData.grid.columns)}`;
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
    if (cell) this.onCell(Number(cell.dataset.x), Number(cell.dataset.y));
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
      this.onCell(position.x, position.y);
      return;
    }

    this.isDrawing = true;
    this.visited.clear();
    this.lastCell = null;
    this.strokeMode = eraseOverride ? "erase" : "primary";
    this.grid.classList.add("is-drawing");
    this.onStrokeStart();
    this.paintTo(position);
  }

  handlePointerMove(event) {
    if (!this.isDrawing) return;
    if (!this.isEnabled()) return this.handlePointerUp();
    const target = this.root.elementFromPoint?.(event.clientX, event.clientY);
    const cell = target?.closest?.(".grid-cell");
    if (!cell || !this.grid.contains(cell)) return;
    this.paintTo({ x: Number(cell.dataset.x), y: Number(cell.dataset.y) });
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

  paintTo(position) {
    const cells = this.lastCell ? rasterizeGridLine(this.lastCell, position) : [position];
    cells.forEach((cell) => {
      const key = `${cell.x},${cell.y}`;
      if (this.visited.has(key)) return;
      this.visited.add(key);
      this.onCell(cell.x, cell.y, { eraseOverride: this.strokeMode === "erase" });
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
function renderObjectPalette(container, objects, selectedId, { emptyLabel = "Chưa có object trong nhóm này.", unavailableIds = [] } = {}) {
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
    button.className = `asset-btn${String(object.id) === String(selectedId) ? " active" : ""}${isUnavailable ? " unavailable" : ""}`;
    button.dataset.asset = object.id;
    button.dataset.tooltip = `ID: ${object.id}${isUnavailable ? " · Đã có trên map" : ""}`;
    button.title = button.dataset.tooltip;
    button.setAttribute("aria-label", `${object.label}. ID: ${object.id}${isUnavailable ? ". Đã có trên map" : ""}`);
    if (isUnavailable) button.setAttribute("aria-disabled", "true");
    button.innerHTML = `<span class="asset-icon"></span><span></span>`;
    button.firstElementChild.textContent = object.icon;
    button.lastElementChild.textContent = object.label;
    container.appendChild(button);
  });
}


// ---- js/ui/tray-editor.js ----



const TRAY_CAPACITY = 9;

const FRUIT_META = Object.freeze({
  apple: { label: "Táo", icon: "🍎" },
  banana: { label: "Chuối", icon: "🍌" },
  grape: { label: "Nho", icon: "🍇" },
  eggplant: { label: "Cà tím", icon: "🍆" }
});

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

function getSelectedTrayContext(state) {
  if (!state.selectedCell) return null;
  const { x, y } = state.selectedCell;
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

function setTrayVisualDirection(state, direction) {
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

function selectTrayLayerFruit(state, layerIndex, fruitType) {
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

function createRecipeControl(type, amount, total, layerIndex) {
  const meta = FRUIT_META[type];
  const row = document.createElement("div");
  row.className = "tray-recipe-row";
  row.innerHTML = '<span class="tray-fruit-icon"></span><span class="tray-fruit-name"></span><span class="tray-counter"><button type="button">−</button><output></output><button type="button">+</button></span>';
  row.children[0].textContent = meta.icon;
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
  header.children[0].children[1].textContent = `DeliverPoint · Index ${positionToIndex(context.x, context.y, width)}`;
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
  positionControl.innerHTML = '<span><strong>Vị trí visual khay</strong><small></small></span><select data-tray-position-direction aria-label="Hướng đặt visual khay"></select>';
  const trayPosition = getTrayVisualPosition(context.item, context);
  positionControl.children[0].children[1].textContent = `Index ${positionToIndex(trayPosition.x, trayPosition.y, width)} · tương đối từ deliverPoint`;
  const directionSelect = positionControl.children[1];
  Object.entries(TRAY_DIRECTION_META).forEach(([direction, label]) => {
    const option = document.createElement("option");
    option.value = direction;
    option.textContent = label;
    directionSelect.appendChild(option);
  });
  directionSelect.value = getTrayVisualDirection(context.item, context);
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

function renderTrayEditor(container, state) {
  const trays = trayEntries(state);
  container.innerHTML = "";
  if (trays.length === 0) {
    container.innerHTML = '<div class="empty-state">Chưa có khay chứa trên map. Chọn <strong>Khay chứa</strong> trong tab Item để đặt một khay trống.</div>';
    return;
  }
  container.appendChild(createTrayList(trays, state.selectedCell, state.grid.columns));
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


// ---- js/ui/data-summary.js ----


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

function renderDataSummary(container, state) {
  const summary = collectEditorDataSummary(state);
  container.innerHTML = "";
  container.append(renderFruitBalance(summary), renderTrayDetails(summary), renderLayerDetails(summary));
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


// ---- js/ui/toolbar.js ----

function renderToolbar(editor, elements) {
  document.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === editor.data.tool));
  const eraseLabel = ERASE_MODE_LABELS[editor.data.eraseMode ?? "smart"];
  document.querySelector("#eraseToolBtn .tool-label").textContent = `Xóa · ${eraseLabel}`;
  document.querySelectorAll("[data-erase-mode]").forEach((button) => {
    const active = button.dataset.eraseMode === (editor.data.eraseMode ?? "smart");
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  elements.activeToolBadge.textContent = editor.data.tool === "erase" ? `Xóa ${eraseLabel.toLowerCase()}` : TOOL_LABELS[editor.data.tool];
  elements.undoBtn.disabled = !editor.history.canUndo;
  elements.redoBtn.disabled = !editor.history.canRedo;
}

function activateTab(tab, editorData, elements) {
  editorData.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  const isLevel = tab === "level";
  const isPlayable = tab === "playable";
  const isJson = tab === "json";
  elements.levelWorkspace.classList.toggle("hidden", isPlayable);
  elements.playableWorkspace.classList.toggle("hidden", !isPlayable);
  document.querySelectorAll(".level-rail-content").forEach((element) => element.classList.toggle("hidden", !isLevel));
  elements.jsonFolderCard.classList.toggle("hidden", !isJson);
  elements.levelRightRail.classList.toggle("json-mode", isJson);
  elements.canvasArea.classList.toggle("read-only", isJson);
  elements.gridBoard.setAttribute("aria-readonly", String(isJson));
  elements.levelControls.classList.toggle("hidden", !isLevel);
  elements.playableControls.classList.toggle("hidden", !isPlayable);
  elements.jsonControls.classList.toggle("hidden", !isJson);
  elements.levelActions.classList.toggle("hidden", !isLevel);
  elements.jsonActions.classList.toggle("hidden", !isJson);
  elements.levelLayerPicker.classList.toggle("hidden", isPlayable);
  elements.levelLayerPicker.classList.toggle("read-only", isJson);
  elements.levelLayerPicker.querySelectorAll("button").forEach((button) => button.classList.toggle("hidden", isJson));
  if (isJson) elements.activeToolBadge.textContent = "Chỉ xem";
  else if (isLevel) elements.activeToolBadge.textContent = editorData.tool === "erase"
    ? `Xóa ${(ERASE_MODE_LABELS[editorData.eraseMode ?? "smart"] ?? "").toLowerCase()}`
    : TOOL_LABELS[editorData.tool];
  elements.placeholderView.classList.add("hidden");
  elements.topbarEyebrow.textContent = isPlayable ? "Playable / Snapshot màn chơi" : isLevel ? "Level Design / Layer fruit đang chọn" : "Data JSON / Map editor hiện tại";
}


// ---- js/ui/inspector-panel.js ----

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function renderInspector(container, editorData) {
  if (!editorData.selectedCell) {
    container.innerHTML = '<div class="empty-state">Chọn công cụ <strong>Chọn ô</strong>, sau đó click vào một ô để xem thuộc tính.</div>';
    return;
  }
  const { x, y } = editorData.selectedCell;
  const index = positionToIndex(x, y, editorData.grid.columns);
  const cell = getMergedCell(editorData, x, y);
  const capacity = cell.item?.kind === "truck"
    ? `<div class="property-row"><span>Sức chứa</span><span class="capacity-control"><button type="button" data-capacity-step="-1">−</button><output>${cell.item.capacity}</output><button type="button" data-capacity-step="1">+</button></span></div>`
    : "";
  container.innerHTML = `<div class="property-list">
    <div class="property-row"><span>Vị trí</span><strong>Index ${index}</strong></div>
    <div class="property-row"><span>Đường đi</span><strong>${cell.path ? "Có" : "Không"}</strong></div>
    <div class="property-row"><span>Grass</span><strong>${isGrassAt(editorData, x, y) ? "Có" : "Không"}</strong></div>
    <div class="property-row"><span>PriorityPoint</span><strong>${isPriorityPointAt(editorData, x, y) ? "Có" : "Không"}</strong></div>
    <div class="property-row"><span>Item layer</span><strong>${escapeHtml(cell.layerItem?.label ?? "Không có fruit")}</strong></div>
    <div class="property-row"><span>Dùng chung</span><strong>${escapeHtml(cell.sharedItem?.label ?? cell.element?.label ?? "Không có")}</strong></div>
    ${capacity}</div>
    <div class="inspector-actions"><button class="btn" type="button" id="togglePathBtn">${cell.path ? "Bỏ đường" : "Thêm đường"}</button><button class="btn" type="button" id="deleteCellBtn">Xóa lớp trên cùng</button></div>`;
}


// ---- js/ui/level-settings.js ----

function isMapSizeWithinBounds(grid) {
  return Number.isInteger(grid?.columns) && grid.columns >= 1 && Number.isInteger(grid?.rows) && grid.rows >= 1;
}

function hasDataOutsideGrid(state, nextGrid) {
  const scopes = [{ cells: state.sharedCells ?? {} }, ...(state.layers ?? [])];
  if (scopes.some((scope) => Object.entries(scope.cells ?? {}).some(([key, cell]) => {
    const { x, y } = parseCellKey(key);
    return (x >= nextGrid.columns || y >= nextGrid.rows) && Boolean(cell.path || cell.item || cell.element);
  }))) return true;
  return Object.entries(state.sharedCells ?? {}).some(([key, cell]) => {
    if (!["tray", "truck"].includes(cell.item?.kind)) return false;
    const visual = getTrayVisualPosition(cell.item, parseCellKey(key));
    return !isInsideGrid(nextGrid, visual.x, visual.y);
  });
}

function changeMapDimension(state, dimension, nextValue) {
  if (!['columns', 'rows'].includes(dimension)) return { changed: false, reason: "dimension" };
  const value = Number(nextValue);
  if (!Number.isInteger(value) || value < 1) return { changed: false, reason: "limit" };
  const nextGrid = { ...state.grid, [dimension]: value };
  if (value < state.grid[dimension] && hasDataOutsideGrid(state, nextGrid)) return { changed: false, reason: "occupied" };
  if (value === state.grid[dimension]) return { changed: false, reason: null };
  ensureTerrainState(state);
  const previousGrid = { ...state.grid };
  state.grid = nextGrid;
  if (value > previousGrid[dimension]) {
    for (let y = 0; y < nextGrid.rows; y += 1) {
      for (let x = 0; x < nextGrid.columns; x += 1) {
        if (x < previousGrid.columns && y < previousGrid.rows) continue;
        state.grassCells[`${x},${y}`] = true;
      }
    }
  } else {
    state.grassCells = trimCells(state.grassCells, nextGrid);
    state.priorityPoints = trimCells(state.priorityPoints, nextGrid);
  }
  if (state.selectedCell && (state.selectedCell.x >= nextGrid.columns || state.selectedCell.y >= nextGrid.rows)) state.selectedCell = null;
  return { changed: true, reason: null };
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

function detectCollision({ grid, layer, snake }, nextHead) {
  if (!isInsideGrid(grid, nextHead.x, nextHead.y)) return { type: "boundary" };
  const cell = layer.cells[cellKey(nextHead.x, nextHead.y)];
  if (!cell?.path) return { type: "off-path" };
  if (snake.body.some((part) => part.x === nextHead.x && part.y === nextHead.y)) return { type: "self" };
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
    snake: { body: [{ x: start.x, y: start.y }], direction: start.direction },
    inventory: {},
    delivered: {},
    status: "running",
    lastCollision: null
  };
}

function stepSimulation(simulation, direction = simulation.snake.direction) {
  if (simulation.status !== "running") return simulation;
  const state = structuredClone(simulation);
  const head = nextPosition(state.snake.body[0], direction);
  const collision = detectCollision(state, head);
  if (collision) {
    state.status = "lost";
    state.lastCollision = collision;
    return state;
  }

  state.snake = moveSnake(state.snake, direction);
  const key = cellKey(head.x, head.y);
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


// ---- js/gameplay/playable-controller.js ----


const PLAY_STATUS = Object.freeze({
  READY: "ready",
  MOVING: "moving",
  DELIVERING: "delivering",
  WAITING: "waiting",
  PAUSED: "paused",
  WON: "won",
  LOST: "lost",
  BLOCKED: "blocked"
});

const OPPOSITE = Object.freeze({ up: "down", down: "up", left: "right", right: "left" });
const DIRECTION_LABELS = Object.freeze({ up: "↑ Lên", down: "↓ Xuống", left: "← Trái", right: "→ Phải" });
const FRUIT_ICONS = Object.freeze({ apple: "🍎", banana: "🍌", grape: "🍇", eggplant: "🍆" });
const STATUS_COPY = Object.freeze({
  ready: ["Sẵn sàng", "Chọn một hướng hợp lệ để bắt đầu."],
  moving: ["Đang chạy", "Rắn đang tự di chuyển trên đoạn đường hiện tại."],
  delivering: ["Đang giao hàng", "Rắn dừng tại checkpoint; vật phẩm phù hợp đang được đưa vào khay lần lượt."],
  waiting: ["Chờ hướng", "Rắn đã dừng. Hãy chọn hướng tiếp theo."],
  paused: ["Đã pause", "Nhấn Resume để tiếp tục phiên chơi."],
  won: ["Hoàn thành", "Tất cả layer của mọi khay đã được giao đủ."],
  lost: ["Thua", "Rắn đã va chạm hoặc không còn hướng hợp lệ."],
  blocked: ["Chưa thể chơi", "Hãy sửa các lỗi level được liệt kê bên dưới."]
});

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

  starts.forEach(({ x, y, cell }) => {
    if (!cell.path) errors.push(`${cell.item.label ?? cell.item.kind} tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
  });

  trays.forEach(({ x, y, cell }) => {
    const visual = getTrayVisualPosition(cell.item, { x, y });
    if (!isInsideGrid(level.grid, visual.x, visual.y)) errors.push(`Visual khay tại checkpoint Index ${mapIndex(x, y)} nằm ngoài map.`);
    if (!cell.path) errors.push(`Checkpoint khay tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
    const visualCell = layer.cells[cellKey(visual.x, visual.y)];
    if (visualCell?.path || visualCell?.item || visualCell?.element) errors.push(`Ô visual khay Index ${mapIndex(visual.x, visual.y)} phải để trống.`);
  });
  const visualKeys = trays.map(({ x, y, cell }) => {
    const visual = getTrayVisualPosition(cell.item, { x, y });
    return cellKey(visual.x, visual.y);
  });
  if (new Set(visualKeys).size !== visualKeys.length) errors.push("Có nhiều khay đang dùng chung một vị trí visual.");

  fruits.forEach(({ x, y, cell, layerIndex }) => {
    const sharedCell = level.sharedCells?.[cellKey(x, y)];
    const sharedPath = sharedCell?.path ?? cell.path;
    if (!sharedPath) errors.push(`${cell.item.label ?? cell.item.kind} tại Index ${mapIndex(x, y)} trong fruit layer ${layerIndex + 1} phải nằm trên đường đi.`);
    if (sharedCell?.item) errors.push(`Fruit layer ${layerIndex + 1} tại Index ${mapIndex(x, y)} trùng ${sharedCell.item.kind} dùng chung.`);
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
      errors.push(`${FRUIT_ICONS[type]} ${type}: map có ${fruitTotals[type]}, recipe cần ${recipeTotals[type]}.`);
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
    checkpointKey: cellKey(checkpoint.x, checkpoint.y),
    checkpoint,
    x: visual.x,
    y: visual.y,
    layers: normalizeTrayLayers(entry.cell.item).map((layer) => ({ ...layer, delivered: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])) })),
    activeIndex: 0
  };
}

function createPlayableSession(level, { mode = "continuous", speed = 9 } = {}) {
  const report = validatePlayableLevel(level);
  if (!report.valid) throw new Error(report.errors.join(" "));
  const layer = structuredClone(report.layer);
  const entries = entriesWithPosition(layer);
  const start = entries.find(({ cell }) => cell.item?.kind === "snake");
  layer.cells[start.key].item = null;
  const session = {
    grid: structuredClone(level.grid),
    layer,
    grassCells: structuredClone(level.grassCells),
    priorityPoints: structuredClone(level.priorityPoints),
    fruitLayers: structuredClone(report.fruitLayers),
    activeFruitLayerIndex: 0,
    snake: { body: [{ x: start.x, y: start.y }], direction: null },
    turnpointKeys: Object.keys(level.priorityPoints ?? {}),
    trays: entries.filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind)).map(createTrayRuntime),
    remainingFruits: entries.filter(({ cell }) => cell.item?.kind === "fruit").length,
    mode,
    speed,
    status: PLAY_STATUS.READY,
    resumeStatus: PLAY_STATUS.READY,
    lastReason: null,
    delivery: null,
    deliveryEffect: null
  };
  advanceFruitLayerIfCleared(session);
  return session;
}

function activateFruitLayer(session, nextIndex) {
  Object.values(session.layer.cells).forEach((cell) => {
    if (cell?.item?.kind === "fruit") cell.item = null;
  });
  const nextLayer = session.fruitLayers[nextIndex];
  if (!nextLayer) return false;
  Object.entries(nextLayer.cells ?? {}).forEach(([key, fruitCell]) => {
    if (fruitCell?.item?.kind !== "fruit") return;
    session.layer.cells[key] ??= { path: false, element: null, item: null };
    session.layer.cells[key].item = structuredClone(fruitCell.item);
  });
  session.activeFruitLayerIndex = nextIndex;
  session.remainingFruits = Object.values(nextLayer.cells ?? {}).filter((cell) => cell?.item?.kind === "fruit").length;
  return true;
}

function advanceFruitLayerIfCleared(session) {
  while (session.remainingFruits === 0 && session.activeFruitLayerIndex + 1 < session.fruitLayers.length) {
    if (!activateFruitLayer(session, session.activeFruitLayerIndex + 1)) break;
    const head = session.snake.body[0];
    const headCell = session.layer.cells[cellKey(head.x, head.y)];
    if (headCell?.item?.kind === "fruit") {
      const tail = session.snake.body[session.snake.body.length - 1];
      session.snake.body.push({ ...tail, fruitType: headCell.item.fruitType });
      headCell.item = null;
      session.remainingFruits -= 1;
    }
  }
}

function allFruitLayersComplete(session) {
  return session.remainingFruits === 0 && session.activeFruitLayerIndex >= session.fruitLayers.length - 1;
}

function cellIsTraversable(session, position) {
  if (!isInsideGrid(session.grid, position.x, position.y)) return false;
  const cell = session.layer.cells[cellKey(position.x, position.y)];
  if (!cell?.path) return false;
  if (session.trays.some((tray) => tray.visualKey === cellKey(position.x, position.y))) return false;
  if (cell.item?.kind === "obstacle" || cell.element?.kind === "obstacle") return false;
  return !session.snake.body.some((part) => part.x === position.x && part.y === position.y);
}

function availableDirections(session) {
  const head = session.snake.body[0];
  const reverse = OPPOSITE[session.snake.direction];
  return Object.entries(DIRECTIONS).filter(([direction, vector]) => {
    if (session.snake.body.length > 1 && direction === reverse) return false;
    return cellIsTraversable(session, { x: head.x + vector.x, y: head.y + vector.y });
  }).map(([direction]) => direction);
}

function activeTrayLayer(tray) {
  return tray.layers[tray.activeIndex] ?? null;
}

function layerIsComplete(layer) {
  return FRUIT_TYPES.every((type) => (layer.delivered[type] ?? 0) >= (layer.recipe[type] ?? 0));
}

function advanceCompletedTrayLayers(tray) {
  while (activeTrayLayer(tray) && layerIsComplete(activeTrayLayer(tray))) tray.activeIndex += 1;
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
  const layer = activeTrayLayer(tray);
  layer.delivered[segment.fruitType] += 1;
  session.snake.body = session.snake.body.map((part, index) => ({ ...part, ...positions[index] }));
  session.deliveryEffect = {
    fruitType: segment.fruitType,
    checkpointKey: tray.checkpointKey,
    visualKey: tray.visualKey,
    nonce: `${Date.now()}-${session.snake.body.length}`
  };

  advanceCompletedTrayLayers(tray);
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

function setPostDeliveryStatus(session) {
  if (allFruitLayersComplete(session) && allTraysComplete(session)) {
    session.status = PLAY_STATUS.WON;
    return;
  }
  if (availableDirections(session).length === 0) {
    session.status = PLAY_STATUS.LOST;
    session.lastReason = "Không còn hướng hợp lệ sau checkpoint giao hàng.";
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
  const isTurnpoint = session.turnpointKeys.includes(cellKey(head.x, head.y));
  const reverse = OPPOSITE[session.snake.direction];
  const onward = available.filter((direction) => direction !== reverse);
  if (session.mode === "step") {
    if (available.length === 0) {
      session.status = PLAY_STATUS.LOST;
      session.lastReason = "Không còn hướng di chuyển hợp lệ.";
    } else session.status = PLAY_STATUS.WAITING;
    return;
  }
  if (isTurnpoint) {
    if (available.length === 0) {
      session.status = PLAY_STATUS.LOST;
      session.lastReason = "Không còn hướng di chuyển hợp lệ tại PriorityPoint.";
    } else session.status = PLAY_STATUS.WAITING;
    return;
  }
  if (onward.length === 1 && onward[0] === session.snake.direction) {
    session.status = PLAY_STATUS.MOVING;
  } else if (onward.length > 0 || available.includes(reverse)) {
    session.status = PLAY_STATUS.WAITING;
  } else {
    session.status = PLAY_STATUS.LOST;
    session.lastReason = "Rắn đã tới ngõ cụt và không thể quay đầu khi đang có đuôi.";
  }
}

function movePlayableSession(session, direction) {
  if (!availableDirections(session).includes(direction)) return { moved: false, reason: "invalid-direction" };
  session.deliveryEffect = null;
  const vector = DIRECTIONS[direction];
  const previousBody = session.snake.body.map((part) => ({ ...part }));
  const head = previousBody[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y };
  session.snake.direction = direction;
  const previousCargo = previousBody.slice(1);
  session.snake.body = [
    nextHead,
    ...previousCargo.map((segment, index) => ({ ...segment, x: previousBody[index].x, y: previousBody[index].y }))
  ];

  const key = cellKey(nextHead.x, nextHead.y);
  const cell = session.layer.cells[key];
  if (cell.item?.kind === "fruit") {
    const tailPosition = previousBody[previousBody.length - 1];
    session.snake.body.push({ ...tailPosition, fruitType: cell.item.fruitType });
    cell.item = null;
    session.remainingFruits -= 1;
    advanceFruitLayerIfCleared(session);
  }
  const tray = session.trays.find((candidate) => candidate.checkpointKey === key);
  if (!beginCheckpointDelivery(session, tray)) setPostMoveStatus(session);
  return { moved: true, status: session.status };
}

function itemIcon(item) {
  return item.icon ?? FRUIT_ICONS[item.fruitType] ?? "◆";
}

function statusText(status) {
  return STATUS_COPY[status] ?? STATUS_COPY.ready;
}

function createPlayableController({ getLevel, elements, onExitEditor }) {
  let session = null;
  let previewLevel = null;
  let validationErrors = [];
  let timer = null;
  let isActive = false;
  let swipeStart = null;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function fitBoard() {
    const grid = session?.grid ?? previewLevel?.grid;
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
    const level = session ? { grid: session.grid, layer: session.layer } : previewLevel ? { grid: previewLevel.grid, layer: activeLayer(previewLevel) } : null;
    elements.playableGridBoard.innerHTML = "";
    if (!level?.layer) return;
    elements.playableGridBoard.style.gridTemplateColumns = `repeat(${level.grid.columns}, minmax(0, 1fr))`;
    const snakeParts = new Map((session?.snake.body ?? []).map((part, index) => [cellKey(part.x, part.y), { ...part, index }]));
    const boardTrays = session?.trays ?? entriesWithPosition(level.layer)
      .filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind))
      .map(createTrayRuntime);
    const traysByVisualKey = new Map(boardTrays.map((tray) => [tray.visualKey, tray]));
    const traysByCheckpointKey = new Map(boardTrays.map((tray) => [tray.checkpointKey, tray]));
    const grassCells = session?.grassCells ?? previewLevel?.grassCells ?? {};
    const priorityPoints = session?.priorityPoints ?? previewLevel?.priorityPoints ?? {};
    for (let y = 0; y < level.grid.rows; y += 1) {
      for (let x = 0; x < level.grid.columns; x += 1) {
        const key = cellKey(x, y);
        const cellData = level.layer.cells[key] ?? { path: false, item: null };
        const tray = traysByVisualKey.get(key);
        const checkpointTray = traysByCheckpointKey.get(key);
        const cell = document.createElement("div");
        cell.className = `grid-cell playable-cell${grassCells[key] ? " grass" : " terrain-empty"}${cellData.path ? " path" : ""}${priorityPoints[key] ? " priority-point" : ""}${tray ? " tray-visual-cell" : ""}${checkpointTray ? " tray-checkpoint-cell" : ""}`;
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `Ô chơi Index ${positionToIndex(x, y, level.grid.columns)}`);
        if (cellData.item && !["tray", "truck"].includes(cellData.item.kind) && !(session && cellData.item.kind === "snake")) {
          const icon = document.createElement("span");
          icon.className = `placed-icon ${cellData.item.kind}`;
          icon.textContent = itemIcon(cellData.item);
          cell.appendChild(icon);
          if (tray) {
            const layer = activeTrayLayer(tray);
            const needs = FRUIT_TYPES.filter((type) => layer && (layer.recipe[type] ?? 0) > (layer.delivered[type] ?? 0));
            const needBadge = document.createElement("span");
            const badgeSide = tray.x >= level.grid.columns / 2 ? " align-left" : " align-right";
            needBadge.className = `playable-tray-needs${badgeSide}${session?.delivery?.trayId === tray.id ? " receiving" : ""}`;
            needBadge.textContent = layer
              ? needs.map((type) => `${FRUIT_ICONS[type]}${(layer.recipe[type] ?? 0) - (layer.delivered[type] ?? 0)}`).join(" ")
              : "✓";
            needBadge.title = layer ? `Khay cần: ${needBadge.textContent}` : "Khay đã hoàn thành";
            cell.appendChild(needBadge);
          }
        }
        if (tray && !cellData.item) {
          const icon = document.createElement("span");
          icon.className = "placed-icon tray";
          icon.textContent = tray.item.icon ?? "🧺";
          cell.appendChild(icon);
          const layer = activeTrayLayer(tray);
          const needs = FRUIT_TYPES.filter((type) => layer && (layer.recipe[type] ?? 0) > (layer.delivered[type] ?? 0));
          const needBadge = document.createElement("span");
          needBadge.className = `playable-tray-needs${tray.x >= level.grid.columns / 2 ? " align-left" : " align-right"}${session?.delivery?.trayId === tray.id ? " receiving" : ""}`;
          needBadge.textContent = layer ? needs.map((type) => `${FRUIT_ICONS[type]}${(layer.recipe[type] ?? 0) - (layer.delivered[type] ?? 0)}`).join(" ") : "✓";
          cell.appendChild(needBadge);
        }
        if (checkpointTray) {
          const checkpoint = document.createElement("span");
          checkpoint.className = `delivery-checkpoint${session?.delivery?.trayId === checkpointTray.id ? " active" : ""}`;
          checkpoint.title = `Checkpoint giao hàng cho khay tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, level.grid.columns)}`;
          cell.appendChild(checkpoint);
        }
        if (session?.deliveryEffect?.checkpointKey === key) {
          const flyingFruit = document.createElement("span");
          flyingFruit.className = "delivery-flying-fruit";
          flyingFruit.textContent = FRUIT_ICONS[session.deliveryEffect.fruitType] ?? "●";
          flyingFruit.dataset.effect = session.deliveryEffect.nonce;
          cell.appendChild(flyingFruit);
        }
        const snakePart = snakeParts.get(cellKey(x, y));
        if (snakePart) {
          const token = document.createElement("span");
          token.className = `playable-token ${snakePart.index === 0 ? "head" : "cargo"}`;
          token.textContent = snakePart.index === 0 ? "🐍" : FRUIT_ICONS[snakePart.fruitType] ?? "●";
          cell.appendChild(token);
        }
        elements.playableGridBoard.appendChild(cell);
      }
    }
    elements.playableGridMeta.textContent = `${level.grid.columns} × ${level.grid.rows} · snapshot độc lập`;
    const fruitLayerMeta = session ? ` · fruit layer ${session.activeFruitLayerIndex + 1}/${session.fruitLayers.length}` : "";
    elements.playableGridMeta.textContent = `${level.grid.columns} × ${level.grid.rows}${fruitLayerMeta} · map/rắn/khay dùng chung`;
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
      chip.textContent = FRUIT_ICONS[segment.fruitType] ?? "●";
      chip.title = segment.fruitType;
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
      recipes.className = "recipe-strip";
      if (layer) FRUIT_TYPES.filter((type) => (layer.recipe[type] ?? 0) > 0).forEach((type) => {
        const chip = document.createElement("span");
        const delivered = layer.delivered[type] ?? 0;
        const required = layer.recipe[type] ?? 0;
        chip.className = `recipe-chip${delivered >= required ? " done" : ""}`;
        chip.textContent = `${FRUIT_ICONS[type]} ${delivered}/${required}`;
        recipes.appendChild(chip);
      });
      card.appendChild(recipes);
      elements.playableTrayProgress.appendChild(card);
    });
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
    const directions = session && [PLAY_STATUS.READY, PLAY_STATUS.WAITING].includes(session.status) ? availableDirections(session) : [];
    elements.playableDirectionHint.innerHTML = directions.length
      ? `<strong>Hướng hợp lệ:</strong> ${directions.map((direction) => DIRECTION_LABELS[direction]).join(" · ")}`
      : status === PLAY_STATUS.MOVING ? "Rắn đang di chuyển; input mới sẽ bị bỏ qua." : "Không nhận input hướng ở trạng thái hiện tại.";
    elements.playModeSelect.value = session?.mode ?? elements.playModeSelect.value;
    elements.playSpeedSelect.value = String(session?.speed ?? elements.playSpeedSelect.value);
    elements.playPauseBtn.textContent = status === PLAY_STATUS.PAUSED ? "Resume" : "Pause";
    elements.playPauseBtn.disabled = !session || [PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(status);
    elements.playModeSelect.disabled = !session;
    elements.playSpeedSelect.disabled = !session;
    elements.playableEndOverlay.classList.toggle("hidden", ![PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(status));
    if (status === PLAY_STATUS.WON) {
      elements.playableEndIcon.textContent = "🏆";
      elements.playableEndTitle.textContent = "Hoàn thành màn chơi";
      elements.playableEndCopy.textContent = "Tất cả khay chứa đã nhận đủ recipe.";
    } else if (status === PLAY_STATUS.LOST) {
      elements.playableEndIcon.textContent = "💥";
      elements.playableEndTitle.textContent = "Bạn đã thua";
      elements.playableEndCopy.textContent = session.lastReason ?? "Rắn không thể tiếp tục di chuyển.";
    }
    renderBoard();
    renderCargo();
    renderTrays();
  }

  function scheduleNext() {
    clearTimer();
    if (!isActive || !session) return;
    if (session.status === PLAY_STATUS.DELIVERING) {
      timer = setTimeout(() => {
        deliverNextCargo(session);
        render();
        scheduleNext();
      }, 280);
      return;
    }
    if (session.status !== PLAY_STATUS.MOVING) return;
    timer = setTimeout(() => {
      movePlayableSession(session, session.snake.direction);
      render();
      scheduleNext();
    }, 1000 / session.speed);
  }

  function chooseDirection(direction) {
    if (!isActive || !session || ![PLAY_STATUS.READY, PLAY_STATUS.WAITING].includes(session.status)) return false;
    if (!availableDirections(session).includes(direction)) return false;
    session.status = PLAY_STATUS.MOVING;
    movePlayableSession(session, direction);
    render();
    scheduleNext();
    return true;
  }

  function restart() {
    clearTimer();
    previewLevel = structuredClone(getLevel());
    const report = validatePlayableLevel(previewLevel);
    validationErrors = report.errors;
    if (!report.valid) session = null;
    else session = createPlayableSession(previewLevel, { mode: elements.playModeSelect.value, speed: Number(elements.playSpeedSelect.value) });
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
    if (session && [PLAY_STATUS.READY, PLAY_STATUS.MOVING, PLAY_STATUS.DELIVERING, PLAY_STATUS.WAITING].includes(session.status)) {
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
  elements.playSpeedSelect.addEventListener("change", () => {
    if (!session) return;
    session.speed = Number(elements.playSpeedSelect.value);
    elements.playSpeedSelect.blur();
    scheduleNext();
    render();
  });
  elements.playPauseBtn.addEventListener("click", togglePause);
  elements.playRestartBtn.addEventListener("click", restart);
  elements.playAgainBtn.addEventListener("click", restart);
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    chooseDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  document.addEventListener("keydown", (event) => {
    if (!isActive || ["INPUT", "TEXTAREA"].includes(event.target?.tagName)) return;
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
  "layerSelect", "toggleActiveLayerVisibilityBtn", "deleteActiveLayerBtn", "trayPanel", "pathStat", "grassStat", "priorityStat", "itemStat", "fruitStat", "fruitTypeStat", "trayStat", "capacityStat", "dataSummary", "validationList", "inspectorBody", "inspectorDetails",
  "undoBtn", "redoBtn", "activeToolBadge", "topbarEyebrow", "levelWorkspace", "playableWorkspace", "levelLayerPicker", "levelRightRail", "jsonFolderCard",
  "placeholderView", "placeholderIcon", "placeholderTitle", "placeholderCopy", "levelControls", "playableControls", "jsonControls", "levelActions", "jsonActions",
  "playableGridBoard", "playableBoardWrap", "playableCanvasArea", "playableGridMeta", "playableStatusBadge", "playableStatusCopy", "playableBlocker",
  "playModeSelect", "playSpeedSelect", "playPauseBtn", "playRestartBtn", "playableDirectionHint", "playableCargoCount", "playableCargo",
  "playableTrayCount", "playableTrayProgress", "playableEndOverlay", "playableEndIcon", "playableEndTitle", "playableEndCopy", "playAgainBtn", "exitPlayableBtn",
  "toast", "saveStatus", "fileInput", "newLevelBtn", "jsonImportBtn", "jsonDownloadBtn", "chooseFolderBtn", "refreshFolderBtn",
  "jsonFileNameInput", "folderStatus", "jsonFileList", "jsonPreview", "jsonValidationStatus", "jsonDirtyStatus"
].map((id) => [id, byId(id)]));

const editor = new EditorState(loadSavedState());
const fileManager = new LevelFileManager();
let folderFiles = [];
let fileDirty = editor.data.fileDirty ?? !editor.data.sourceFileName;
let activePaletteCategory = "item";
const playable = createPlayableController({
  getLevel: () => editor.data,
  elements,
  onExitEditor: () => switchTab("level")
});
initPanelResizers();
const gridIndexTooltip = createGridIndexTooltip({
  grid: elements.gridBoard,
  getGrid: () => editor.data.grid,
  isEnabled: () => ["level", "json"].includes(editor.data.tab)
});

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

  elements.boardWrap.style.width = `${fittedWidth}px`;
}

function loadSavedState() {
  for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        try { return deserializeEditorState(raw); }
        catch {
          const legacy = migrateLevel(JSON.parse(raw));
          return { grid: legacy.grid, sharedCells: legacy.sharedCells ?? {}, layers: legacy.layers, activeLayerId: legacy.activeLayerId ?? legacy.layers?.[0]?.id, selectedCell: null, selectedAssetId: "snake-start", tool: "path", eraseMode: "smart", tab: "level", fileName: "untitled-level.json", sourceFileName: null, fileDirty: true };
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
  elements.deleteActiveLayerBtn.disabled = editor.data.layers.length === 1;
}

function renderValidation(layer) {
  const report = validateLevel(editor.data);
  const balanceOk = FRUIT_TYPES.every((type) =>
    report.stats.allFruitsByType[type] === report.stats.capacityByType[type]
  ) && report.stats.allFruits > 0;
  const trayRecipesOk = report.stats.trays > 0 && report.stats.invalidTrayRecipes === 0;
  const checks = [
    { ok: report.stats.snake === 1, text: report.stats.snake === 1 ? "Có đúng 1 điểm bắt đầu" : `Cần đúng 1 điểm bắt đầu (hiện có ${report.stats.snake})` },
    { ok: report.stats.allFruits > 0, text: report.stats.allFruits > 0 ? `${report.stats.allFruits} fruit trong ${report.stats.fruitLayers} layer` : "Chưa có trái cây trong các layer" },
    { ok: trayRecipesOk, text: trayRecipesOk ? `${report.stats.trayLayers} layer khay đã đủ recipe 9/9` : `Còn ${report.stats.invalidTrayRecipes || "khay chưa có"} recipe khay chưa hoàn tất` },
    { ok: balanceOk, text: balanceOk ? "Tổng fruit các layer khớp recipe khay" : "Tổng fruit các layer và recipe khay chưa khớp" }
  ];
  const details = [...report.errors, ...report.warnings].filter((message) => !checks.some((check) => check.text === message));
  elements.validationList.innerHTML = checks.map((check) => `<div class="validation-row ${check.ok ? "ok" : "warn"}"><span>${check.ok ? "✓" : "!"}</span><span>${check.text}</span></div>`).join("")
    + details.map((message) => `<div class="validation-row warn"><span>!</span><span>${message}</span></div>`).join("");
  return report.stats;
}

function renderAll() {
  const layer = editor.activeLayer;
  const paletteObjects = objectsByCategory(activePaletteCategory);
  renderObjectPalette(elements.assetPalette, paletteObjects, editor.data.selectedAssetId, {
    emptyLabel: activePaletteCategory === "element" ? "Element sẽ được bổ sung ở bước tiếp theo." : `Chưa có ${activePaletteCategory}.`,
    unavailableIds: hasPlacedObject("snake-start") ? ["snake-start"] : []
  });
  document.querySelectorAll("[data-palette-tab]").forEach((button) => {
    const active = button.dataset.paletteTab === activePaletteCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  renderGrid(elements.gridBoard, editor.data);
  renderLayers();
  renderTrayEditor(elements.trayPanel, editor.data);
  renderInspector(elements.inspectorBody, editor.data);
  const dataSummary = renderDataSummary(elements.dataSummary, editor.data);
  renderToolbar(editor, elements);
  if (editor.data.tool === "terrain") elements.activeToolBadge.textContent = findObject(editor.data.selectedAssetId)?.label ?? "Chỉnh terrain";
  const stats = renderValidation(layer);
  elements.pathStat.textContent = stats.paths;
  elements.grassStat.textContent = Object.keys(editor.data.grassCells ?? {}).length;
  elements.priorityStat.textContent = Object.keys(editor.data.priorityPoints ?? {}).length;
  const sharedItemCount = Object.values(editor.data.sharedCells ?? {}).filter((cell) => Boolean(cell.item)).length;
  elements.itemStat.textContent = sharedItemCount + dataSummary.totalFruits;
  elements.fruitStat.textContent = dataSummary.totalFruits;
  elements.fruitTypeStat.textContent = `${dataSummary.fruitKinds}/${FRUIT_TYPES.length}`;
  elements.trayStat.textContent = dataSummary.trays.length;
  elements.capacityStat.textContent = `${dataSummary.trayConfigured}/${dataSummary.trayTarget}`;
  elements.capacityStat.title = "Số item đã setup / tổng số item cần cho mọi khay";
  elements.mapWidthInput.value = String(editor.data.grid.columns);
  elements.mapHeightInput.value = String(editor.data.grid.rows);
  elements.gridMeta.textContent = `${editor.data.grid.columns} × ${editor.data.grid.rows} · ${layer.name} · chỉ hoa quả thay đổi`;
  if (editor.data.tab === "level") elements.topbarEyebrow.textContent = "Level Design / Layer fruit đang chọn";
  elements.boardWrap.classList.remove("hidden-layer");
  elements.assetCount.textContent = `${paletteObjects.length} ${activePaletteCategory}`;
  renderJsonWorkspace();
  requestAnimationFrame(fitBoardToCanvas);
  persist();
}

function mutate(mutator) {
  fileDirty = true;
  editor.data.fileDirty = true;
  return editor.mutate(mutator);
}

function renderJsonWorkspace() {
  editor.data.fileName = normalizeFileName(editor.data.fileName);
  if (document.activeElement !== elements.jsonFileNameInput) elements.jsonFileNameInput.value = editor.data.fileName;
  const report = validateLevel(editor.data);
  const documentData = serializeLevel(editor.data);
  elements.jsonPreview.textContent = stringifyJson(documentData);
  elements.jsonValidationStatus.textContent = report.exportable ? "Hợp lệ · sẵn sàng export" : `${report.errors.length + report.warnings.length} lỗi cần sửa`;
  elements.jsonDownloadBtn.disabled = !report.exportable;
  byId("exportBtn").disabled = !report.exportable;
  elements.jsonDirtyStatus.textContent = fileDirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ file";
  elements.jsonDirtyStatus.classList.toggle("clean", !fileDirty);
  elements.chooseFolderBtn.disabled = !fileManager.supported;
  elements.refreshFolderBtn.disabled = !fileManager.connected;
  if (!fileManager.supported) elements.folderStatus.textContent = "Trình duyệt không hỗ trợ quản lý thư mục; vẫn có thể Import và Tải xuống.";
  renderFolderFiles();
}

function renderFolderFiles() {
  elements.jsonFileList.innerHTML = "";
  if (!fileManager.connected || folderFiles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "json-file-empty";
    empty.textContent = fileManager.connected ? "Thư mục chưa có file JSON." : "Chọn một thư mục để quản lý các level JSON đã có trên ổ đĩa.";
    elements.jsonFileList.appendChild(empty);
    return;
  }
  folderFiles.forEach((file) => {
    const row = document.createElement("div");
    row.className = `json-file-row${editor.data.sourceFileName === file.name ? " active" : ""}`;
    row.dataset.fileName = file.name;
    const copy = document.createElement("div");
    copy.className = "json-file-copy";
    const title = document.createElement("strong");
    title.textContent = file.name;
    const meta = document.createElement("small");
    meta.textContent = `${Math.max(1, Math.ceil(file.size / 1024))} KB · ${new Date(file.updatedAt).toLocaleString("vi-VN")}`;
    copy.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "json-file-actions";
    [["open", "Mở"], ["save", "Lưu đè"], ["rename", "Đổi tên"], ["delete", "Xóa"]].forEach(([action, label]) => {
      const button = document.createElement("button");
      button.type = "button"; button.dataset.fileAction = action; button.textContent = label;
      if (action === "delete") button.className = "danger";
      if (action === "save" && !validateLevel(editor.data).exportable) button.disabled = true;
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

const input = new InputController({
  isEnabled: () => editor.data.tab === "level",
  canDrag: () => editor.data.tool !== "select",
  onStrokeStart: () => editor.beginTransaction(),
  onStrokeEnd: () => editor.endTransaction(),
  onCell(x, y, { eraseOverride = false } = {}) {
    const visualTray = Object.entries(editor.data.sharedCells ?? {}).map(([key, cell]) => {
      if (!["tray", "truck"].includes(cell.item?.kind)) return null;
      const [deliverX, deliverY] = key.split(",").map(Number);
      const visual = getTrayVisualPosition(cell.item, { x: deliverX, y: deliverY });
      return visual.x === x && visual.y === y ? { x: deliverX, y: deliverY } : null;
    }).find(Boolean);
    const routeVisualToTray = visualTray && (eraseOverride || editor.data.tool !== "terrain");
    if (routeVisualToTray && !eraseOverride && editor.data.tool !== "erase") {
      editor.data.tool = "select";
      selectCell(editor.data, visualTray.x, visualTray.y);
      editor.notify();
      return;
    }
    const targetX = routeVisualToTray ? visualTray.x : x;
    const targetY = routeVisualToTray ? visualTray.y : y;
    const clickedCell = getMergedCell(editor.data, targetX, targetY);
    const clickedTray = ["tray", "truck"].includes(clickedCell?.item?.kind);
    if (clickedTray && !eraseOverride && editor.data.tool !== "erase") {
      editor.data.tool = "select";
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else if (editor.data.tool === "select" && !eraseOverride) {
      selectCell(editor.data, targetX, targetY);
      editor.notify();
    } else {
      const result = mutate((state) => applyTool(state, targetX, targetY, eraseOverride ? "smart-erase" : null));
      if (result?.reason === "unique-object-exists") {
        showNotification(elements.toast, "Map chỉ được có một đầu rắn. Hãy xóa đầu rắn hiện tại trước khi đặt lại.");
      } else if (result?.reason === "tray-visual-outside-grid") {
        showNotification(elements.toast, "Không thể đặt khay: vị trí visual mặc định phía trên nằm ngoài map.");
      } else if (result?.reason === "tray-checkpoint-needs-road") {
        showNotification(elements.toast, "Hãy vẽ đường trước, sau đó đặt khay trực tiếp lên checkpoint đó.");
      } else if (result?.reason === "tray-visual-occupied") {
        showNotification(elements.toast, "Ô visual mặc định phía trên checkpoint phải trống.");
      } else if (["shared-position-occupied", "fruit-position-occupied"].includes(result?.reason)) {
        showNotification(elements.toast, "Ô này đã có object dùng chung hoặc fruit ở một layer khác.");
      } else if (result?.reason === "grass-on-path") {
        showNotification(elements.toast, "Grass không thể trùng Path. Hãy xóa Path trước.");
      } else if (result?.reason === "terrain-on-path") {
        showNotification(elements.toast, "Không thể chuyển ô Path thành Terrain trống. Hãy xóa Path trước.");
      } else if (result?.reason === "priority-needs-path") {
        showNotification(elements.toast, "PriorityPoint chỉ được đặt trên Path.");
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
    editor.notify();
    return;
  }
  const button = event.target.closest("[data-tool]");
  if (button && TOOL_LABELS[button.dataset.tool]) { editor.data.tool = button.dataset.tool; editor.notify(); }
});
const eraseToolMenu = document.querySelector(".erase-tool-menu");
const setEraseMenuExpanded = (expanded) => byId("eraseToolBtn").setAttribute("aria-expanded", String(expanded));
eraseToolMenu.addEventListener("pointerenter", () => setEraseMenuExpanded(true));
eraseToolMenu.addEventListener("pointerleave", () => setEraseMenuExpanded(false));
eraseToolMenu.addEventListener("focusin", () => setEraseMenuExpanded(true));
eraseToolMenu.addEventListener("focusout", (event) => {
  if (!eraseToolMenu.contains(event.relatedTarget)) setEraseMenuExpanded(false);
});
elements.assetPalette.addEventListener("click", (event) => {
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
document.querySelector(".dimension-card").addEventListener("click", (event) => {
  const button = event.target.closest("[data-map-dimension]");
  if (!button) return;
  const dimension = button.dataset.mapDimension;
  const next = editor.data.grid[dimension] + Number(button.dataset.delta);
  const result = changeMapDimension(structuredClone(editor.data), dimension, next);
  if (!result.changed && result.reason === "occupied") return showNotification(elements.toast, "Không thể giảm: hãy xóa hoặc di chuyển dữ liệu ngoài vùng mới");
  if (!result.changed) return;
  mutate((state) => changeMapDimension(state, dimension, next));
});
[elements.mapWidthInput, elements.mapHeightInput].forEach((inputElement) => inputElement.addEventListener("change", () => {
  const dimension = inputElement === elements.mapWidthInput ? "columns" : "rows";
  const next = Math.max(1, Math.floor(Number(inputElement.value) || 1));
  const probe = changeMapDimension(structuredClone(editor.data), dimension, next);
  if (!probe.changed && probe.reason === "occupied") showNotification(elements.toast, "Không thể giảm: vùng bị cắt vẫn còn dữ liệu.");
  else if (probe.changed) mutate((state) => changeMapDimension(state, dimension, next));
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

function deleteActiveLayer() {
  if (editor.data.layers.length <= 1 || !confirm("Xóa layer fruit đang chọn và toàn bộ hoa quả trong layer này? Map, rắn và khay chứa sẽ được giữ nguyên.")) return;
  mutate((state) => {
    const deletedId = state.activeLayerId;
    const deletedIndex = state.layers.findIndex((layer) => layer.id === deletedId);
    state.layers = state.layers.filter((layer) => layer.id !== deletedId);
    reindexLayers(state.layers);
    const nextIndex = Math.min(deletedIndex, state.layers.length - 1);
    state.activeLayerId = state.layers[Math.max(0, nextIndex)].id;
  });
}
elements.deleteActiveLayerBtn.addEventListener("click", deleteActiveLayer);
elements.trayPanel.addEventListener("click", (event) => {
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
  const tray = event.target.closest("[data-tray-x]");
  if (!tray) return;
  editor.data.tool = "select";
  selectCell(editor.data, Number(tray.dataset.trayX), Number(tray.dataset.trayY));
  editor.notify();
});
elements.trayPanel.addEventListener("change", (event) => {
  const directionPicker = event.target.closest("[data-tray-position-direction]");
  if (directionPicker) {
    const result = mutate((state) => setTrayVisualDirection(state, directionPicker.value));
    if (result?.reason === "outside-grid") showNotification(elements.toast, "Hướng đã chọn làm visual khay nằm ngoài map.");
    else if (result?.reason === "occupied") showNotification(elements.toast, "Ô visual đã chọn đang có đường, item, element, fruit hoặc visual khay khác.");
    return;
  }
  const picker = event.target.closest("[data-tray-fruit-picker]");
  if (!picker || !picker.value) return;
  const changed = mutate((state) => selectTrayLayerFruit(state, Number(picker.dataset.trayLayerIndex), picker.value));
  if (!changed) showNotification(elements.toast, "Layer đã đủ sức chứa 9/9 hoặc loại quả đã được chọn.");
});

let draggedTrayLayerIndex = null;
elements.trayPanel.addEventListener("dragstart", (event) => {
  const card = event.target.closest("[data-tray-layer-index]");
  if (!card || event.target.closest("button, select, input")) return;
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
byId("backToLevelBtn").addEventListener("click", () => { switchTab("level"); renderAll(); });
elements.inspectorBody.addEventListener("click", (event) => {
  const capacity = event.target.closest("[data-capacity-step]");
  if (capacity) mutate((state) => changeSelectedTruckCapacity(state, Number(capacity.dataset.capacityStep)));
  else if (event.target.closest("#togglePathBtn")) mutate((state) => togglePathAt(state, state.selectedCell));
  else if (event.target.closest("#deleteCellBtn")) showEraseFeedback(mutate((state) => eraseAtPosition(state, state.selectedCell, "smart")));
});
function canReplaceCurrentLevel() {
  return !fileDirty || confirm("Level hiện tại có thay đổi chưa lưu hoặc chưa tải xuống. Thay toàn bộ level hiện tại?");
}

function downloadCurrentLevel() {
  const report = validateLevel(editor.data);
  if (!report.exportable) return showNotification(elements.toast, "Chưa thể Export: hãy sửa toàn bộ lỗi level trước.");
  editor.data.fileName = normalizeFileName(elements.jsonFileNameInput.value || editor.data.fileName);
  downloadJson(serializeLevel(editor.data), editor.data.fileName);
  editor.data.sourceFileName = null;
  fileDirty = false;
  editor.data.fileDirty = false;
  renderAll();
  showNotification(elements.toast, `Đã tải xuống ${editor.data.fileName}`);
}

function openImportedData(raw, fileName) {
  const data = deserializeLevel(raw, { fileName });
  editor.history.clear();
  fileDirty = false;
  data.fileDirty = false;
  editor.replace(data);
  switchTab("level");
  const report = validateLevel(data);
  renderAll();
  showNotification(elements.toast, report.exportable ? `Đã mở ${fileName}` : `Đã mở ${fileName} · có ${report.warnings.length} lỗi cần sửa`);
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

elements.newLevelBtn.addEventListener("click", () => {
  if (!canReplaceCurrentLevel()) return;
  editor.history.clear();
  fileDirty = true;
  editor.replace(createInitialState());
  renderAll();
});

async function refreshFolder() {
  folderFiles = await fileManager.listFiles();
  elements.folderStatus.textContent = `${fileManager.directory.name} · ${folderFiles.length} file JSON`;
  renderAll();
}

elements.chooseFolderBtn.addEventListener("click", async () => {
  try { await fileManager.chooseDirectory(); await refreshFolder(); }
  catch (error) { if (error.name !== "AbortError") showNotification(elements.toast, error.message); }
});
elements.refreshFolderBtn.addEventListener("click", () => refreshFolder().catch((error) => showNotification(elements.toast, error.message)));

elements.jsonFileList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-file-action]");
  const row = event.target.closest("[data-file-name]");
  if (!button || !row) return;
  const name = row.dataset.fileName;
  try {
    if (button.dataset.fileAction === "open") {
      if (!canReplaceCurrentLevel()) return;
      openImportedData(await fileManager.read(name), name);
    } else if (button.dataset.fileAction === "save") {
      if (!confirm(`Lưu đè toàn bộ nội dung hiện tại vào ${name}?`)) return;
      const report = validateLevel(editor.data);
      if (!report.exportable) return showNotification(elements.toast, "Không thể lưu đè khi level còn lỗi.");
      await fileManager.write(name, serializeLevel(editor.data));
      editor.data.fileName = name; editor.data.sourceFileName = name; fileDirty = false;
      editor.data.fileDirty = false;
      await refreshFolder(); showNotification(elements.toast, `Đã lưu đè ${name}`);
    } else if (button.dataset.fileAction === "rename") {
      const proposed = prompt("Tên file mới:", name);
      if (!proposed) return;
      const nextName = normalizeFileName(proposed);
      if (!confirm(`Đổi tên ${name} thành ${nextName}?`)) return;
      if (folderFiles.some((file) => file.name === nextName)) return showNotification(elements.toast, `${nextName} đã tồn tại.`);
      await fileManager.rename(name, nextName);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = nextName; editor.data.fileName = nextName; }
      await refreshFolder(); showNotification(elements.toast, `Đã đổi tên thành ${nextName}`);
    } else if (button.dataset.fileAction === "delete") {
      if (!confirm(`Xóa vĩnh viễn file ${name} khỏi ổ đĩa?`)) return;
      await fileManager.remove(name);
      if (editor.data.sourceFileName === name) { editor.data.sourceFileName = null; fileDirty = true; editor.data.fileDirty = true; }
      await refreshFolder(); showNotification(elements.toast, `Đã xóa ${name}`);
    }
  } catch (error) { showNotification(elements.toast, `Không thể thao tác file: ${error.message}`); }
});

editor.events.on("change", renderAll);
new ResizeObserver(fitBoardToCanvas).observe(elements.canvasArea);
renderAll();
switchTab(["playable", "json"].includes(editor.data.tab) ? editor.data.tab : "level");

})();
