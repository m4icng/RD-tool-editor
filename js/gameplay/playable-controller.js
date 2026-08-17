import { DIRECTIONS, FRUIT_TYPES } from "../core/constants.js";
import { applyVisualScaleConfig } from "../core/visual-scale.js";
import { bridgeAllowsDifferentAxisOverlap, isBridgeElement, normalizeBridgeAxis } from "../objects/bridge-object.js";
import { gateDirectionClass, gateDirectionFromMovement, gateDirectionLabel, isGateElement, isValidGateDirection, normalizeGateDirection } from "../objects/gate-object.js";
import { normalizeCountBarrierElement } from "../objects/count-barrier-object.js";
import {
  isValidTunnelDirection,
  normalizeTunnelElement,
  tunnelColor,
  tunnelDirectionClass,
  tunnelDirectionIcon,
} from "../objects/tunnel-object.js";
import {
  isValidOneWayDirection,
  normalizeOneWayDirection,
  normalizeOneWayElement,
  oneWayColor,
  oneWayDirectionClass,
  oneWayDirectionIcon,
  oneWayDirectionKey,
  reverseOneWayDirection
} from "../objects/one-way-object.js";
import { cellKey, createMergedLayer, ensureTerrainState, getTrayVisualPosition, isInsideGrid, isMysteryFruitAt, positionToIndex } from "../utils/grid-utils.js";

export const PLAY_STATUS = Object.freeze({
  READY: "ready",
  MOVING: "moving",
  DELIVERING: "delivering",
  WAITING: "waiting",
  PAUSED: "paused",
  WON: "won",
  LOST: "lost",
  BLOCKED: "blocked",
  TELEPORTING: "teleporting"
});

const OPPOSITE = Object.freeze({ up: "down", down: "up", left: "right", right: "left" });
const DIRECTION_LABELS = Object.freeze({ up: "↑ Lên", down: "↓ Xuống", left: "← Trái", right: "→ Phải" });
const FRUIT_ICONS = Object.freeze({ apple: "🍎", banana: "🍌", grape: "🍇", eggplant: "🍆" });
const STATUS_COPY = Object.freeze({
  ready: ["Sẵn sàng", "Chọn một hướng hợp lệ để bắt đầu."],
  moving: ["Đang chạy", "Rắn đang tự di chuyển trên đoạn đường hiện tại."],
  delivering: ["Đang giao hàng", "Rắn dừng tại checkpoint; vật phẩm phù hợp đang được đưa vào khay lần lượt."],
  waiting: ["Chờ hướng", "Rắn đã dừng. Hãy chọn hướng tiếp theo."],
  paused: ["Đã pause", "Nhấn Resume để tiếp tục phiên chơi."],
  won: ["Hoàn thành", "Tất cả layer của mọi khay đã được giao đủ."],
  lost: ["Thua", "Rắn đã va chạm hoặc không còn hướng hợp lệ."],
  blocked: ["Chưa thể chơi", "Hãy sửa các lỗi level được liệt kê bên dưới."],
  teleporting: ["Đang qua Tunnel", "Train đang được đặt lại theo cổng ra."]
});

function gateAllowsMovement(element, direction) {
  return !isGateElement(element) || gateDirectionFromMovement(direction) === normalizeGateDirection(element.direction);
}

function tunnelEntryAtIndex(tunnels, index) {
  for (const tunnel of normalizeTunnelElement(tunnels)) {
    const entryIndex = tunnel.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) {
      return {
        tunnel,
        entryIndex,
        entryPoint: tunnel.entryPoints[entryIndex],
        exitPoint: tunnel.entryPoints[entryIndex === 0 ? 1 : 0]
      };
    }
  }
  return null;
}

function tunnelBodySlotVisible(session, position) {
  return isInsideGrid(session.grid, position.x, position.y)
    && Boolean(session.layer.cells[cellKey(position.x, position.y)]?.path);
}

function rebuildBodyFromTunnelExit(session, body, exitPosition, exitDirection) {
  const vector = DIRECTIONS[exitDirection];
  return body.map((segment, index) => {
    const position = {
      x: exitPosition.x - (vector.x * index),
      y: exitPosition.y - (vector.y * index)
    };
    return {
      ...segment,
      ...position,
      direction: exitDirection,
      hiddenInTunnel: index > 0 && !tunnelBodySlotVisible(session, position)
    };
  });
}

function nextTailPosition(session, body, direction) {
  const tail = body[body.length - 1];
  const vector = DIRECTIONS[direction];
  const position = {
    x: tail.x - vector.x,
    y: tail.y - vector.y
  };
  return {
    ...position,
    direction,
    hiddenInTunnel: Boolean(tail.hiddenInTunnel) || !tunnelBodySlotVisible(session, position)
  };
}

function tailLogicDisabled(session) {
  return Boolean(session?.teleporting || session?.tailDisabled);
}

function tunnelExitPathDirections(session, exitPosition, incomingDirection) {
  const exitCell = session.layer.cells[cellKey(exitPosition.x, exitPosition.y)];
  return Object.entries(DIRECTIONS).filter(([direction, vector]) => {
    if (isBridgeElement(exitCell?.element) && incomingDirection && direction !== incomingDirection) return false;
    const nextPosition = { x: exitPosition.x + vector.x, y: exitPosition.y + vector.y };
    const nextCell = session.layer.cells[cellKey(nextPosition.x, nextPosition.y)];
    if (!gateAllowsMovement(exitCell?.element, direction) || !gateAllowsMovement(nextCell?.element, direction)) return false;
    if (!oneWayAllowsMovement(session, positionToIndex(nextPosition.x, nextPosition.y, session.grid.columns), direction)) return false;
    return cellIsTraversable(session, nextPosition, direction, { ignoreSelfCollision: true });
  }).map(([direction]) => direction);
}

function actualTunnelExitDirection(session, exitPosition, incomingDirection) {
  const directions = tunnelExitPathDirections(session, exitPosition, incomingDirection);
  const autoDirection = nextAutoDirection({ ...session, snake: { body: [{ ...exitPosition }], direction: incomingDirection } }, directions);
  return autoDirection ?? (directions.includes(incomingDirection) ? incomingDirection : directions[0] ?? incomingDirection);
}

function oneWayEntryAtIndex(oneWays, index) {
  for (const oneWay of Array.isArray(oneWays) ? oneWays : []) {
    const entryIndex = oneWay.entryPoints.findIndex((point) => point.index === index);
    if (entryIndex >= 0) {
      return {
        oneWay,
        entryIndex,
        entryPoint: oneWay.entryPoints[entryIndex]
      };
    }
  }
  return null;
}

function firstFruitLayerId(level) {
  return level?.layers?.[0]?.id ?? level?.activeLayerId;
}

