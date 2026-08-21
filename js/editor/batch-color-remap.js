import { FRUIT_TYPES } from "../core/constants.js";
import { blockItemIdFromItem, blockItemIdFromFruitType, blockVisualMeta } from "../core/block-visuals.js";
import { isItemLayerLocked } from "../generate/item-layer-locks.js";
import { createFruit, FRUIT_ITEM_IDS } from "../objects/fruit-object.js";
import { cellKey } from "../utils/grid-utils.js";

const BATCH_TYPE_BY_ITEM_ID = Object.freeze(Object.fromEntries(Object.entries(FRUIT_ITEM_IDS).map(([type, id]) => [String(id), type])));

function batchFruitTypeFromItemId(itemId) {
  return BATCH_TYPE_BY_ITEM_ID[String(Number(itemId))] ?? null;
}

function createBatchEmptyRecipe() {
  return Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
}

function itemForItemId(itemId, fallback = null) {
  const fruitType = batchFruitTypeFromItemId(itemId);
  if (!fruitType) {
    return {
      ...(fallback ?? {}),
      id: Number(itemId),
      itemId: Number(itemId),
      kind: "fruit",
      category: "item",
      fruitType: `unknown-${itemId}`,
      label: `Unknown #${itemId}`,
      icon: "?"
    };
  }
  const meta = blockVisualMeta(fruitType);
  return createFruit(fruitType, meta.label, fallback?.icon ?? "■");
}

function getMapping({ mode, sourceItemId, targetItemId }) {
  const sourceId = Number(sourceItemId);
  const targetId = Number(targetItemId);
  const mapping = new Map([[sourceId, targetId]]);
  if (mode === "swap") mapping.set(targetId, sourceId);
  return mapping;
}

function selectedMapLayers(state, scope) {
  const layers = state.layers ?? [];
  if (scope !== "current") return layers;
  const current = layers.find((layer) => layer.id === state.activeLayerId) ?? layers[0];
  return current ? [current] : [];
}

function selectedTrayEntries(state, scope) {
  const entries = Object.entries(state.sharedCells ?? {}).filter(([, cell]) => ["tray", "truck"].includes(cell.item?.kind));
  if (scope !== "selected") return entries;
  const selected = state.activeTrayCell ?? state.selectedCell;
  if (!selected) return [];
  return entries.filter(([key]) => key === cellKey(selected.x, selected.y));
}

function collectCountsAfter(state, options) {
  const mapping = getMapping(options);
  const mapCounts = new Map();
  const trayCounts = new Map();
  const add = (counts, itemId, amount) => counts.set(itemId, (counts.get(itemId) ?? 0) + amount);
  (state.layers ?? []).forEach((layer) => {
    Object.values(layer.cells ?? {}).forEach((cell) => {
      if (cell.item?.kind !== "fruit") return;
      const itemId = blockItemIdFromItem(cell.item);
      if (!itemId) return;
      add(mapCounts, mapping.get(itemId) ?? itemId, 1);
    });
  });
  Object.values(state.sharedCells ?? {}).forEach((cell) => {
    const item = cell.item;
    if (item?.kind === "truck") {
      const itemId = blockItemIdFromItem(item);
      if (itemId) add(trayCounts, mapping.get(itemId) ?? itemId, Number(item.capacity) || 0);
    }
    if (item?.kind !== "tray") return;
    (item.trayLayers ?? []).forEach((layer) => {
      FRUIT_TYPES.forEach((type) => {
        const amount = Number(layer.recipe?.[type]) || 0;
        if (amount <= 0) return;
        const itemId = blockItemIdFromFruitType(type);
        add(trayCounts, mapping.get(itemId) ?? itemId, amount);
      });
      (layer.unknownItems ?? []).forEach((unknown) => {
        const amount = Number(unknown.count) || 0;
        const itemId = Number(unknown.itemId);
        if (amount > 0 && Number.isInteger(itemId)) add(trayCounts, mapping.get(itemId) ?? itemId, amount);
      });
    });
  });
  return { mapCounts, trayCounts };
}

export function batchColorOptions() {
  return FRUIT_TYPES.map((type) => ({
    type,
    itemId: blockItemIdFromFruitType(type),
    label: `${blockVisualMeta(type).label} - ID ${blockItemIdFromFruitType(type)}`
  }));
}

