import { cellKey } from "../utils/grid-utils.js";

export const DEFAULT_SHOVEL_COUNT = Infinity;
export const SHOVEL_COUNT_LABEL = "∞";

export const SHOVEL_STATUS = Object.freeze({
  TARGETING: "shovel-targeting",
  TELEPORTING: "shovel-teleporting",
  AWAIT_DIRECTION: "shovel-await-direction",
  RESTORE_TAIL: "shovel-restore-tail"
});

export function createShovelBoosterRuntime(count = DEFAULT_SHOVEL_COUNT) {
  return {
    count,
    targetKeys: [],
    restoreActive: false
  };
}

export function validShovelTargetKeys(session) {
  if (!session?.priorityPoints || !session?.snake?.body?.[0]) return [];
  const head = session.snake.body[0];
  const headKey = cellKey(head.x, head.y);
  const deliverKeys = new Set((session.trays ?? []).map((tray) => tray.checkpointKey));
  return Object.keys(session.priorityPoints).filter((key) => key !== headKey && !deliverKeys.has(key));
}

export function canUseShovelBooster(session) {
  return Boolean(session?.shovel && !session.shovel.restoreActive && validShovelTargetKeys(session).length > 0);
}

export function beginShovelTargeting(session) {
  if (!canUseShovelBooster(session)) return false;
  session.shovel.targetKeys = validShovelTargetKeys(session);
  session.status = SHOVEL_STATUS.TARGETING;
  return true;
}

export function cancelShovelTargeting(session, fallbackStatus) {
  if (!session?.shovel) return false;
  session.shovel.targetKeys = [];
  session.status = fallbackStatus;
  return true;
}

export function shovelTargetKeyFromIndex(session, index) {
  if (!Number.isInteger(index) || !session?.grid?.columns) return null;
  const key = cellKey(index % session.grid.columns, Math.floor(index / session.grid.columns));
  return session.shovel?.targetKeys?.includes(key) ? key : null;
}

export function teleportWithShovel(session, targetKey) {
  if (!session?.shovel?.targetKeys?.includes(targetKey)) return false;
  const [x, y] = targetKey.split(",").map(Number);
  const previousBody = session.snake.body.map((segment) => ({ ...segment }));
  session.shovel.targetKeys = [];
  session.shovel.restoreActive = previousBody.length > 1;
  session.tailDisabled = previousBody.length > 1;
  session.snake.direction = null;
  session.snake.body = [
    { ...previousBody[0], x, y, direction: null, hiddenInTunnel: false, hiddenInShovel: false },
    ...previousBody.slice(1).map((segment) => ({
      ...segment,
      hiddenInTunnel: false,
      hiddenInShovel: true
    }))
  ];
  session.status = SHOVEL_STATUS.AWAIT_DIRECTION;
  return true;
}

export function beginShovelTailRestore(session) {
  if (!session?.shovel?.restoreActive) return false;
  session.tailDisabled = false;
  session.status = SHOVEL_STATUS.RESTORE_TAIL;
  return true;
}

export function revealNextShovelTailSegment(session) {
  if (!session?.shovel?.restoreActive) return false;
  const segment = session.snake.body.find((part, index) => index > 0 && part.hiddenInShovel);
  if (segment) segment.hiddenInShovel = false;
  const stillHidden = session.snake.body.some((part, index) => index > 0 && part.hiddenInShovel);
  if (!stillHidden) {
    session.shovel.restoreActive = false;
    session.tailDisabled = false;
  }
  return Boolean(segment);
}

export function isShovelRestoring(session) {
  return Boolean(session?.shovel?.restoreActive);
}
