import { isBridgeElement } from "../objects/bridge-object.js";
import { isGateElement } from "../objects/gate-object.js";
import { findCountBarrierAtIndex } from "../objects/count-barrier-object.js";
import { findTunnelAtIndex } from "../objects/tunnel-object.js";
import { findOneWayAtIndex } from "../objects/one-way-object.js";
import { visibleSharedItemForLayer } from "../core/player-head-layer-rule.js";
import {
  cellKey,
  ensureTerrainState,
  isMysteryFruitAt,
  positionToIndex
} from "../utils/grid-utils.js";

function activeLayerContext(state, position) {
  const layer = state.layers?.find((candidate) => candidate.id === state.activeLayerId);
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

function trayAtDeliverPoint(state, index) {
  return Object.entries(state.sharedCells ?? {}).find(([key, cell]) => {
    if (!["tray", "truck"].includes(cell.item?.kind)) return false;
    const [deliverX, deliverY] = key.split(",").map(Number);
    if (!Number.isInteger(deliverX) || !Number.isInteger(deliverY)) return false;
    return positionToIndex(deliverX, deliverY, state.grid.columns) === index;
  });
}

function getElementTargets(state, context) {
  const targets = [];
  if (isBridgeElement(context.shared.element)) targets.push({ mode: "bridge", label: targetLabel("bridge") });
  if (isGateElement(context.shared.element)) targets.push({ mode: "gate", label: targetLabel("gate") });
  const tunnel = findTunnelAtIndex(state, context.index);
  if (tunnel) targets.push({ mode: "tunnel", label: `Tunnel #${tunnel.tunnelId}` });
  const oneWay = findOneWayAtIndex(state, context.index);
  if (oneWay) targets.push({ mode: "one-way", label: `One Way #${oneWay.oneWayId}` });
  const barrier = findCountBarrierAtIndex(state, context.index);
  if (barrier) targets.push({ mode: "count-barrier", label: `Count Barrier #${barrier.barrierId}` });
  if (context.layerCell.item?.kind === "fruit" && isMysteryFruitAt(state, context.layerNumber, context.index)) {
    targets.push({ mode: "mystery-fruit", label: targetLabel("mystery-fruit") });
  }
  return targets;
}

export function getDeleteTargets(state, position) {
  ensureTerrainState(state);
  const context = activeLayerContext(state, position);
  if (!context) return [];
  const targets = [];
  targets.push(...getElementTargets(state, context));
  if (context.layerCell.item?.kind === "fruit" || (context.shared.item && !["tray", "truck"].includes(context.shared.item.kind))) {
    targets.push({ mode: "item", label: context.layerCell.item?.label ?? context.shared.item?.label ?? targetLabel("item") });
  }
  if (state.priorityPoints?.[context.key]) targets.push({ mode: "priority", label: targetLabel("priority") });
  if (trayAtDeliverPoint(state, context.index)) targets.push({ mode: "tray", label: targetLabel("tray") });
  if (context.shared.path) targets.push({ mode: "path", label: targetLabel("path") });
  if (state.grassCells?.[context.key]) targets.push({ mode: "grass", label: targetLabel("grass") });
  return targets;
}

export function getSmartDeleteTarget(state, position) {
  return getDeleteTargets(state, position)[0] ?? null;
}
