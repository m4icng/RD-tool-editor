import { FRUIT_TYPES } from "../core/constants.js";

export function activeTrayLayer(tray) {
  return tray.layers[tray.activeIndex] ?? null;
}

function layerIsComplete(layer) {
  return FRUIT_TYPES.every((type) => (layer.delivered[type] ?? 0) >= (layer.recipe[type] ?? 0));
}

export function advanceCompletedTrayLayers(tray) {
  const before = tray.activeIndex;
  while (activeTrayLayer(tray) && layerIsComplete(activeTrayLayer(tray))) tray.activeIndex += 1;
  return tray.activeIndex - before;
}

export function fillFruitIntoTray(tray, fruitType) {
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

export function fillFruitIntoAnyTray(session, fruitType) {
  for (const tray of session.trays ?? []) {
    const result = fillFruitIntoTray(tray, fruitType);
    if (result.filled) return { ...result, tray };
  }
  return { filled: false, completedLayerCount: 0, tray: null };
}

export function nextDeliverableCargoIndex(session, tray) {
  advanceCompletedTrayLayers(tray);
  const layer = activeTrayLayer(tray);
  if (!layer) return -1;
  return session.snake.body.findIndex((segment, index) => {
    if (index === 0 || !segment.fruitType) return false;
    return (layer.recipe[segment.fruitType] ?? 0) > (layer.delivered[segment.fruitType] ?? 0);
  });
}
