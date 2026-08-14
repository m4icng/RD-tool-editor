import { FRUIT_TYPES } from "../core/constants.js";
import { createLayer } from "../core/editor-state.js";
import { FRUIT_ITEM_IDS } from "../objects/fruit-object.js";
import {
  cellKey,
  ensureTerrainState,
  getTrayVisualPosition,
  indexToPosition,
  parseCellKey,
  positionToIndex
} from "../utils/grid-utils.js";

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

export function deserializeLevel(rawData, { fileName = "untitled-level.json" } = {}) {
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

export function serializeLevel(editorData) {
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

export function serializeEditorState(editorData) { ensureTerrainState(editorData); return { editorStateVersion: 1, data: structuredClone(editorData) }; }
export function deserializeEditorState(rawData) {
  const raw = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
  if (raw?.editorStateVersion !== 1 || !raw.data?.grid || !Array.isArray(raw.data.layers)) throw new Error("Stored editor state không hợp lệ.");
  return ensureTerrainState(structuredClone(raw.data));
}

export function normalizeFileName(value) {
  const base = String(value ?? "").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\.json$/i, "") || "untitled-level";
  return `${base}.json`;
}
