import {
  cellKey,
  getTrayVisualPosition,
  indexToPosition,
  isInsideGrid,
  isTrayVisualInsideGrid,
  positionToIndex
} from "../utils/grid-utils.js";

export function deliverPointFromTrayPosition(trayPosition) {
  return { x: trayPosition.x, y: trayPosition.y + 1 };
}

export function trayPositionFromDeliverPoint(deliverPoint) {
  return { x: deliverPoint.x, y: deliverPoint.y - 1 };
}

export function trayPairIndexes(trayPosition, width) {
  const deliverPoint = deliverPointFromTrayPosition(trayPosition);
  return {
    trayPositionIndex: positionToIndex(trayPosition.x, trayPosition.y, width),
    deliverPointIndex: positionToIndex(deliverPoint.x, deliverPoint.y, width)
  };
}

export function validateTrayPair(grid, item, trayPosition) {
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

export function moveTrayByTrayPosition(state, context, trayPosition) {
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

export function moveTrayByTrayPositionIndex(state, context, index) {
  const value = Math.floor(Number(index));
  if (!Number.isInteger(value)) return { changed: false, reason: "invalid-index" };
  const total = state.grid.columns * state.grid.rows;
  if (value < 0 || value >= total) return { changed: false, reason: "tray-position-outside-grid" };
  return moveTrayByTrayPosition(state, context, indexToPosition(value, state.grid.columns));
}

export function moveTrayByDeliverPointIndex(state, context, index) {
  const value = Math.floor(Number(index));
  if (!Number.isInteger(value)) return { changed: false, reason: "invalid-index" };
  const total = state.grid.columns * state.grid.rows;
  if (value < 0 || value >= total) return { changed: false, reason: "deliver-point-outside-grid" };
  const deliverPoint = indexToPosition(value, state.grid.columns);
  return moveTrayByTrayPosition(state, context, trayPositionFromDeliverPoint(deliverPoint));
}
