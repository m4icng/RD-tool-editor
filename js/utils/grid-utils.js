import { normalizeCountBarrierCount, normalizeCountBarrierElement, nextCountBarrierSequence } from "../objects/count-barrier-object.js";
import { nextTunnelSequence, normalizeTunnelDraft, normalizeTunnelElement } from "../objects/tunnel-object.js";
import { nextOneWaySequence, normalizeOneWayDraft, normalizeOneWayElement } from "../objects/one-way-object.js";
import { visibleSharedItemForLayer } from "../core/player-head-layer-rule.js";

export const cellKey = (x, y) => `${x},${y}`;

export const TRAY_VISUAL_DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
});

export function positionToIndex(x, y, width) {
  return (y * width) + x;
}

export function indexToPosition(index, width) {
  return { x: index % width, y: Math.floor(index / width) };
}

export function parseCellKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function getTrayVisualPosition(item, deliverPoint) {
  const stored = item?.trayPosition;
  if (Number.isInteger(stored?.x) && Number.isInteger(stored?.y)) return { x: stored.x, y: stored.y };
  return { x: deliverPoint.x, y: deliverPoint.y - 1 };
}

export function getTrayVisualCells(item, deliverPoint) {
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

export function getTrayVisualBounds(item, deliverPoint) {
  const conveyor = getTrayVisualPosition(item, deliverPoint);
  return {
    left: conveyor.x - 1,
    right: conveyor.x + 1,
    top: conveyor.y - 3,
    bottom: conveyor.y
  };
}

export function isTrayVisualInsideGrid(grid, item, deliverPoint) {
  return getTrayVisualCells(item, deliverPoint).every((cell) => isInsideGrid(grid, cell.x, cell.y));
}

export function getTrayVisualDirection(item, deliverPoint) {
  const visual = getTrayVisualPosition(item, deliverPoint);
  return Object.entries(TRAY_VISUAL_DIRECTIONS)
    .find(([, vector]) => deliverPoint.x + vector.x === visual.x && deliverPoint.y + vector.y === visual.y)?.[0] ?? "up";
}

export function createFullGrassCells(grid, excludedKeys = new Set()) {
  const cells = {};
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      const key = cellKey(x, y);
      if (!excludedKeys.has(key)) cells[key] = true;
    }
  }
  return cells;
}

export function ensureTerrainState(state) {
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

export function normalizeMysteryFruitElement(entries = []) {
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

export function isMysteryFruitAt(state, layerNumber, index) {
  return normalizeMysteryFruitElement(state?.mysteryFruitElement)
    .some((entry) => entry.layer === layerNumber && entry.index.includes(index));
}

export function setMysteryFruitAt(state, layerNumber, index, hidden) {
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

export function isGrassAt(state, x, y) {
  ensureTerrainState(state);
  return Boolean(state.grassCells[cellKey(x, y)]);
}

export function isPriorityPointAt(state, x, y) {
  ensureTerrainState(state);
  return Boolean(state.priorityPoints[cellKey(x, y)]);
}

export function isInsideGrid(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.columns && y < grid.rows;
}

export function getCell(layer, x, y) {
  return layer.cells[cellKey(x, y)] ?? { path: false, item: null };
}

export function getMergedCell(level, x, y, layerId = level.activeLayerId) {
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

export function createMergedLayer(level, layerId = level.activeLayerId) {
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

export function trimCells(cells, grid) {
  return Object.fromEntries(Object.entries(cells).filter(([key]) => {
    const { x, y } = parseCellKey(key);
    return isInsideGrid(grid, x, y);
  }));
}

export function adjacentPositions(position) {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y }
  ];
}

export function countPathNeighbors(layer, x, y) {
  return adjacentPositions({ x, y }).filter((position) =>
    Boolean(getCell(layer, position.x, position.y).path)
  ).length;
}

export function isPathJunction(layer, x, y) {
  return getCell(layer, x, y).path && countPathNeighbors(layer, x, y) >= 3;
}

export function isPathTurnpoint(layer, x, y) {
  if (!getCell(layer, x, y).path) return false;
  const neighbors = adjacentPositions({ x, y }).filter((position) => Boolean(getCell(layer, position.x, position.y).path));
  if (neighbors.length >= 3) return true;
  if (neighbors.length !== 2) return false;
  const [first, second] = neighbors;
  return first.x !== second.x && first.y !== second.y;
}
