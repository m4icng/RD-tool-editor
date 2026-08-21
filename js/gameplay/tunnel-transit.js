import { positionToIndex } from "../utils/grid-utils.js";

function trailEntryFromPosition(position, columns, direction = position?.direction ?? null) {
  return {
    x: position.x,
    y: position.y,
    index: positionToIndex(position.x, position.y, columns),
    direction
  };
}

function directionBetween(from, to) {
  if (!from || !to) return from?.direction ?? to?.direction ?? null;
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  if (to.y > from.y) return "down";
  if (to.y < from.y) return "up";
  return from.direction ?? to.direction ?? null;
}

export function createTunnelTransitState() {
  return {
    active: false,
    tunnelId: null,
    enterPortalIndex: null,
    exitPortalIndex: null,
    hiddenBodyCount: 0,
    postTunnelTrail: [],
    fullyExited: false
  };
}

export function ensureTunnelTransitState(runtime) {
  runtime.tunnelTransit ??= createTunnelTransitState();
  return runtime.tunnelTransit;
}

export function tunnelTransitActive(runtime) {
  return Boolean(runtime?.tunnelTransit?.active);
}

export function beginTunnelTransit(runtime, tunnelEntry, exitPosition, exitDirection = null) {
  const columns = runtime.grid.columns;
  const transit = ensureTunnelTransitState(runtime);
  const bodyCount = Math.max(0, (runtime.snake?.body?.length ?? 1) - 1);
  const exitPortalIndex = positionToIndex(exitPosition.x, exitPosition.y, columns);

  runtime.snake.direction = exitDirection;
  runtime.snake.body = runtime.snake.body.map((segment, index) => ({
    ...segment,
    ...(index === 0 ? { x: exitPosition.x, y: exitPosition.y, direction: exitDirection } : {}),
    hiddenInTunnel: index > 0,
    hiddenInShovel: Boolean(segment.hiddenInShovel)
  }));

  Object.assign(transit, {
    active: bodyCount > 0,
    tunnelId: tunnelEntry?.tunnel?.tunnelId ?? null,
    enterPortalIndex: tunnelEntry?.entryPoint?.index ?? null,
    exitPortalIndex,
    hiddenBodyCount: bodyCount,
    postTunnelTrail: [trailEntryFromPosition({ ...exitPosition, direction: exitDirection }, columns, exitDirection)],
    fullyExited: bodyCount === 0
  });

  resolveTunnelBodyFromTrail(runtime);
  return transit;
}

export function recordTunnelHeadStep(runtime, headPosition, direction = runtime?.snake?.direction ?? null) {
  if (!tunnelTransitActive(runtime)) return false;
  const transit = ensureTunnelTransitState(runtime);
  const columns = runtime.grid.columns;
  const headEntry = trailEntryFromPosition(headPosition, columns, direction);
  if (transit.postTunnelTrail[0]?.index !== headEntry.index) {
    transit.postTunnelTrail.unshift(headEntry);
  } else {
    transit.postTunnelTrail[0] = headEntry;
  }
  resolveTunnelBodyFromTrail(runtime);
  return true;
}

export function resolveTunnelBodyFromTrail(runtime) {
  const transit = ensureTunnelTransitState(runtime);
  const body = runtime.snake?.body ?? [];
  const bodyCount = Math.max(0, body.length - 1);
  const maxTrailLength = bodyCount + 1;
  if (transit.postTunnelTrail.length > maxTrailLength) {
    transit.postTunnelTrail = transit.postTunnelTrail.slice(0, maxTrailLength);
  }

  let visibleCount = 0;
  for (let bodyIndex = 1; bodyIndex < body.length; bodyIndex += 1) {
    const trailEntry = transit.postTunnelTrail[bodyIndex];
    const frontEntry = transit.postTunnelTrail[bodyIndex - 1] ?? null;
    if (trailEntry) {
      visibleCount += 1;
      body[bodyIndex] = {
        ...body[bodyIndex],
        x: trailEntry.x,
        y: trailEntry.y,
        direction: directionBetween(trailEntry, frontEntry),
        hiddenInTunnel: false
      };
    } else {
      body[bodyIndex] = {
        ...body[bodyIndex],
        hiddenInTunnel: true
      };
    }
  }

  transit.hiddenBodyCount = Math.max(0, bodyCount - visibleCount);
  if (transit.active && transit.postTunnelTrail.length >= bodyCount + 1) {
    transit.active = false;
    transit.fullyExited = true;
  }
  if (bodyCount === 0) {
    transit.active = false;
    transit.fullyExited = true;
  }
  return { visibleCount, hiddenCount: transit.hiddenBodyCount };
}

export function appendTunnelCargo(runtime, cargo) {
  runtime.snake.body.push({
    ...cargo,
    hiddenInTunnel: tunnelTransitActive(runtime),
    hiddenInShovel: Boolean(cargo.hiddenInShovel)
  });
  if (tunnelTransitActive(runtime)) resolveTunnelBodyFromTrail(runtime);
}

export function trimTunnelTrailAfterBodyChange(runtime) {
  if (tunnelTransitActive(runtime)) resolveTunnelBodyFromTrail(runtime);
}
