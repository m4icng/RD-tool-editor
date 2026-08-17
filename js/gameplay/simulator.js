import { cellKey, createMergedLayer, isInsideGrid } from "../utils/grid-utils.js";
import { nextPosition } from "./snake-movement.js";
import { detectCollision } from "./collision-system.js";
import { collectFruit, deliverToTruck } from "./delivery-system.js";
import { isWinState } from "./win-condition.js";
import { normalizeTunnelElement } from "../objects/tunnel-object.js";
import { normalizeOneWayDirection, normalizeOneWayElement, oneWayDirectionKey, reverseOneWayDirection } from "../objects/one-way-object.js";

function findSnakeStart(layer) {
  for (const [key, cell] of Object.entries(layer.cells)) {
    if (cell.item?.kind === "snake") {
      const [x, y] = key.split(",").map(Number);
      return { x, y, direction: cell.item.direction ?? "right" };
    }
  }
  return null;
}

export function createSimulation(level) {
  const layer = structuredClone(createMergedLayer(level));
  const start = findSnakeStart(layer);
  if (!start) throw new Error("Không thể mô phỏng: thiếu điểm bắt đầu của rắn.");
  delete layer.cells[cellKey(start.x, start.y)].item;
  return {
    grid: structuredClone(level.grid),
    layer,
    tunnels: normalizeTunnelElement(level.tunnelElement),
    oneWays: normalizeOneWayElement(level.oneWayElement).map((oneWay) => ({
      ...oneWay,
      currentDirection: normalizeOneWayDirection(oneWay.entryPoints[0]?.direction),
      passedEntries: []
    })),
    snake: { body: [{ x: start.x, y: start.y }], direction: start.direction },
    inventory: {},
    delivered: {},
    status: "running",
    lastCollision: null
  };
}

function oneWayEntryAtIndex(oneWays, index) {
  for (const oneWay of Array.isArray(oneWays) ? oneWays : []) {
    const entryIndex = oneWay.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) return { oneWay, entryIndex, entryPoint: oneWay.entryPoints[entryIndex] };
  }
  return null;
}

function updateOneWayRuntime(state, headIndex) {
  const entry = oneWayEntryAtIndex(state.oneWays, headIndex);
  if (!entry) return;
  const runtime = state.oneWays.find((oneWay) => oneWay.oneWayId === entry.oneWay.oneWayId);
  if (!runtime) return;
  runtime.passedEntries = [...new Set([...(runtime.passedEntries ?? []), entry.entryIndex])];
  if (runtime.passedEntries.length >= 2) {
    runtime.currentDirection = reverseOneWayDirection(runtime.currentDirection);
    runtime.entryPoints = runtime.entryPoints.map((point) => ({ ...point, direction: runtime.currentDirection }));
    runtime.passedEntries = [];
  }
}

function tunnelEntryAtIndex(tunnels, index) {
  for (const tunnel of normalizeTunnelElement(tunnels)) {
    const entryIndex = tunnel.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) return { tunnel, entryPoint: tunnel.entryPoints[entryIndex], exitPoint: tunnel.entryPoints[entryIndex === 0 ? 1 : 0] };
  }
  return null;
}

function tunnelBodySlotVisible(state, position) {
  return isInsideGrid(state.grid, position.x, position.y)
    && Boolean(state.layer.cells[cellKey(position.x, position.y)]?.path);
}

function tunnelExitPathDirections(state, exitPosition, incomingDirection) {
  return Object.entries({
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  }).filter(([direction, vector]) => {
    const nextPosition = { x: exitPosition.x + vector.x, y: exitPosition.y + vector.y };
    const nextIndex = (nextPosition.y * state.grid.columns) + nextPosition.x;
    const oneWayEntry = oneWayEntryAtIndex(state.oneWays, nextIndex);
    if (oneWayEntry && oneWayDirectionKey(oneWayEntry.oneWay.currentDirection) !== direction) return false;
    const tempState = { ...state, snake: { ...state.snake, body: [{ ...exitPosition }], direction: incomingDirection } };
    return !detectCollision(tempState, nextPosition, direction, { ignoreSelfCollision: true });
  }).map(([direction]) => direction);
}

