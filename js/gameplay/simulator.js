import { cellKey, createMergedLayer } from "../utils/grid-utils.js";
import { nextPosition, moveSnake } from "./snake-movement.js";
import { detectCollision } from "./collision-system.js";
import { collectFruit, deliverToTruck } from "./delivery-system.js";
import { isWinState } from "./win-condition.js";

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
    snake: { body: [{ x: start.x, y: start.y }], direction: start.direction },
    inventory: {},
    delivered: {},
    status: "running",
    lastCollision: null
  };
}

export function stepSimulation(simulation, direction = simulation.snake.direction) {
  if (simulation.status !== "running") return simulation;
  const state = structuredClone(simulation);
  const head = nextPosition(state.snake.body[0], direction);
  const collision = detectCollision(state, head);
  if (collision) {
    state.status = "lost";
    state.lastCollision = collision;
    return state;
  }

  state.snake = moveSnake(state.snake, direction);
  const key = cellKey(head.x, head.y);
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
