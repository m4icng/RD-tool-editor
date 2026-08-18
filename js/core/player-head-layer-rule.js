export function isPlayerHeadItem(item) {
  return item?.kind === "snake";
}

export function activeLayerIndex(level, layerId = level?.activeLayerId) {
  const layers = Array.isArray(level?.layers) ? level.layers : [];
  if (layers.length === 0) return -1;
  const index = layers.findIndex((layer) => layer.id === layerId);
  return index >= 0 ? index : 0;
}

export function isPlayerHeadLayer(level, layerId = level?.activeLayerId) {
  return activeLayerIndex(level, layerId) === 0;
}

export function isSharedItemVisibleForLayer(item, level, layerId = level?.activeLayerId) {
  return !isPlayerHeadItem(item) || isPlayerHeadLayer(level, layerId);
}

export function visibleSharedItemForLayer(item, level, layerId = level?.activeLayerId) {
  return isSharedItemVisibleForLayer(item, level, layerId) ? item : null;
}
