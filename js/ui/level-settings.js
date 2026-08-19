import {
  cellKey,
  ensureTerrainState,
  getTrayVisualCells,
  getTrayVisualPosition,
  indexToPosition,
  isInsideGrid,
  isTrayVisualInsideGrid,
  normalizeMysteryFruitElement,
  parseCellKey,
  positionToIndex
} from "../utils/grid-utils.js";
import { normalizeCountBarrierElement } from "../objects/count-barrier-object.js";
import { normalizeTunnelDraft, normalizeTunnelElement } from "../objects/tunnel-object.js";
import { normalizeOneWayDraft, normalizeOneWayElement } from "../objects/one-way-object.js";

const RESIZE_EDGES = new Set(["top", "bottom", "left", "right"]);

export function isMapSizeWithinBounds(grid) {
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

export function hasDataOnResizeEdge(state, edge) {
  if (!RESIZE_EDGES.has(edge) || !isMapSizeWithinBounds(state?.grid)) return false;
  ensureTerrainState(state);
  return hasPositionDataInArea(state, (position) => isPositionOnEdge(position, state.grid, edge));
}

export function hasDataOutsideGrid(state, nextGrid) {
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
      if (!trayPosition || !isInsideGrid(operation.nextGrid, trayPosition.x, trayPosition.y)) cell.item = null;
      else if (!isTrayVisualInsideGrid(operation.nextGrid, { ...cell.item, trayPosition }, oldPosition)) cell.item = null;
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

export function resizeMapEdge(state, edge, delta, { allowRemove = true } = {}) {
  const operation = createEdgeOperation(state.grid, edge, Number(delta));
  if (!operation.changed) return operation;
  if (Number(delta) < 0 && !allowRemove && hasDataOnResizeEdge(state, edge)) {
    return { changed: false, reason: "occupied" };
  }
  return applyResizeOperation(state, operation);
}

export function changeMapDimension(state, dimension, nextValue, { allowRemove = false } = {}) {
  const operation = createDimensionOperation(state.grid, dimension, nextValue);
  if (!operation.changed) return operation;
  if (state.grid[dimension] > operation.nextGrid[dimension] && !allowRemove && hasDataOutsideGrid(state, operation.nextGrid)) {
    return { changed: false, reason: "occupied" };
  }
  return applyResizeOperation(state, operation);
}