function activeLayer(level, layerId = level?.activeLayerId) {
  return createMergedLayer(level, layerId);
}

function fruitLayersForPlayable(level) {
  if (!level?.sharedCells) {
    const layer = activeLayer(level);
    return layer ? [{ id: layer.id, name: layer.name, cells: structuredClone(layer.cells ?? {}) }] : [];
  }
  return (level.layers ?? []).map((layer, index) => ({
    id: layer.id,
    name: layer.name ?? `Layer ${String(index + 1).padStart(2, "0")}`,
    cells: Object.fromEntries(Object.entries(layer.cells ?? {}).filter(([, cell]) => cell?.item?.kind === "fruit"))
  }));
}

function entriesWithPosition(layer) {
  return Object.entries(layer?.cells ?? {}).map(([key, cell]) => {
    const [x, y] = key.split(",").map(Number);
    return { key, x, y, cell };
  });
}

function normalizeTrayLayers(item) {
  if (item.kind === "truck") {
    return [{ id: `${item.id ?? "legacy-truck"}-layer`, recipe: { [item.fruitType]: Number(item.capacity) || 0 } }];
  }
  return (item.trayLayers ?? []).map((layer, index) => ({
    id: layer.id ?? `tray-layer-${index + 1}`,
    recipe: Object.fromEntries(FRUIT_TYPES.map((type) => [type, Number(layer.recipe?.[type]) || 0]))
  }));
}

export function validatePlayableLevel(level) {
  ensureTerrainState(level);
  const errors = [];
  const mapIndex = (x, y) => positionToIndex(x, y, level?.grid?.columns ?? 0);
  const layer = activeLayer(level ?? {}, firstFruitLayerId(level));
  if (!level?.grid || !layer) return { valid: false, errors: ["Level chưa có grid hoặc layer để chơi."], layer: null };

  const entries = entriesWithPosition(layer);
  const starts = entries.filter(({ cell }) => cell.item?.kind === "snake");
  const trays = entries.filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind));
  const fruitLayers = fruitLayersForPlayable(level);
  const fruits = fruitLayers.flatMap((fruitLayer, layerIndex) => entriesWithPosition(fruitLayer)
    .filter(({ cell }) => cell.item?.kind === "fruit")
    .map((entry) => ({ ...entry, layerIndex })));
  if (starts.length !== 1) errors.push(`Cần đúng 1 đầu rắn trong layer đang chơi (hiện có ${starts.length}).`);
  if (fruits.length === 0) errors.push("Cần ít nhất 1 trái cây trên map.");
  if (trays.length === 0) errors.push("Cần ít nhất 1 khay chứa trên map.");
  Object.keys(level.priorityPoints ?? {}).forEach((key) => {
    if (!level.sharedCells?.[key]?.path) errors.push(`PriorityPoint Index ${mapIndex(...key.split(",").map(Number))} phải thuộc Path.`);
  });
  entries.forEach(({ x, y, cell }) => {
    if (!isGateElement(cell.element)) return;
    if (!cell.path) errors.push(`Gate tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
    if (!isValidGateDirection(cell.element.direction)) errors.push(`Gate tại Index ${mapIndex(x, y)} có direction không hợp lệ.`);
  });
  const barrierIndexes = new Set();
  const barrierEndpointIndexes = new Set();
  normalizeCountBarrierElement(level.countBarrierElement).forEach((barrier) => {
    const localIndexes = new Set(barrier.index);
    barrierEndpointIndexes.add(barrier.startIndex);
    barrierEndpointIndexes.add(barrier.endIndex);
    if (barrier.index.length < 2) errors.push(`Count Barrier ${barrier.barrierId} phải khóa ít nhất 2 ô Path.`);
    if (barrier.startIndex === barrier.endIndex) errors.push(`Count Barrier ${barrier.barrierId} phải có startIndex và endIndex khác nhau.`);
    if (!localIndexes.has(barrier.startIndex) || !localIndexes.has(barrier.endIndex)) errors.push(`Count Barrier ${barrier.barrierId} start/end phải nằm trong index.`);
    barrier.index.forEach((index) => {
      const { x, y } = { x: index % level.grid.columns, y: Math.floor(index / level.grid.columns) };
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`Count Barrier ${barrier.barrierId} Index ${index} nằm ngoài map.`);
        return;
      }
      if (!layer.cells[cellKey(x, y)]?.path) errors.push(`Count Barrier ${barrier.barrierId} Index ${index} phải nằm trên Path.`);
      if (barrierIndexes.has(index)) errors.push(`Count Barrier không được chồng index ${index}.`);
      barrierIndexes.add(index);
    });
  });
  const tunnelIndexes = new Set();
  normalizeTunnelElement(level.tunnelElement).forEach((tunnel) => {
    if (tunnel.entryPoints.length !== 2) errors.push(`Tunnel ${tunnel.tunnelId} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    tunnel.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = { x: point.index % level.grid.columns, y: Math.floor(point.index / level.grid.columns) };
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`Tunnel ${tunnel.tunnelId} Entry ${name} Index ${point.index} nằm ngoài map.`);
        return;
      }
      if (!layer.cells[cellKey(x, y)]?.path) errors.push(`Tunnel ${tunnel.tunnelId} Entry ${name} Index ${point.index} phải nằm trên Path.`);
      if (!isValidTunnelDirection(point.direction)) errors.push(`Tunnel ${tunnel.tunnelId} Entry ${name} direction không hợp lệ.`);
      if (localIndexes.has(point.index)) errors.push(`Tunnel ${tunnel.tunnelId} không được dùng cùng index cho hai entryPoint.`);
      if (tunnelIndexes.has(point.index)) errors.push(`Tunnel không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      tunnelIndexes.add(point.index);
    });
  });
  const oneWayIndexes = new Set();
  normalizeOneWayElement(level.oneWayElement).forEach((oneWay) => {
    if (oneWay.entryPoints.length !== 2) errors.push(`One Way ${oneWay.oneWayId} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    oneWay.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = { x: point.index % level.grid.columns, y: Math.floor(point.index / level.grid.columns) };
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`One Way ${oneWay.oneWayId} Entry ${name} Index ${point.index} nằm ngoài map.`);
        return;
      }
      if (!layer.cells[cellKey(x, y)]?.path) errors.push(`One Way ${oneWay.oneWayId} Entry ${name} Index ${point.index} phải nằm trên Path.`);
      if (!isValidOneWayDirection(point.direction)) errors.push(`One Way ${oneWay.oneWayId} Entry ${name} direction không hợp lệ.`);
      if (localIndexes.has(point.index)) errors.push(`One Way ${oneWay.oneWayId} không được dùng cùng index cho hai entryPoint.`);
      if (oneWayIndexes.has(point.index)) errors.push(`One Way không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      oneWayIndexes.add(point.index);
    });
  });

  starts.forEach(({ x, y, cell }) => {
    if (!cell.path) errors.push(`${cell.item.label ?? cell.item.kind} tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
  });

  trays.forEach(({ x, y, cell }) => {
    const visual = getTrayVisualPosition(cell.item, { x, y });
    if (!isInsideGrid(level.grid, visual.x, visual.y)) errors.push(`Visual khay tại checkpoint Index ${mapIndex(x, y)} nằm ngoài map.`);
    if (!cell.path) errors.push(`Checkpoint khay tại Index ${mapIndex(x, y)} phải nằm trên đường đi.`);
    const visualCell = layer.cells[cellKey(visual.x, visual.y)];
    if (visualCell?.path || visualCell?.item || visualCell?.element) errors.push(`Ô visual khay Index ${mapIndex(visual.x, visual.y)} phải để trống.`);
  });
  const visualKeys = trays.map(({ x, y, cell }) => {
    const visual = getTrayVisualPosition(cell.item, { x, y });
    return cellKey(visual.x, visual.y);
  });
  if (new Set(visualKeys).size !== visualKeys.length) errors.push("Có nhiều khay đang dùng chung một vị trí visual.");

  fruits.forEach(({ x, y, cell, layerIndex }) => {
    const index = mapIndex(x, y);
    const sharedCell = level.sharedCells?.[cellKey(x, y)];
    const sharedPath = sharedCell?.path ?? cell.path;
    if (!sharedPath) errors.push(`${cell.item.label ?? cell.item.kind} tại Index ${index} trong fruit layer ${layerIndex + 1} phải nằm trên đường đi.`);
    if (sharedCell?.item) errors.push(`Fruit layer ${layerIndex + 1} tại Index ${index} trùng ${sharedCell.item.kind} dùng chung.`);
    if (barrierEndpointIndexes.has(index)) errors.push(`Fruit layer ${layerIndex + 1} không được đặt tại endpoint Count Barrier Index ${index}.`);
    if (cell.item.unknown || !FRUIT_TYPES.includes(cell.item.fruitType)) errors.push(`Unknown item #${cell.item.itemId ?? cell.item.id} trong fruit layer ${layerIndex + 1} chưa được Playable hỗ trợ.`);
  });

  const fruitTotals = Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
  fruits.forEach(({ cell }) => { fruitTotals[cell.item.fruitType] = (fruitTotals[cell.item.fruitType] ?? 0) + 1; });
  const recipeTotals = Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
  trays.forEach(({ x, y, cell }) => {
    const layers = normalizeTrayLayers(cell.item);
    if (layers.length === 0) errors.push(`Khay tại Index ${mapIndex(x, y)} chưa có layer recipe.`);
    layers.forEach((trayLayer, index) => {
      const total = Object.values(trayLayer.recipe).reduce((sum, amount) => sum + amount, 0);
      const expected = cell.item.kind === "tray" ? 9 : Number(cell.item.capacity) || 0;
      if (total !== expected) errors.push(`Khay Index ${mapIndex(x, y)} · layer ${index + 1} cần đủ ${expected} item (hiện ${total}).`);
      FRUIT_TYPES.forEach((type) => { recipeTotals[type] += trayLayer.recipe[type] ?? 0; });
    });
    if ((cell.item.trayLayers ?? []).some((trayLayer) => (trayLayer.unknownItems ?? []).some((item) => Number(item.count) > 0))) {
      errors.push(`Khay Index ${mapIndex(x, y)} còn item recipe chưa được hỗ trợ.`);
    }
  });
  FRUIT_TYPES.forEach((type) => {
    if (fruitTotals[type] !== recipeTotals[type]) {
      errors.push(`${FRUIT_ICONS[type]} ${type}: map có ${fruitTotals[type]}, recipe cần ${recipeTotals[type]}.`);
    }
  });
  return { valid: errors.length === 0, errors, layer, fruitLayers };
}

