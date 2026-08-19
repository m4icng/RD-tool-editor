import { BRIDGE_AXES, GATE_DIRECTIONS } from "../core/constants.js";
import { cellKey, indexToPosition, isInsideGrid, parseCellKey, positionToIndex } from "../utils/grid-utils.js";

export const PLACEMENT_MESSAGES = Object.freeze({
  "bridge-needs-crossroad": "Bridge chỉ được đặt tại ngã 4",
  "bridge-outside-grid": "Bridge cần đủ 3 ô ngang",
  "bridge-item-overlap": "Bridge không cho phép Item trong vùng 1 ô xung quanh",
  "gate-needs-priority-point": "Gate phải đứng trước PriorityPoint",
  "tunnel-needs-dead-end": "Tunnel chỉ được đặt tại Dead End"
});

const ELEMENT_DIRECTIONS = Object.freeze([
  { key: "up", x: 0, y: -1, direction: GATE_DIRECTIONS.UP },
  { key: "right", x: 1, y: 0, direction: GATE_DIRECTIONS.RIGHT },
  { key: "down", x: 0, y: 1, direction: GATE_DIRECTIONS.DOWN },
  { key: "left", x: -1, y: 0, direction: GATE_DIRECTIONS.LEFT }
]);

function sharedPathAt(state, x, y) {
  if (!isInsideGrid(state.grid, x, y)) return false;
  return Boolean(state.sharedCells?.[cellKey(x, y)]?.path);
}

export function pathConnectionsAt(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  return ELEMENT_DIRECTIONS
    .filter((direction) => sharedPathAt(state, position.x + direction.x, position.y + direction.y))
    .map((direction) => direction.direction);
}

export function bridgeVisualCells(state, index) {
  const center = indexToPosition(index, state.grid.columns);
  return [
    { x: center.x - 1, y: center.y },
    center,
    { x: center.x + 1, y: center.y }
  ].map((position) => ({
    ...position,
    index: isInsideGrid(state.grid, position.x, position.y)
      ? positionToIndex(position.x, position.y, state.grid.columns)
      : null
  }));
}

export function bridgeItemBlockCells(state, index) {
  const center = indexToPosition(index, state.grid.columns);
  const cells = [];
  for (let y = center.y - 1; y <= center.y + 1; y += 1) {
    for (let x = center.x - 1; x <= center.x + 1; x += 1) {
      cells.push({
        x,
        y,
        index: isInsideGrid(state.grid, x, y) ? positionToIndex(x, y, state.grid.columns) : null
      });
    }
  }
  return cells;
}

function hasItemBlockAt(state, x, y) {
  const key = cellKey(x, y);
  return (state.layers ?? []).some((layer) => layer.cells?.[key]?.item?.kind === "fruit");
}

export function validateBridgePlacement(state, index) {
  const cells = bridgeVisualCells(state, index);
  if (cells.some((position) => !isInsideGrid(state.grid, position.x, position.y))) {
    return { valid: false, reason: "bridge-outside-grid" };
  }
  const connections = new Set(pathConnectionsAt(state, index));
  const required = [GATE_DIRECTIONS.UP, GATE_DIRECTIONS.DOWN, GATE_DIRECTIONS.LEFT, GATE_DIRECTIONS.RIGHT];
  if (!required.every((direction) => connections.has(direction))) {
    return { valid: false, reason: "bridge-needs-crossroad" };
  }
  if (bridgeItemBlockCells(state, index).some((position) => hasItemBlockAt(state, position.x, position.y))) {
    return { valid: false, reason: "bridge-item-overlap" };
  }
  return { valid: true, axis: BRIDGE_AXES.HORIZONTAL };
}

export function findGatePriorityDirection(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  return ELEMENT_DIRECTIONS.find((direction) => (
    state.priorityPoints?.[cellKey(position.x + direction.x, position.y + direction.y)]
  ))?.direction ?? null;
}

export function validateGatePlacement(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  if (!sharedPathAt(state, position.x, position.y)) return { valid: false, reason: "gate-needs-priority-point" };
  const direction = findGatePriorityDirection(state, index);
  if (direction === null) return { valid: false, reason: "gate-needs-priority-point" };
  return { valid: true, direction };
}

export function findTunnelPathDirection(state, index) {
  const connections = pathConnectionsAt(state, index);
  return connections.length === 1 ? connections[0] : null;
}

export function validateTunnelPointPlacement(state, index) {
  const position = indexToPosition(index, state.grid.columns);
  if (!sharedPathAt(state, position.x, position.y)) return { valid: false, reason: "tunnel-needs-dead-end" };
  const direction = findTunnelPathDirection(state, index);
  if (direction === null) return { valid: false, reason: "tunnel-needs-dead-end" };
  return { valid: true, direction };
}

export function bridgeOccupiesIndex(state, index) {
  return Object.entries(state.sharedCells ?? {}).some(([key, cell]) => {
    if (cell?.element?.kind !== "bridge") return false;
    const centerPosition = parseCellKey(key);
    const center = positionToIndex(centerPosition.x, centerPosition.y, state.grid.columns);
    return bridgeItemBlockCells(state, center).some((position) => position.index === index);
  });
}