export function analyzeBatchColorRemap(state, rawOptions) {
  const options = {
    mode: rawOptions?.mode === "swap" ? "swap" : "replace",
    sourceItemId: Number(rawOptions?.sourceItemId),
    targetItemId: Number(rawOptions?.targetItemId),
    includeMap: rawOptions?.includeMap !== false,
    includeTray: rawOptions?.includeTray !== false,
    mapScope: rawOptions?.mapScope === "current" ? "current" : "all",
    trayScope: rawOptions?.trayScope === "selected" ? "selected" : "all"
  };
  const mapping = getMapping(options);
  let mapAffected = 0;
  let trayAffected = 0;
  let mapSourceAffected = 0;
  let traySourceAffected = 0;
  let lockedLayerCount = 0;
  selectedMapLayers(state, options.mapScope).forEach((layer, order) => {
    const layerNumber = Number.isInteger(layer.layer) ? layer.layer : order;
    if (isItemLayerLocked(state, layerNumber)) lockedLayerCount += 1;
    Object.values(layer.cells ?? {}).forEach((cell) => {
      const itemId = cell.item?.kind === "fruit" ? blockItemIdFromItem(cell.item) : null;
      if (mapping.has(itemId)) mapAffected += 1;
      if (itemId === options.sourceItemId) mapSourceAffected += 1;
    });
  });
  selectedTrayEntries(state, options.trayScope).forEach(([, cell]) => {
    const item = cell.item;
    if (item?.kind === "truck") {
      const itemId = blockItemIdFromItem(item);
      if (mapping.has(itemId)) trayAffected += Number(item.capacity) || 0;
      if (itemId === options.sourceItemId) traySourceAffected += Number(item.capacity) || 0;
    }
    if (item?.kind !== "tray") return;
    (item.trayLayers ?? []).forEach((layer) => {
      FRUIT_TYPES.forEach((type) => {
        const itemId = blockItemIdFromFruitType(type);
        if (mapping.has(itemId)) trayAffected += Number(layer.recipe?.[type]) || 0;
        if (itemId === options.sourceItemId) traySourceAffected += Number(layer.recipe?.[type]) || 0;
      });
      (layer.unknownItems ?? []).forEach((unknown) => {
        const itemId = Number(unknown.itemId);
        if (mapping.has(itemId)) trayAffected += Number(unknown.count) || 0;
        if (itemId === options.sourceItemId) traySourceAffected += Number(unknown.count) || 0;
      });
    });
  });
  const totalAffected = (options.includeMap ? mapAffected : 0) + (options.includeTray ? trayAffected : 0);
  const sourceAffected = (options.includeMap ? mapSourceAffected : 0) + (options.includeTray ? traySourceAffected : 0);
  const after = collectCountsAfter(state, options);
  const relevantIds = new Set([...mapping.keys(), ...mapping.values()]);
  const balanceRows = [...relevantIds].sort((a, b) => a - b).map((itemId) => {
    const map = after.mapCounts.get(itemId) ?? 0;
    const tray = after.trayCounts.get(itemId) ?? 0;
    return { itemId, map, tray, diff: map - tray };
  });
  return {
    options,
    mapping,
    mapAffected: options.includeMap ? mapAffected : 0,
    trayAffected: options.includeTray ? trayAffected : 0,
    lockedLayerCount: options.includeMap ? lockedLayerCount : 0,
    balanceRows,
    totalAffected,
    sourceAffected,
    selectedTrayAvailable: selectedTrayEntries(state, "selected").length > 0,
    valid: options.sourceItemId !== options.targetItemId
      && (options.includeMap || options.includeTray)
      && sourceAffected > 0
      && totalAffected > 0
  };
}

function remapTrayLayer(layer, mapping) {
  const nextRecipe = createBatchEmptyRecipe();
  const nextUnknown = new Map();
  FRUIT_TYPES.forEach((type) => {
    const amount = Number(layer.recipe?.[type]) || 0;
    if (amount <= 0) return;
    const originalId = blockItemIdFromFruitType(type);
    const finalId = mapping.get(originalId) ?? originalId;
    const finalType = batchFruitTypeFromItemId(finalId);
    if (finalType) nextRecipe[finalType] += amount;
    else nextUnknown.set(finalId, (nextUnknown.get(finalId) ?? 0) + amount);
  });
  (layer.unknownItems ?? []).forEach((unknown) => {
    const amount = Number(unknown.count) || 0;
    const originalId = Number(unknown.itemId);
    if (amount <= 0 || !Number.isInteger(originalId)) return;
    const finalId = mapping.get(originalId) ?? originalId;
    const finalType = batchFruitTypeFromItemId(finalId);
    if (finalType) nextRecipe[finalType] += amount;
    else nextUnknown.set(finalId, (nextUnknown.get(finalId) ?? 0) + amount);
  });
  layer.recipe = nextRecipe;
  layer.unknownItems = [...nextUnknown.entries()].map(([itemId, count]) => ({ itemId, count }));
}

export function applyBatchColorRemap(state, options) {
  const preview = analyzeBatchColorRemap(state, options);
  if (!preview.valid) return preview;
  const mapping = preview.mapping;
  if (preview.options.includeMap) {
    selectedMapLayers(state, preview.options.mapScope).forEach((layer) => {
      Object.values(layer.cells ?? {}).forEach((cell) => {
        const item = cell.item;
        const itemId = item?.kind === "fruit" ? blockItemIdFromItem(item) : null;
        if (!mapping.has(itemId)) return;
        cell.item = itemForItemId(mapping.get(itemId), item);
      });
    });
  }
  if (preview.options.includeTray) {
    selectedTrayEntries(state, preview.options.trayScope).forEach(([, cell]) => {
      const item = cell.item;
      if (item?.kind === "truck") {
        const itemId = blockItemIdFromItem(item);
        if (mapping.has(itemId)) item.fruitType = batchFruitTypeFromItemId(mapping.get(itemId)) ?? item.fruitType;
      }
      if (item?.kind !== "tray") return;
      (item.trayLayers ?? []).forEach((layer) => remapTrayLayer(layer, mapping));
    });
  }
  state.generateSourceRevision = (Number(state.generateSourceRevision) || 0) + 1;
  state.generationMeta = { ...(state.generationMeta ?? {}), status: "Outdated" };
  return preview;
}