function createTrayRuntime(entry) {
  const checkpoint = { x: entry.x, y: entry.y };
  const visual = getTrayVisualPosition(entry.cell.item, checkpoint);
  return {
    id: entry.cell.item.id ?? `tray-${entry.cell.item.trayId ?? entry.key}`,
    trayId: entry.cell.item.trayId,
    item: structuredClone(entry.cell.item),
    key: entry.key,
    visualKey: cellKey(visual.x, visual.y),
    checkpointKey: cellKey(checkpoint.x, checkpoint.y),
    checkpoint,
    x: visual.x,
    y: visual.y,
    layers: normalizeTrayLayers(entry.cell.item).map((layer) => ({ ...layer, delivered: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])) })),
    activeIndex: 0
  };
}

export function createPlayableSession(level, { mode = "continuous", speed = 9 } = {}) {
  const report = validatePlayableLevel(level);
  if (!report.valid) throw new Error(report.errors.join(" "));
  const layer = structuredClone(report.layer);
  const entries = entriesWithPosition(layer);
  const start = entries.find(({ cell }) => cell.item?.kind === "snake");
  layer.cells[start.key].item = null;
  const session = {
    grid: structuredClone(level.grid),
    layer,
    grassCells: structuredClone(level.grassCells),
    priorityPoints: structuredClone(level.priorityPoints),
    mysteryFruitElement: structuredClone(level.mysteryFruitElement ?? []),
    mysteryFruitDebug: Boolean(level.mysteryFruitDebug),
    countBarriers: normalizeCountBarrierElement(level.countBarrierElement).map((barrier) => ({ ...barrier, remainingCount: barrier.count })),
    tunnels: normalizeTunnelElement(level.tunnelElement),
    oneWays: normalizeOneWayElement(level.oneWayElement).map((oneWay) => ({
      ...oneWay,
      entryPoints: oneWay.entryPoints.map((point) => ({ ...point, direction: normalizeOneWayDirection(point.direction) })),
      passedEntries: []
    })),
    fruitLayers: structuredClone(report.fruitLayers),
    activeFruitLayerIndex: 0,
    snake: { body: [{ x: start.x, y: start.y }], direction: null },
    turnpointKeys: Object.keys(level.priorityPoints ?? {}),
    trays: entries.filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind)).map(createTrayRuntime),
    remainingFruits: entries.filter(({ cell }) => cell.item?.kind === "fruit").length,
    mode,
    speed,
    status: PLAY_STATUS.READY,
    resumeStatus: PLAY_STATUS.READY,
    lastReason: null,
    delivery: null,
    deliveryEffect: null,
    teleporting: false,
    tailDisabled: false
  };
  advanceFruitLayerIfCleared(session);
  return session;
}

