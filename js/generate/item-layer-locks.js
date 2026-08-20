import { FRUIT_ITEM_IDS } from "../objects/fruit-object.js";

export const ITEM_LAYER_LOCKED = "LOCKED";
export const ITEM_LAYER_AUTO = "AUTO";

export function getLayerNumber(layer, order = 0) {
  return Number.isInteger(layer?.layer) ? layer.layer : order;
}

export function normalizeItemLayerLocks(state) {
  const locks = state?.itemLayerLocks && typeof state.itemLayerLocks === "object"
    ? state.itemLayerLocks
    : {};
  const validLayers = new Set((state?.layers ?? []).map((layer, order) => getLayerNumber(layer, order)));
  return Object.fromEntries(Object.entries(locks)
    .filter(([layerIndex, mode]) => validLayers.has(Number(layerIndex)) && mode === ITEM_LAYER_LOCKED));
}

export function isItemLayerLocked(state, layerIndex) {
  const locks = normalizeItemLayerLocks(state);
  return locks[String(layerIndex)] === ITEM_LAYER_LOCKED;
}

export function setItemLayerLock(state, layerIndex, locked) {
  const locks = normalizeItemLayerLocks(state);
  if (locked) locks[String(layerIndex)] = ITEM_LAYER_LOCKED;
  else delete locks[String(layerIndex)];
  state.itemLayerLocks = locks;
  return locks;
}

export function removeItemLayerLockAndShift(state, deletedLayerIndex) {
  const next = {};
  Object.entries(normalizeItemLayerLocks(state)).forEach(([key, mode]) => {
    const layerIndex = Number(key);
    if (layerIndex === deletedLayerIndex) return;
    next[String(layerIndex > deletedLayerIndex ? layerIndex - 1 : layerIndex)] = mode;
  });
  state.itemLayerLocks = next;
  return next;
}

export function getItemIdFromLayerItem(item) {
  if (!item || item.kind !== "fruit") return null;
  const itemId = item.unknown ? Number(item.itemId ?? item.id) : Number(FRUIT_ITEM_IDS[item.fruitType] ?? item.itemId ?? item.id);
  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

export function getItemLayerItemStats(layer) {
  const countByItemId = new Map();
  let total = 0;
  Object.values(layer?.cells ?? {}).forEach((cell) => {
    const itemId = getItemIdFromLayerItem(cell?.item);
    if (!itemId) return;
    total += 1;
    countByItemId.set(itemId, (countByItemId.get(itemId) ?? 0) + 1);
  });
  return { total, countByItemId };
}

export function getItemLayerLockRows(state) {
  const locks = normalizeItemLayerLocks(state);
  return (state?.layers ?? []).map((layer, order) => {
    const layerIndex = getLayerNumber(layer, order);
    const stats = getItemLayerItemStats(layer);
    return {
      id: layer.id,
      layerIndex,
      name: layer.name ?? `Layer ${layerIndex + 1}`,
      itemCount: stats.total,
      mode: locks[String(layerIndex)] === ITEM_LAYER_LOCKED ? ITEM_LAYER_LOCKED : ITEM_LAYER_AUTO
    };
  });
}

export function lockedItemLayerTotals(state) {
  const totalByItemId = new Map();
  let total = 0;
  (state?.layers ?? []).forEach((layer, order) => {
    const layerIndex = getLayerNumber(layer, order);
    if (!isItemLayerLocked(state, layerIndex)) return;
    const stats = getItemLayerItemStats(layer);
    total += stats.total;
    stats.countByItemId.forEach((amount, itemId) => {
      totalByItemId.set(itemId, (totalByItemId.get(itemId) ?? 0) + amount);
    });
  });
  return { total, totalByItemId };
}
