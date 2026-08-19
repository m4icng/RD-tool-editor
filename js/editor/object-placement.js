import { findObject, cloneObject } from "../objects/object-registry.js";
import { TERRAIN_ASSET_IDS } from "../core/constants.js";
import { isPlayerHeadItem, isPlayerHeadLayer, visibleSharedItemForLayer } from "../core/player-head-layer-rule.js";
import { isBridgeElement, normalizeBridgeAxis } from "../objects/bridge-object.js";
import { isGateElement, normalizeGateDirection } from "../objects/gate-object.js";
import {
  createNewActiveCountBarrier,
  findCountBarrierAtIndex,
  isCountBarrierTool,
  normalizeCountBarrierCount,
  normalizeCountBarrierElement,
  removeCountBarrierAtIndex
} from "../objects/count-barrier-object.js";
import { findTunnelAtIndex, isTunnelTool, placeTunnelDraftPointB, removeTunnelAtIndex, startTunnelDraftAt } from "../objects/tunnel-object.js";
import { findOneWayAtIndex, isOneWayTool, placeOneWayDraftPointB, removeOneWayAtIndex, startOneWayDraftAt } from "../objects/one-way-object.js";
import {
  cellKey,
  createFullGrassCells,
  createMergedLayer,
  ensureTerrainState,
  isMysteryFruitAt,
  isInsideGrid,
  isTrayVisualInsideGrid,
  isPathJunction,
  parseCellKey,
  positionToIndex,
  setMysteryFruitAt
} from "../utils/grid-utils.js";

function junctionKeys(state) {
  const layer = createMergedLayer(state);
  return new Set(Object.keys(layer.cells ?? {}).filter((key) => {
    if (isBridgeElement(state.sharedCells?.[key]?.element)) return false;
    const { x, y } = parseCellKey(key);
    return isPathJunction(layer, x, y);
  }));
}

