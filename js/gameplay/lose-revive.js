import { fillFruitIntoAnyTray } from "./tray-fill-system.js";

export const LOSE_REASON = Object.freeze({
  SELF_COLLISION: "self-collision",
  OTHER: "other"
});

export function canReviveLoseReason(reason) {
  return reason === LOSE_REASON.SELF_COLLISION;
}

export function markLose(session, { message, reason = LOSE_REASON.OTHER, status }) {
  session.status = status;
  session.lastReason = message;
  session.loseReason = reason;
  session.reviveAvailable = canReviveLoseReason(reason);
  session.delivery = null;
  session.deliveryEffect = null;
  session.teleporting = false;
  session.tailDisabled = false;
}

export function reviveSession(session, { onTrayLayerComplete = () => {}, onAfterFill = () => {} } = {}) {
  if (!session || !canReviveLoseReason(session.loseReason)) {
    return { revived: false, reason: "revive-unavailable", transferred: 0, target: 0 };
  }
  const cargo = session.snake.body.slice(1);
  const target = Math.floor(cargo.length * 0.8);
  if (target <= 0) {
    session.reviveAvailable = false;
    session.loseReason = null;
    return { revived: true, reason: "no-transfer-target", transferred: 0, target };
  }

  const originalBody = session.snake.body.map((part) => ({ ...part }));
  const removedIndexes = new Set();
  let transferred = 0;
  session.reviving = true;
  session.tailDisabled = true;
  session.delivery = null;
  session.deliveryEffect = null;

  for (let index = 1; index < originalBody.length && transferred < target; index += 1) {
    const segment = originalBody[index];
    if (!segment.fruitType) continue;
    const result = fillFruitIntoAnyTray(session, segment.fruitType);
    if (!result.filled) continue;
    removedIndexes.add(index);
    transferred += 1;
    onTrayLayerComplete(result.completedLayerCount);
    onAfterFill();
  }

  if (transferred > 0) {
    const positions = originalBody.map(({ x, y }) => ({ x, y }));
    session.snake.body = originalBody
      .filter((_, index) => index === 0 || !removedIndexes.has(index))
      .map((part, index) => ({
        ...part,
        ...positions[index],
        direction: session.snake.direction,
        hiddenInTunnel: false,
        hiddenInShovel: false
      }));
  }

  session.reviving = false;
  session.tailDisabled = false;
  session.reviveAvailable = false;
  session.loseReason = null;
  return { revived: true, transferred, target };
}