function activateFruitLayer(session, nextIndex) {
  Object.values(session.layer.cells).forEach((cell) => {
    if (cell?.item?.kind === "fruit") cell.item = null;
  });
  const nextLayer = session.fruitLayers[nextIndex];
  if (!nextLayer) return false;
  Object.entries(nextLayer.cells ?? {}).forEach(([key, fruitCell]) => {
    if (fruitCell?.item?.kind !== "fruit") return;
    session.layer.cells[key] ??= { path: false, element: null, item: null };
    session.layer.cells[key].item = structuredClone(fruitCell.item);
  });
  session.activeFruitLayerIndex = nextIndex;
  session.remainingFruits = Object.values(nextLayer.cells ?? {}).filter((cell) => cell?.item?.kind === "fruit").length;
  return true;
}

function advanceFruitLayerIfCleared(session) {
  while (session.remainingFruits === 0 && session.activeFruitLayerIndex + 1 < session.fruitLayers.length) {
    if (!activateFruitLayer(session, session.activeFruitLayerIndex + 1)) break;
    const head = session.snake.body[0];
    const headCell = session.layer.cells[cellKey(head.x, head.y)];
    if (headCell?.item?.kind === "fruit") {
      const tail = session.snake.body[session.snake.body.length - 1];
      session.snake.body.push({ ...tail, fruitType: headCell.item.fruitType });
      headCell.item = null;
      session.remainingFruits -= 1;
    }
  }
}

function allFruitLayersComplete(session) {
  return session.remainingFruits === 0 && session.activeFruitLayerIndex >= session.fruitLayers.length - 1;
}

function cellIsTraversable(session, position, direction = null, { ignoreSelfCollision = false } = {}) {
  if (!isInsideGrid(session.grid, position.x, position.y)) return false;
  const index = positionToIndex(position.x, position.y, session.grid.columns);
  if (session.countBarriers?.some((barrier) => barrier.remainingCount > 0 && barrier.index.includes(index))) return false;
  const cell = session.layer.cells[cellKey(position.x, position.y)];
  if (!cell?.path) return false;
  if (session.trays.some((tray) => tray.visualKey === cellKey(position.x, position.y))) return false;
  if (cell.item?.kind === "obstacle" || cell.element?.kind === "obstacle") return false;
  if (ignoreSelfCollision || tailLogicDisabled(session)) return true;
  const hitsSelf = session.snake.body.some((part) => !part.hiddenInTunnel && part.x === position.x && part.y === position.y);
  if (!hitsSelf) return true;
  return bridgeAllowsDifferentAxisOverlap(session.layer, session.snake, position, direction);
}

function oneWayAllowsMovement(session, index, direction) {
  const oneWayEntry = oneWayEntryAtIndex(session.oneWays, index);
  if (!oneWayEntry) return true;
  return oneWayDirectionKey(oneWayEntry.entryPoint.direction) === direction;
}

export function availableDirections(session) {
  const head = session.snake.body[0];
  const headCell = session.layer.cells[cellKey(head.x, head.y)];
  const reverse = OPPOSITE[session.snake.direction];
  return Object.entries(DIRECTIONS).filter(([direction, vector]) => {
    if (isBridgeElement(headCell?.element) && session.snake.direction && direction !== session.snake.direction) return false;
    const nextPosition = { x: head.x + vector.x, y: head.y + vector.y };
    const nextIndex = positionToIndex(nextPosition.x, nextPosition.y, session.grid.columns);
    const nextTunnelEntry = tunnelEntryAtIndex(session.tunnels, nextIndex);
    if (!nextTunnelEntry && !tailLogicDisabled(session) && session.snake.body.length > 1 && direction === reverse) return false;
    const nextCell = session.layer.cells[cellKey(nextPosition.x, nextPosition.y)];
    if (!gateAllowsMovement(headCell?.element, direction) || !gateAllowsMovement(nextCell?.element, direction)) return false;
    if (!oneWayAllowsMovement(session, nextIndex, direction)) return false;
    return cellIsTraversable(session, nextPosition, direction, { ignoreSelfCollision: Boolean(nextTunnelEntry) });
  }).map(([direction]) => direction);
}

function updateOneWayRuntime(session, headIndex) {
  const entry = oneWayEntryAtIndex(session.oneWays, headIndex);
  if (!entry) return;
  const runtime = session.oneWays.find((oneWay) => oneWay.oneWayId === entry.oneWay.oneWayId);
  if (!runtime) return;
  runtime.passedEntries = [...new Set([...(runtime.passedEntries ?? []), entry.entryIndex])];
  if (runtime.passedEntries.length >= 2) {
    runtime.entryPoints = runtime.entryPoints.map((point) => ({ ...point, direction: reverseOneWayDirection(point.direction) }));
    runtime.passedEntries = [];
  }
}

function activeTrayLayer(tray) {
  return tray.layers[tray.activeIndex] ?? null;
}

function layerIsComplete(layer) {
  return FRUIT_TYPES.every((type) => (layer.delivered[type] ?? 0) >= (layer.recipe[type] ?? 0));
}

function advanceCompletedTrayLayers(tray) {
  const before = tray.activeIndex;
  while (activeTrayLayer(tray) && layerIsComplete(activeTrayLayer(tray))) tray.activeIndex += 1;
  return tray.activeIndex - before;
}

function decrementCountBarriers(session, amount = 1) {
  const step = Math.max(0, Math.floor(Number(amount)) || 0);
  if (step === 0) return [];
  (session.countBarriers ?? []).forEach((barrier) => {
    if (barrier.remainingCount > 0) barrier.remainingCount -= step;
  });
  const unlocked = (session.countBarriers ?? []).filter((barrier) => barrier.remainingCount <= 0);
  session.countBarriers = (session.countBarriers ?? []).filter((barrier) => barrier.remainingCount > 0);
  return unlocked;
}

function removeUnlockedBarrierEndpointFruits(session, barriers) {
  barriers.forEach((barrier) => {
    [barrier.startIndex, barrier.endIndex].forEach((index) => {
      const key = cellKey(index % session.grid.columns, Math.floor(index / session.grid.columns));
      const cell = session.layer.cells[key];
      if (cell?.item?.kind !== "fruit") return;
      cell.item = null;
      session.remainingFruits = Math.max(0, session.remainingFruits - 1);
    });
  });
}

function nextDeliverableCargoIndex(session, tray) {
  advanceCompletedTrayLayers(tray);
  const layer = activeTrayLayer(tray);
  if (!layer) return -1;
  return session.snake.body.findIndex((segment, index) => {
    if (index === 0 || !segment.fruitType) return false;
    return (layer.recipe[segment.fruitType] ?? 0) > (layer.delivered[segment.fruitType] ?? 0);
  });
}