function actualTunnelExitDirection(state, exitPosition, incomingDirection) {
  const directions = tunnelExitPathDirections(state, exitPosition, incomingDirection);
  return directions.includes(incomingDirection) ? incomingDirection : directions[0] ?? incomingDirection;
}

function rebuildBodyFromTunnelExit(state, body, exitPosition, exitDirection) {
  const vector = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  }[exitDirection];
  return body.map((segment, index) => {
    const position = {
      x: exitPosition.x - (vector.x * index),
      y: exitPosition.y - (vector.y * index)
    };
    return {
      ...segment,
      ...position,
      direction: exitDirection,
      hiddenInTunnel: index > 0 && !tunnelBodySlotVisible(state, position)
    };
  });
}

function moveSimulationSnake(snake, direction) {
  const head = nextPosition(snake.body[0], direction);
  return {
    ...snake,
    direction,
    body: [
      { ...head, direction, hiddenInTunnel: false },
      ...snake.body.slice(0, -1).map((segment, index) => ({
        ...segment,
        hiddenInTunnel: Boolean(snake.body[index].hiddenInTunnel)
      }))
    ]
  };
}

export function stepSimulation(simulation, direction = simulation.snake.direction) {
  if (simulation.status !== "running") return simulation;
  const state = structuredClone(simulation);
  const head = nextPosition(state.snake.body[0], direction);
  const nextIndex = (head.y * state.grid.columns) + head.x;
  const tunnelEntry = tunnelEntryAtIndex(state.tunnels, nextIndex);
  const collision = detectCollision(state, head, direction, { ignoreSelfCollision: Boolean(tunnelEntry) });
  if (collision) {
    state.status = "lost";
    state.lastCollision = collision;
    return state;
  }
  const oneWayEntry = oneWayEntryAtIndex(state.oneWays, nextIndex);
  if (oneWayEntry && oneWayDirectionKey(oneWayEntry.oneWay.currentDirection) !== direction) {
    state.status = "lost";
    state.lastCollision = { type: "one-way", element: oneWayEntry.oneWay };
    return state;
  }

  state.snake = moveSimulationSnake(state.snake, direction);
  if (tunnelEntry) {
    const exit = { x: tunnelEntry.exitPoint.index % state.grid.columns, y: Math.floor(tunnelEntry.exitPoint.index / state.grid.columns) };
    state.snake.direction = actualTunnelExitDirection(state, exit, direction);
    state.snake.body = rebuildBodyFromTunnelExit(state, state.snake.body, exit, state.snake.direction);
  }
  const finalHead = state.snake.body[0];
  updateOneWayRuntime(state, (finalHead.y * state.grid.columns) + finalHead.x);
  const key = cellKey(finalHead.x, finalHead.y);
  const item = state.layer.cells[key]?.item;
  if (item?.kind === "fruit") {
    state.inventory = collectFruit(state.inventory, item.fruitType);
    state.layer.cells[key].item = null;
  } else if (item?.kind === "truck") {
    const result = deliverToTruck(state.inventory, item);
    state.inventory = result.inventory;
    state.delivered[item.fruitType] = (state.delivered[item.fruitType] ?? 0) + result.delivered;
    if (result.complete) state.layer.cells[key].item = null;
  }

  const items = Object.values(state.layer.cells).map((cell) => cell.item).filter(Boolean);
  const summary = {
    remainingFruits: items.filter((itemValue) => itemValue.kind === "fruit").length,
    inventoryTotal: Object.values(state.inventory).reduce((sum, value) => sum + value, 0),
    pendingTruckCapacity: items.filter((itemValue) => itemValue.kind === "truck").reduce((sum, truck) => sum + Number(truck.capacity || 0), 0)
  };
  if (isWinState(summary)) state.status = "won";
  return state;
}
