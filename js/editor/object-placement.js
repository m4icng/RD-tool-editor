import { findObject, cloneObject } from "../objects/object-registry.js";
import { TERRAIN_ASSET_IDS } from "../core/constants.js";
import {
  cellKey,
  createFullGrassCells,
  createMergedLayer,
  ensureTerrainState,
  getTrayVisualPosition,
  isInsideGrid,
  isPathTurnpoint,
  parseCellKey
} from "../utils/grid-utils.js";

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

export function eraseAtPosition(state, position, mode = "smart") {
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

export function applyTool(state, x, y, toolOverride = null) {
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

export function clearEntireMap(state) {
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

export function deleteItemAt(state, position) {
  return eraseAtPosition(state, position, "smart").changed;
}

export function togglePathAt(state, position) {
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