function syncAutoPriorityPoints(state, beforeJunctions) {
  const afterJunctions = junctionKeys(state);
  Object.entries(state.priorityPoints).forEach(([key, source]) => {
    if (source === "auto" && !afterJunctions.has(key)) delete state.priorityPoints[key];
  });
  afterJunctions.forEach((key) => {
    if (!beforeJunctions.has(key) && !state.priorityPoints[key]) state.priorityPoints[key] = "auto";
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

function activeLayerContext(state, position) {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId);
  if (!layer || !position) return null;
  const key = cellKey(position.x, position.y);
  const rawShared = state.sharedCells?.[key] ?? { path: false, item: null, element: null };
  return {
    layer,
    key,
    layerNumber: Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer),
    shared: { ...rawShared, item: visibleSharedItemForLayer(rawShared.item, state, layer.id) },
    layerCell: layer.cells?.[key] ?? { item: null },
    index: positionToIndex(position.x, position.y, state.grid.columns)
  };
}

function targetLabel(target) {
  return {
    priority: "PriorityPoint",
    path: "Path",
    grass: "Grass",
    item: "Item",
    "mystery-fruit": "Mystery Fruit",
    bridge: "Bridge",
    gate: "Gate",
    tunnel: "Tunnel",
    "one-way": "One Way",
    "count-barrier": "Count Barrier",
    tray: "Tray"
  }[target] ?? target;
}

export function getEraseTargets(state, position) {
  ensureTerrainState(state);
  const context = activeLayerContext(state, position);
  if (!context) return [];
  const targets = [];
  if (state.priorityPoints?.[context.key]) targets.push({ mode: "priority", label: targetLabel("priority") });
  if (isBridgeElement(context.shared.element)) targets.push({ mode: "bridge", label: targetLabel("bridge") });
  if (isGateElement(context.shared.element)) targets.push({ mode: "gate", label: targetLabel("gate") });
  if (findTunnelAtIndex(state, context.index)) targets.push({ mode: "tunnel", label: targetLabel("tunnel") });
  if (findOneWayAtIndex(state, context.index)) targets.push({ mode: "one-way", label: targetLabel("one-way") });
  if (findCountBarrierAtIndex(state, context.index)) targets.push({ mode: "count-barrier", label: targetLabel("count-barrier") });
  if (context.layerCell.item?.kind === "fruit" && isMysteryFruitAt(state, context.layerNumber, context.index)) {
    targets.push({ mode: "mystery-fruit", label: targetLabel("mystery-fruit") });
  }
  if (context.layerCell.item?.kind === "fruit" || (context.shared.item && !["tray", "truck"].includes(context.shared.item.kind))) {
    targets.push({ mode: "item", label: context.layerCell.item?.label ?? context.shared.item?.label ?? targetLabel("item") });
  }
  if (["tray", "truck"].includes(context.shared.item?.kind)) targets.push({ mode: "tray", label: targetLabel("tray") });
  if (context.shared.path) targets.push({ mode: "path", label: targetLabel("path") });
  if (state.grassCells?.[context.key]) targets.push({ mode: "grass", label: targetLabel("grass") });
  return targets;
}

function eraseCellLayers(shared, layerCell, mode, { protectPath = false, allowPlayerHeadDelete = true } = {}) {
  const removeLayerItem = () => {
    if (layerCell.item?.kind !== "fruit") return false;
    layerCell.item = null;
    return true;
  };
  const removeSharedItem = () => {
    if (objectCategory(shared.item) !== "item" || ["tray", "truck"].includes(shared.item?.kind)) return false;
    if (isPlayerHeadItem(shared.item) && !allowPlayerHeadDelete) return false;
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
  if (mode === "tray") {
    if (!["tray", "truck"].includes(shared.item?.kind)) return { changed: false };
    shared.item = null;
    return { changed: true, removed: "tray" };
  }
  if (mode === "bridge") {
    if (!isBridgeElement(shared.element)) return { changed: false };
    shared.element = null;
    return { changed: true, removed: "bridge" };
  }
  if (mode === "gate") {
    if (!isGateElement(shared.element)) return { changed: false };
    shared.element = null;
    return { changed: true, removed: "gate" };
  }
  if (mode === "element") return { changed: removeElement(), removed: "element" };
  if (mode === "path") return removePath();

  if (removeElement()) return { changed: true, removed: "element" };
  if (removeLayerItem()) return { changed: true, removed: "layer-item" };
  if (removeSharedItem()) return { changed: true, removed: "shared-item" };
  return removePath();
}

export function eraseAtPosition(state, position, mode = "smart") {
  const layer = state.layers.find((candidate) => candidate.id === state.activeLayerId);
  if (!layer || !position) return { changed: false };
  ensureTerrainState(state);
  state.sharedCells ??= {};
  const key = cellKey(position.x, position.y);
  const beforeJunctions = junctionKeys(state);
  const shared = structuredClone(state.sharedCells[key] ?? { path: false, item: null, element: null });
  const layerCell = structuredClone(layer.cells[key] ?? { item: null });
  const hasElement = Boolean(shared.element) || objectCategory(shared.item) === "element";
  if (mode === "grass") {
    if (!state.grassCells[key]) return { changed: false };
    delete state.grassCells[key];
    state.selectedCell = { x: position.x, y: position.y };
    return { changed: true, removed: "grass" };
  }
  if (mode === "priority") {
    if (!state.priorityPoints[key]) return { changed: false };
    delete state.priorityPoints[key];
    state.selectedCell = { x: position.x, y: position.y };
    return { changed: true, removed: "priority-point" };
  }
  if (mode === "mystery-fruit") {
    const layerNumber = Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer);
    const changed = setMysteryFruitAt(state, layerNumber, positionToIndex(position.x, position.y, state.grid.columns), false);
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "mystery-fruit" : null };
  }
  if (mode === "count-barrier") {
    const changed = removeCountBarrierAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "count-barrier" : null };
  }
  if (mode === "tunnel") {
    const changed = removeTunnelAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "tunnel" : null };
  }
  if (mode === "one-way") {
    const changed = removeOneWayAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    state.selectedCell = { x: position.x, y: position.y };
    return { changed, removed: changed ? "one-way" : null };
  }
  if (mode === "smart" && state.priorityPoints[key] && !hasElement) {
    delete state.priorityPoints[key];
    state.selectedCell = { x: position.x, y: position.y };
    return { changed: true, removed: "priority-point" };
  }
  const fruitOnOtherLayer = state.layers.some((candidate) => candidate.id !== layer.id && candidate.cells?.[key]?.item?.kind === "fruit");
  const result = eraseCellLayers(shared, layerCell, mode, {
    protectPath: mode === "smart" && fruitOnOtherLayer,
    allowPlayerHeadDelete: isPlayerHeadLayer(state, layer.id)
  });
  if (result.removed === "layer-item") {
    setMysteryFruitAt(state, Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer), positionToIndex(position.x, position.y, state.grid.columns), false);
  }

  if (result.removed === "path") {
    state.grassCells[key] = true;
    delete state.priorityPoints[key];
    removeCountBarrierAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    removeTunnelAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.tunnelDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.tunnelDraft = null;
    removeOneWayAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.oneWayDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.oneWayDraft = null;
  }

  if (!shared.path && !shared.item && !shared.element) delete state.sharedCells[key];
  else state.sharedCells[key] = shared;
  if (!layerCell.item) delete layer.cells[key];
  else layer.cells[key] = layerCell;
  state.selectedCell = { x: position.x, y: position.y };
  if (result.removed === "path") syncAutoPriorityPoints(state, beforeJunctions);
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
    const beforeJunctions = junctionKeys(state);
    shared.path = true;
    delete state.grassCells[key];
    state.sharedCells[key] = shared;
    syncAutoPriorityPoints(state, beforeJunctions);
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
      if (isPlayerHeadItem(object) && !isPlayerHeadLayer(state, layer.id)) {
        state.selectedCell = { x, y };
        return { changed: false, reason: "player-head-layer-locked", objectId: object.id };
      }
      const placed = object.uniqueOnMap ? findPlacedObject(state, object.id) : null;
      if (placed && placed.key !== key) {
        state.selectedCell = { x, y };
        return { changed: false, reason: "unique-object-exists", objectId: object.id };
      }
      if (isPlayerHeadItem(object)) {
        if (shared.item && shared.item.id !== object.id) return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        if (layerCell.item) return { changed: false, reason: "fruit-position-occupied", objectId: object.id };
        shared.item = cloneObject(object);
        shared.path = true;
      } else if (object.kind === "fruit") {
        const index = positionToIndex(x, y, state.grid.columns);
        const barrier = findCountBarrierAtIndex(state, index);
        if (barrier && (barrier.startIndex === index || barrier.endIndex === index)) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "fruit-on-barrier-endpoint", objectId: object.id };
        }
        shared.path = true;
        if (shared.item && !isPlayerHeadItem(shared.item)) return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        if (shared.item && isPlayerHeadLayer(state, layer.id)) return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        layerCell.item = cloneObject(object);
      } else if (object.kind === "mystery-fruit") {
        const layerNumber = Number.isInteger(layer.layer) ? layer.layer : state.layers.indexOf(layer);
        const index = positionToIndex(x, y, state.grid.columns);
        if (layerCell.item?.kind !== "fruit") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "mystery-needs-fruit", objectId: object.id };
        }
        const hidden = !setMysteryFruitAt(state, layerNumber, index, false);
        setMysteryFruitAt(state, layerNumber, index, hidden);
        state.selectedCell = { x, y };
        return { changed: true, action: hidden ? "mystery-added" : "mystery-removed" };
      } else if (isCountBarrierTool(object)) {
        const index = positionToIndex(x, y, state.grid.columns);
        if (!shared.path) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "barrier-needs-path", objectId: object.id };
        }
        const existing = findCountBarrierAtIndex(state, index);
        if (existing) {
          state.activeBarrierId = existing.barrierId;
          state.selectedCountBarrierCount = normalizeCountBarrierCount(existing.count);
          state.selectedCell = { x, y };
          return { changed: true, action: "count-barrier-selected", barrierId: existing.barrierId };
        }
        state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
        if (!Number.isInteger(state.activeBarrierId)) createNewActiveCountBarrier(state);
        let barrier = state.countBarrierElement.find((entry) => entry.barrierId === state.activeBarrierId);
        if (!barrier) {
          barrier = {
            barrierId: state.activeBarrierId,
            count: normalizeCountBarrierCount(state.selectedCountBarrierCount),
            startIndex: index,
            endIndex: index,
            index: []
          };
          state.countBarrierElement.push(barrier);
        }
        if (!barrier.index.includes(index)) barrier.index.push(index);
        barrier.index = [...new Set(barrier.index)].sort((a, b) => a - b);
        barrier.endIndex = index;
        barrier.count = normalizeCountBarrierCount(barrier.count);
        state.selectedCell = { x, y };
        return { changed: true, action: "count-barrier-updated", barrierId: barrier.barrierId };
      } else if (isTunnelTool(object)) {
        const index = positionToIndex(x, y, state.grid.columns);
        if (!shared.path) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "tunnel-needs-path", objectId: object.id };
        }
        if (state.tunnelDraft?.step === "direction-a") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "tunnel-needs-direction-a", objectId: object.id };
        }
        if (state.tunnelDraft?.step === "direction-b") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "tunnel-needs-direction-b", objectId: object.id };
        }
        if (state.tunnelDraft?.step === "point-b") {
          const placement = placeTunnelDraftPointB(state, index);
          state.selectedCell = { x, y };
          return placement;
        }
        const existing = findTunnelAtIndex(state, index);
        if (existing) {
          state.activeTunnelId = existing.tunnelId;
          state.selectedCell = { x, y };
          return { changed: true, action: "tunnel-selected", tunnelId: existing.tunnelId };
        }
        const placement = startTunnelDraftAt(state, index);
        state.selectedCell = { x, y };
        return placement;
      } else if (isOneWayTool(object)) {
        const index = positionToIndex(x, y, state.grid.columns);
        if (!shared.path) {
          state.selectedCell = { x, y };
          return { changed: false, reason: "one-way-needs-path", objectId: object.id };
        }
        if (state.oneWayDraft?.step === "direction-a") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "one-way-needs-direction-a", objectId: object.id };
        }
        if (state.oneWayDraft?.step === "direction-b") {
          state.selectedCell = { x, y };
          return { changed: false, reason: "one-way-needs-direction-b", objectId: object.id };
        }
        if (state.oneWayDraft?.step === "point-b") {
          const placement = placeOneWayDraftPointB(state, index);
          state.selectedCell = { x, y };
          return placement;
        }
        const existing = findOneWayAtIndex(state, index);
        if (existing) {
          state.activeOneWayId = existing.oneWayId;
          state.selectedCell = { x, y };
          return { changed: true, action: "one-way-selected", oneWayId: existing.oneWayId };
        }
        const placement = startOneWayDraftAt(state, index);
        state.selectedCell = { x, y };
        return placement;
      } else if (objectCategory(object) === "element") {
        if (isGateElement(object) && !shared.path) {
          return { changed: false, reason: "gate-needs-path", objectId: object.id };
        }
        if (shared.element && shared.element.id !== object.id) {
          return { changed: false, reason: "element-position-occupied", objectId: shared.element.id };
        }
        const element = cloneObject(object);
        if (isBridgeElement(element)) element.axis = normalizeBridgeAxis(state.selectedBridgeAxis ?? element.axis);
        if (isGateElement(element)) element.direction = normalizeGateDirection(state.selectedGateDirection ?? element.direction);
        shared.element = element;
        if (isBridgeElement(element)) delete state.priorityPoints[key];
      } else {
        if (shared.item && shared.item.id !== object.id) {
          return { changed: false, reason: "shared-position-occupied", objectId: shared.item.id };
        }
        const fruitAtPosition = state.layers.some((candidate) => candidate.cells?.[key]?.item?.kind === "fruit");
        if (fruitAtPosition) return { changed: false, reason: "fruit-position-occupied", objectId: object.id };
        if (["tray", "truck"].includes(object.kind)) {
          if (!shared.path) return { changed: false, reason: "tray-checkpoint-needs-road", objectId: object.id };
          const visualPosition = { x, y: y - 1 };
          if (!isTrayVisualInsideGrid(state.grid, { ...object, trayPosition: visualPosition }, { x, y })) return { changed: false, reason: "tray-visual-outside-grid", objectId: object.id };
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
  state.mysteryFruitElement = [];
  state.countBarrierElement = [];
  state.activeBarrierId = null;
  state.nextBarrierId = 0;
  state.drawingCountBarrierId = null;
  state.tunnelElement = [];
  state.activeTunnelId = null;
  state.nextTunnelId = 0;
  state.tunnelDraft = null;
  state.oneWayElement = [];
  state.activeOneWayId = null;
  state.nextOneWayId = 0;
  state.oneWayDraft = null;
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
  const beforeJunctions = junctionKeys(state);
  cell.path = !cell.path;
  if (cell.path) delete state.grassCells[key];
  else {
    state.grassCells[key] = true;
    delete state.priorityPoints[key];
  }
  if (!cell.path) {
    cell.item = null;
    cell.element = null;
    removeCountBarrierAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    removeTunnelAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.tunnelDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.tunnelDraft = null;
    removeOneWayAtIndex(state, positionToIndex(position.x, position.y, state.grid.columns));
    if (state.oneWayDraft?.entryPoints?.some((point) => point.index === positionToIndex(position.x, position.y, state.grid.columns))) state.oneWayDraft = null;
    state.layers.forEach((layer) => { delete layer.cells[key]; });
    state.layers.forEach((layer, index) => {
      setMysteryFruitAt(state, Number.isInteger(layer.layer) ? layer.layer : index, positionToIndex(position.x, position.y, state.grid.columns), false);
    });
  }
  if (!cell.path && !cell.item && !cell.element) delete state.sharedCells[key];
  else state.sharedCells[key] = cell;
  syncAutoPriorityPoints(state, beforeJunctions);
}