function beginCheckpointDelivery(session, tray) {
  if (!tray || nextDeliverableCargoIndex(session, tray) < 1) return false;
  session.delivery = { trayId: tray.id };
  session.deliveryEffect = null;
  session.status = PLAY_STATUS.DELIVERING;
  return true;
}

export function deliverNextCargo(session) {
  const tray = session.trays.find((candidate) => candidate.id === session.delivery?.trayId);
  const cargoIndex = tray ? nextDeliverableCargoIndex(session, tray) : -1;
  if (!tray || cargoIndex < 1) {
    session.delivery = null;
    session.deliveryEffect = null;
    setPostDeliveryStatus(session);
    return { delivered: false, status: session.status };
  }

  const positions = session.snake.body.map(({ x, y }) => ({ x, y }));
  const [segment] = session.snake.body.splice(cargoIndex, 1);
  const layer = activeTrayLayer(tray);
  layer.delivered[segment.fruitType] += 1;
  session.snake.body = session.snake.body.map((part, index) => ({ ...part, ...positions[index] }));
  session.deliveryEffect = {
    fruitType: segment.fruitType,
    checkpointKey: tray.checkpointKey,
    visualKey: tray.visualKey,
    nonce: `${Date.now()}-${session.snake.body.length}`
  };

  const completedLayerCount = advanceCompletedTrayLayers(tray);
  const unlockedBarriers = decrementCountBarriers(session, completedLayerCount);
  removeUnlockedBarrierEndpointFruits(session, unlockedBarriers);
  advanceFruitLayerIfCleared(session);
  if (tray.activeIndex >= tray.layers.length && !tray.completed) {
    tray.completed = true;
  }
  if (nextDeliverableCargoIndex(session, tray) < 1) {
    session.delivery = null;
    setPostDeliveryStatus(session);
  } else {
    session.status = PLAY_STATUS.DELIVERING;
  }
  return { delivered: true, fruitType: segment.fruitType, status: session.status };
}

function allTraysComplete(session) {
  return session.trays.length > 0 && session.trays.every((tray) => tray.activeIndex >= tray.layers.length);
}

function isDecisionStopPoint(session, key) {
  return session.turnpointKeys.includes(key) || session.trays.some((tray) => tray.checkpointKey === key);
}

function nextAutoDirection(session, available) {
  const reverse = OPPOSITE[session.snake.direction];
  const onward = available.filter((direction) => direction !== reverse);
  if (onward.includes(session.snake.direction)) return session.snake.direction;
  if (onward.length === 1) return onward[0];
  if (onward.length === 0 && available.length === 1) return available[0];
  return null;
}

function setPostDeliveryStatus(session) {
  if (allFruitLayersComplete(session) && allTraysComplete(session)) {
    session.status = PLAY_STATUS.WON;
    return;
  }
  if (availableDirections(session).length === 0) {
    session.status = PLAY_STATUS.LOST;
    session.lastReason = "Không còn hướng hợp lệ sau checkpoint giao hàng.";
    return;
  }
  session.status = PLAY_STATUS.WAITING;
}

function setPostMoveStatus(session) {
  if (allFruitLayersComplete(session) && allTraysComplete(session)) {
    session.status = PLAY_STATUS.WON;
    return;
  }
  const available = availableDirections(session);
  const head = session.snake.body[0];
  const key = cellKey(head.x, head.y);
  const headCell = session.layer.cells[key];
  if (isBridgeElement(headCell?.element)) {
    if (available.includes(session.snake.direction)) session.status = PLAY_STATUS.MOVING;
    else {
      session.status = PLAY_STATUS.LOST;
      session.lastReason = "Bridge yêu cầu rắn tiếp tục đi thẳng nhưng phía trước không hợp lệ.";
    }
    return;
  }
  if (isDecisionStopPoint(session, key)) {
    if (available.length === 0) {
      session.status = PLAY_STATUS.LOST;
      session.lastReason = session.turnpointKeys.includes(key)
        ? "Không còn hướng di chuyển hợp lệ tại PriorityPoint."
        : "Không còn hướng hợp lệ tại checkpoint khay.";
    } else session.status = PLAY_STATUS.WAITING;
    return;
  }
  const autoDirection = nextAutoDirection(session, available);
  if (autoDirection) {
    session.snake.direction = autoDirection;
    session.status = PLAY_STATUS.MOVING;
  } else if (available.length === 0) {
    session.status = PLAY_STATUS.LOST;
    session.lastReason = "Rắn đã tới ngõ cụt và không thể quay đầu khi đang có đuôi.";
  } else {
    session.status = PLAY_STATUS.LOST;
    session.lastReason = "Ngã rẽ cần PriorityPoint để rắn dừng và chọn hướng.";
  }
}

export function movePlayableSession(session, direction) {
  if (!availableDirections(session).includes(direction)) return { moved: false, reason: "invalid-direction" };
  session.deliveryEffect = null;
  const vector = DIRECTIONS[direction];
  const previousBody = session.snake.body.map((part) => ({ ...part }));
  const head = previousBody[0];
  const nextHead = { x: head.x + vector.x, y: head.y + vector.y, direction };
  const tunnelEntry = tunnelEntryAtIndex(session.tunnels, positionToIndex(nextHead.x, nextHead.y, session.grid.columns));
  if (tunnelEntry) {
    session.teleporting = true;
    session.tailDisabled = true;
    session.status = PLAY_STATUS.TELEPORTING;
  }
  const previousCargo = previousBody.slice(1);
  const movedBody = [
    { ...nextHead, hiddenInTunnel: false },
    ...previousCargo.map((segment, index) => ({
      ...segment,
      x: previousBody[index].x,
      y: previousBody[index].y,
      direction,
      hiddenInTunnel: Boolean(previousBody[index].hiddenInTunnel)
    }))
  ];
  if (tunnelEntry) {
    const exit = {
      x: tunnelEntry.exitPoint.index % session.grid.columns,
      y: Math.floor(tunnelEntry.exitPoint.index / session.grid.columns)
    };
    session.snake.direction = actualTunnelExitDirection(session, exit, direction);
    session.snake.body = rebuildBodyFromTunnelExit(session, movedBody, exit, session.snake.direction);
    session.tailDisabled = false;
    session.teleporting = false;
  } else {
    session.snake.direction = direction;
    session.snake.body = movedBody;
  }

  const finalHead = session.snake.body[0];
  updateOneWayRuntime(session, positionToIndex(finalHead.x, finalHead.y, session.grid.columns));
  const key = cellKey(finalHead.x, finalHead.y);
  const cell = session.layer.cells[key];
  if (cell.item?.kind === "fruit") {
    const tailPosition = tunnelEntry ? nextTailPosition(session, session.snake.body, session.snake.direction) : previousBody[previousBody.length - 1];
    session.snake.body.push({ ...tailPosition, fruitType: cell.item.fruitType });
    cell.item = null;
    session.remainingFruits -= 1;
    advanceFruitLayerIfCleared(session);
  }
  const tray = session.trays.find((candidate) => candidate.checkpointKey === key);
  if (!beginCheckpointDelivery(session, tray)) setPostMoveStatus(session);
  return { moved: true, status: session.status };
}

function itemIcon(item) {
  return item.icon ?? FRUIT_ICONS[item.fruitType] ?? "◆";
}

function statusText(status) {
  return STATUS_COPY[status] ?? STATUS_COPY.ready;
}

export function createPlayableController({ getLevel, elements, onExitEditor }) {
  let session = null;
  let previewLevel = null;
  let validationErrors = [];
  let timer = null;
  let isActive = false;
  let swipeStart = null;

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function fitBoard() {
    const grid = session?.grid ?? previewLevel?.grid;
    if (!grid || !elements.playableCanvasArea.clientWidth || !elements.playableCanvasArea.clientHeight) return;
    const areaStyle = getComputedStyle(elements.playableCanvasArea);
    const wrapStyle = getComputedStyle(elements.playableBoardWrap);
    const width = elements.playableCanvasArea.clientWidth - parseFloat(areaStyle.paddingLeft) - parseFloat(areaStyle.paddingRight);
    const height = elements.playableCanvasArea.clientHeight - parseFloat(areaStyle.paddingTop) - parseFloat(areaStyle.paddingBottom);
    const frameX = parseFloat(wrapStyle.paddingLeft) + parseFloat(wrapStyle.paddingRight) + 2;
    const frameY = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom) + 2;
    const widthFromHeight = Math.max(0, height - frameY) * (grid.columns / grid.rows) + frameX;
    elements.playableBoardWrap.style.width = `${Math.max(120, Math.min(790, width, widthFromHeight))}px`;
  }

  function renderBoard() {
    const previewLayerIndex = previewLevel?.layers?.findIndex((layer) => layer.id === previewLevel.activeLayerId) ?? 0;
    const level = session
      ? { grid: session.grid, layer: session.layer, mysteryFruitElement: session.mysteryFruitElement, mysteryFruitDebug: session.mysteryFruitDebug, activeFruitLayerIndex: session.activeFruitLayerIndex, countBarriers: session.countBarriers, tunnels: session.tunnels, oneWays: session.oneWays }
      : previewLevel
        ? { grid: previewLevel.grid, layer: activeLayer(previewLevel), mysteryFruitElement: previewLevel.mysteryFruitElement, mysteryFruitDebug: previewLevel.mysteryFruitDebug, activeFruitLayerIndex: Math.max(0, previewLayerIndex), countBarriers: normalizeCountBarrierElement(previewLevel.countBarrierElement).map((barrier) => ({ ...barrier, remainingCount: barrier.count })), tunnels: normalizeTunnelElement(previewLevel.tunnelElement), oneWays: normalizeOneWayElement(previewLevel.oneWayElement) }
        : null;
    elements.playableGridBoard.innerHTML = "";
    if (!level?.layer) return;
    applyVisualScaleConfig(elements.playableGridBoard);
    elements.playableGridBoard.style.gridTemplateColumns = `repeat(${level.grid.columns}, minmax(0, 1fr))`;
    const snakeParts = new Map((session?.snake.body ?? [])
      .filter((part, index) => !part.hiddenInTunnel && !(session?.tailDisabled && index > 0))
      .map((part, index) => [cellKey(part.x, part.y), { ...part, index }]));
    const boardTrays = session?.trays ?? entriesWithPosition(level.layer)
      .filter(({ cell }) => ["tray", "truck"].includes(cell.item?.kind))
      .map(createTrayRuntime);
    const traysByVisualKey = new Map(boardTrays.map((tray) => [tray.visualKey, tray]));
    const traysByCheckpointKey = new Map(boardTrays.map((tray) => [tray.checkpointKey, tray]));
    const grassCells = session?.grassCells ?? previewLevel?.grassCells ?? {};
    const priorityPoints = session?.priorityPoints ?? previewLevel?.priorityPoints ?? {};
    for (let y = 0; y < level.grid.rows; y += 1) {
      for (let x = 0; x < level.grid.columns; x += 1) {
        const key = cellKey(x, y);
        const index = positionToIndex(x, y, level.grid.columns);
        const cellData = level.layer.cells[key] ?? { path: false, item: null };
        const countBarrier = level.countBarriers?.find((barrier) => barrier.index.includes(index));
        const tunnelEntry = tunnelEntryAtIndex(level.tunnels, index);
        const oneWayEntry = oneWayEntryAtIndex(level.oneWays, index);
        const lockedBarrier = countBarrier && countBarrier.remainingCount > 0;
        const barrierEndpoint = lockedBarrier && (countBarrier.startIndex === index || countBarrier.endIndex === index);
        const tray = traysByVisualKey.get(key);
        const checkpointTray = traysByCheckpointKey.get(key);
        const cell = document.createElement("div");
        cell.className = `grid-cell playable-cell${grassCells[key] ? " grass" : " terrain-empty"}${cellData.path ? " path" : ""}${priorityPoints[key] ? " priority-point" : ""}${lockedBarrier ? " count-barrier-cell" : ""}${barrierEndpoint ? " count-barrier-endpoint" : ""}${tunnelEntry ? " tunnel-cell" : ""}${oneWayEntry ? " one-way-cell" : ""}${tray ? " tray-visual-cell" : ""}${checkpointTray ? " tray-checkpoint-cell" : ""}`;
        if (tunnelEntry) cell.style.setProperty("--tunnel-color", tunnelColor(tunnelEntry.tunnel.tunnelId));
        if (oneWayEntry) cell.style.setProperty("--one-way-color", oneWayColor(oneWayEntry.oneWay.oneWayId));
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-label", `Ô chơi Index ${index}`);
        if (isBridgeElement(cellData.element)) {
          const bridge = document.createElement("span");
          bridge.className = `bridge-preview${normalizeBridgeAxis(cellData.element.axis) === 1 ? " vertical" : ""}`;
          bridge.textContent = "🟰";
          cell.appendChild(bridge);
        }
        if (isGateElement(cellData.element)) {
          const gate = document.createElement("span");
          gate.className = `gate-preview ${gateDirectionClass(cellData.element.direction)}`;
          gate.title = `Gate ${gateDirectionLabel(cellData.element.direction)}`;
          cell.appendChild(gate);
        }
        if (barrierEndpoint) {
          const barrier = document.createElement("span");
          barrier.className = "count-barrier-preview";
          barrier.title = `Count Barrier ${countBarrier.barrierId} · còn ${countBarrier.remainingCount}`;
          barrier.textContent = String(countBarrier.remainingCount);
          cell.appendChild(barrier);
        }
        if (tunnelEntry) {
          const tunnel = document.createElement("span");
          tunnel.className = `tunnel-preview ${tunnelDirectionClass(tunnelEntry.entryPoint.direction)}`;
          tunnel.style.setProperty("--tunnel-color", tunnelColor(tunnelEntry.tunnel.tunnelId));
          const symbol = document.createElement("span");
          symbol.className = "tunnel-symbol";
          symbol.textContent = tunnelDirectionIcon(tunnelEntry.entryPoint.direction);
          tunnel.appendChild(symbol);
          cell.appendChild(tunnel);
        }
        if (oneWayEntry) {
          const direction = oneWayEntry.entryPoint.direction;
          const oneWay = document.createElement("span");
          oneWay.className = `one-way-preview ${oneWayDirectionClass(direction)}`;
          oneWay.style.setProperty("--one-way-color", oneWayColor(oneWayEntry.oneWay.oneWayId));
          oneWay.textContent = oneWayDirectionIcon(direction);
          cell.appendChild(oneWay);
        }
        const hideLockedBarrierFruit = lockedBarrier && cellData.item?.kind === "fruit";
        if (cellData.item && !hideLockedBarrierFruit && !["tray", "truck"].includes(cellData.item.kind) && !(session && cellData.item.kind === "snake")) {
          const hiddenFruit = cellData.item.kind === "fruit"
            && isMysteryFruitAt(level, level.activeFruitLayerIndex ?? 0, index)
            && !level.mysteryFruitDebug;
          const icon = document.createElement("span");
          icon.className = `placed-icon ${cellData.item.kind}${hiddenFruit ? " mystery-fruit-preview" : ""}`;
          icon.textContent = hiddenFruit ? "?" : itemIcon(cellData.item);
          cell.appendChild(icon);
          if (tray) {
            const layer = activeTrayLayer(tray);
            const needs = FRUIT_TYPES.filter((type) => layer && (layer.recipe[type] ?? 0) > (layer.delivered[type] ?? 0));
            const needBadge = document.createElement("span");
            const badgeSide = tray.x >= level.grid.columns / 2 ? " align-left" : " align-right";
            needBadge.className = `playable-tray-needs${badgeSide}${session?.delivery?.trayId === tray.id ? " receiving" : ""}`;
            needBadge.textContent = layer
              ? needs.map((type) => `${FRUIT_ICONS[type]}${(layer.recipe[type] ?? 0) - (layer.delivered[type] ?? 0)}`).join(" ")
              : "✓";
            needBadge.title = layer ? `Khay cần: ${needBadge.textContent}` : "Khay đã hoàn thành";
            cell.appendChild(needBadge);
          }
        }
        if (tray && !cellData.item) {
          const icon = document.createElement("span");
          icon.className = "placed-icon tray";
          icon.textContent = tray.item.icon ?? "🧺";
          cell.appendChild(icon);
          const layer = activeTrayLayer(tray);
          const needs = FRUIT_TYPES.filter((type) => layer && (layer.recipe[type] ?? 0) > (layer.delivered[type] ?? 0));
          const needBadge = document.createElement("span");
          needBadge.className = `playable-tray-needs${tray.x >= level.grid.columns / 2 ? " align-left" : " align-right"}${session?.delivery?.trayId === tray.id ? " receiving" : ""}`;
          needBadge.textContent = layer ? needs.map((type) => `${FRUIT_ICONS[type]}${(layer.recipe[type] ?? 0) - (layer.delivered[type] ?? 0)}`).join(" ") : "✓";
          cell.appendChild(needBadge);
        }
        if (checkpointTray) {
          const checkpoint = document.createElement("span");
          checkpoint.className = `delivery-checkpoint${session?.delivery?.trayId === checkpointTray.id ? " active" : ""}`;
          checkpoint.title = `Checkpoint giao hàng cho khay tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, level.grid.columns)}`;
          cell.appendChild(checkpoint);
        }
        if (session?.deliveryEffect?.checkpointKey === key) {
          const flyingFruit = document.createElement("span");
          flyingFruit.className = "delivery-flying-fruit";
          flyingFruit.textContent = FRUIT_ICONS[session.deliveryEffect.fruitType] ?? "●";
          flyingFruit.dataset.effect = session.deliveryEffect.nonce;
          cell.appendChild(flyingFruit);
        }
        const snakePart = snakeParts.get(cellKey(x, y));
        if (snakePart) {
          const token = document.createElement("span");
          const tokenDirection = snakePart.direction ? ` dir-${snakePart.direction}` : "";
          token.className = `playable-token ${snakePart.index === 0 ? "head" : "cargo"}${tokenDirection}`;
          token.textContent = snakePart.index === 0 ? "🐍" : FRUIT_ICONS[snakePart.fruitType] ?? "●";
          cell.appendChild(token);
        }
        elements.playableGridBoard.appendChild(cell);
      }
    }
    elements.playableGridMeta.textContent = `${level.grid.columns} × ${level.grid.rows} · snapshot độc lập`;
    const fruitLayerMeta = session ? ` · fruit layer ${session.activeFruitLayerIndex + 1}/${session.fruitLayers.length}` : "";
    elements.playableGridMeta.textContent = `${level.grid.columns} × ${level.grid.rows}${fruitLayerMeta} · map/rắn/khay dùng chung`;
    requestAnimationFrame(fitBoard);
  }

  function renderCargo() {
    const cargo = session?.snake.body.slice(1) ?? [];
    elements.playableCargoCount.textContent = String(cargo.length);
    elements.playableCargo.innerHTML = "";
    if (cargo.length === 0) {
      elements.playableCargo.innerHTML = '<span class="cargo-empty">Chưa thu thập trái cây</span>';
      return;
    }
    cargo.forEach((segment) => {
      const chip = document.createElement("span");
      chip.className = "cargo-chip";
      chip.textContent = FRUIT_ICONS[segment.fruitType] ?? "●";
      chip.title = segment.fruitType;
      elements.playableCargo.appendChild(chip);
    });
  }

  function renderTrays() {
    elements.playableTrayProgress.innerHTML = "";
    elements.playableTrayCount.textContent = String(session?.trays.length ?? 0);
    (session?.trays ?? []).forEach((tray, index) => {
      const complete = tray.activeIndex >= tray.layers.length;
      const layer = activeTrayLayer(tray);
      const card = document.createElement("div");
      card.className = `runtime-tray${complete ? " complete" : " active"}`;
      const head = document.createElement("div");
      head.innerHTML = `<strong>Khay #${String(index + 1).padStart(2, "0")}</strong><small>${complete ? "Hoàn thành" : `Layer ${tray.activeIndex + 1}/${tray.layers.length}`}</small>`;
      card.appendChild(head);
      const recipes = document.createElement("div");
      recipes.className = "recipe-strip";
      if (layer) FRUIT_TYPES.filter((type) => (layer.recipe[type] ?? 0) > 0).forEach((type) => {
        const chip = document.createElement("span");
        const delivered = layer.delivered[type] ?? 0;
        const required = layer.recipe[type] ?? 0;
        chip.className = `recipe-chip${delivered >= required ? " done" : ""}`;
        chip.textContent = `${FRUIT_ICONS[type]} ${delivered}/${required}`;
        recipes.appendChild(chip);
      });
      card.appendChild(recipes);
      elements.playableTrayProgress.appendChild(card);
    });
  }

  function render() {
    const status = session?.status ?? PLAY_STATUS.BLOCKED;
    const [label, copy] = statusText(status);
    elements.playableStatusBadge.textContent = label;
    elements.playableStatusBadge.className = `play-status-badge ${status}`;
    elements.playableStatusCopy.textContent = copy;
    elements.playableBlocker.classList.toggle("hidden", validationErrors.length === 0);
    elements.playableBlocker.innerHTML = "";
    if (validationErrors.length) {
      const heading = document.createElement("strong");
      heading.textContent = "Level chưa hợp lệ";
      const list = document.createElement("ul");
      validationErrors.forEach((error) => {
        const item = document.createElement("li");
        item.textContent = error;
        list.appendChild(item);
      });
      elements.playableBlocker.append(heading, list);
    }
    const directions = session && [PLAY_STATUS.READY, PLAY_STATUS.WAITING].includes(session.status) ? availableDirections(session) : [];
    elements.playableDirectionHint.innerHTML = directions.length
      ? `<strong>Hướng hợp lệ:</strong> ${directions.map((direction) => DIRECTION_LABELS[direction]).join(" · ")}`
      : status === PLAY_STATUS.MOVING ? "Rắn đang di chuyển; input mới sẽ bị bỏ qua." : "Không nhận input hướng ở trạng thái hiện tại.";
    elements.playModeSelect.value = session?.mode ?? elements.playModeSelect.value;
    elements.playSpeedSelect.value = String(session?.speed ?? elements.playSpeedSelect.value);
    elements.playPauseBtn.textContent = status === PLAY_STATUS.PAUSED ? "Resume" : "Pause";
    elements.playPauseBtn.disabled = !session || [PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(status);
    elements.playModeSelect.disabled = !session;
    elements.playSpeedSelect.disabled = !session;
    elements.playableEndOverlay.classList.toggle("hidden", ![PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(status));
    if (status === PLAY_STATUS.WON) {
      elements.playableEndIcon.textContent = "🏆";
      elements.playableEndTitle.textContent = "Hoàn thành màn chơi";
      elements.playableEndCopy.textContent = "Tất cả khay chứa đã nhận đủ recipe.";
    } else if (status === PLAY_STATUS.LOST) {
      elements.playableEndIcon.textContent = "💥";
      elements.playableEndTitle.textContent = "Bạn đã thua";
      elements.playableEndCopy.textContent = session.lastReason ?? "Rắn không thể tiếp tục di chuyển.";
    }
    renderBoard();
    renderCargo();
    renderTrays();
  }

  function scheduleNext() {
    clearTimer();
    if (!isActive || !session) return;
    if (session.status === PLAY_STATUS.DELIVERING) {
      timer = setTimeout(() => {
        deliverNextCargo(session);
        render();
        scheduleNext();
      }, 280);
      return;
    }
    if (session.status !== PLAY_STATUS.MOVING) return;
    timer = setTimeout(() => {
      movePlayableSession(session, session.snake.direction);
      render();
      scheduleNext();
    }, 1000 / session.speed);
  }

  function chooseDirection(direction) {
    if (!isActive || !session || ![PLAY_STATUS.READY, PLAY_STATUS.WAITING].includes(session.status)) return false;
    if (!availableDirections(session).includes(direction)) return false;
    session.status = PLAY_STATUS.MOVING;
    movePlayableSession(session, direction);
    render();
    scheduleNext();
    return true;
  }

  function restart() {
    clearTimer();
    previewLevel = structuredClone(getLevel());
    const report = validatePlayableLevel(previewLevel);
    validationErrors = report.errors;
    if (!report.valid) session = null;
    else session = createPlayableSession(previewLevel, { mode: elements.playModeSelect.value, speed: Number(elements.playSpeedSelect.value) });
    render();
  }

  function togglePause() {
    if (!session || [PLAY_STATUS.WON, PLAY_STATUS.LOST].includes(session.status)) return;
    if (session.status === PLAY_STATUS.PAUSED) {
      session.status = session.resumeStatus ?? PLAY_STATUS.WAITING;
      render();
      scheduleNext();
      return;
    }
    session.resumeStatus = session.status;
    session.status = PLAY_STATUS.PAUSED;
    clearTimer();
    render();
  }

  function enter() {
    isActive = true;
    restart();
  }

  function leave() {
    isActive = false;
    clearTimer();
    if (session && [PLAY_STATUS.READY, PLAY_STATUS.MOVING, PLAY_STATUS.DELIVERING, PLAY_STATUS.WAITING].includes(session.status)) {
      session.resumeStatus = session.status;
      session.status = PLAY_STATUS.PAUSED;
      render();
    }
  }

  elements.playModeSelect.addEventListener("change", () => {
    if (!session) return;
    session.mode = elements.playModeSelect.value;
    elements.playModeSelect.blur();
    render();
  });
  elements.playSpeedSelect.addEventListener("change", () => {
    if (!session) return;
    session.speed = Number(elements.playSpeedSelect.value);
    elements.playSpeedSelect.blur();
    scheduleNext();
    render();
  });
  elements.playPauseBtn.addEventListener("click", togglePause);
  elements.playRestartBtn.addEventListener("click", restart);
  elements.playAgainBtn.addEventListener("click", restart);
  elements.exitPlayableBtn.addEventListener("click", onExitEditor);
  elements.playableGridBoard.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    swipeStart = { x: event.clientX, y: event.clientY };
  });
  elements.playableGridBoard.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    chooseDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  document.addEventListener("keydown", (event) => {
    if (!isActive || ["INPUT", "TEXTAREA"].includes(event.target?.tagName)) return;
    const direction = { w: "up", arrowup: "up", s: "down", arrowdown: "down", a: "left", arrowleft: "left", d: "right", arrowright: "right" }[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    if (event.target?.tagName === "SELECT") event.target.blur();
    chooseDirection(direction);
  });
  new ResizeObserver(fitBoard).observe(elements.playableCanvasArea);

  return { enter, leave, restart, resize: fitBoard, chooseDirection, getSession: () => session };
}
