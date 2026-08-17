import { GATE_DIRECTIONS, TUNNEL_ASSET_ID } from "../core/constants.js";

export const TUNNEL_DIRECTION_META = Object.freeze({
  [GATE_DIRECTIONS.UP]: { key: "up", label: "Up", className: "up", icon: "↑" },
  [GATE_DIRECTIONS.DOWN]: { key: "down", label: "Down", className: "down", icon: "↓" },
  [GATE_DIRECTIONS.RIGHT]: { key: "right", label: "Right", className: "right", icon: "→" },
  [GATE_DIRECTIONS.LEFT]: { key: "left", label: "Left", className: "left", icon: "←" }
});

export const TUNNEL_COLORS = Object.freeze(["#3268f5", "#d45b8c", "#1c9b6a", "#d88b12", "#7a56d9", "#238aa6"]);

export function createTunnelTool() {
  return {
    id: TUNNEL_ASSET_ID,
    kind: "tunnel",
    category: "element",
    label: "Tunnel",
    icon: "⏭"
  };
}

export function isTunnelTool(object) {
  return object?.kind === "tunnel" || object?.id === TUNNEL_ASSET_ID;
}

export function normalizeTunnelDirection(value) {
  const direction = Number(value);
  return Object.hasOwn(TUNNEL_DIRECTION_META, direction) ? direction : GATE_DIRECTIONS.RIGHT;
}

export function isValidTunnelDirection(value) {
  return Number.isInteger(value) && Object.hasOwn(TUNNEL_DIRECTION_META, value);
}

export function tunnelDirectionLabel(direction) {
  return TUNNEL_DIRECTION_META[normalizeTunnelDirection(direction)].label;
}

export function tunnelDirectionClass(direction) {
  return TUNNEL_DIRECTION_META[normalizeTunnelDirection(direction)].className;
}

export function tunnelDirectionKey(direction) {
  return TUNNEL_DIRECTION_META[normalizeTunnelDirection(direction)].key;
}

export function tunnelDirectionAxis(direction) {
  return [GATE_DIRECTIONS.LEFT, GATE_DIRECTIONS.RIGHT].includes(normalizeTunnelDirection(direction)) ? "horizontal" : "vertical";
}

export function tunnelDirectionIcon(direction) {
  return "⏭";
}

export function tunnelColor(tunnelId) {
  return TUNNEL_COLORS[Math.abs(Number(tunnelId) || 0) % TUNNEL_COLORS.length];
}

export function normalizeTunnelElement(entries = []) {
  if (!Array.isArray(entries)) return [];
  const usedIds = new Set();
  let nextId = 0;
  return entries.flatMap((entry) => {
    const points = Array.isArray(entry?.entryPoints) ? entry.entryPoints.slice(0, 2) : [];
    if (points.length !== 2) return [];
    const entryPoints = points.map((point) => ({
      index: Math.floor(Number(point?.index)),
      direction: normalizeTunnelDirection(point?.direction)
    }));
    if (entryPoints.some((point) => !Number.isInteger(point.index) || point.index < 0)) return [];

    let tunnelId = Number(entry?.tunnelId);
    if (!Number.isInteger(tunnelId) || tunnelId < 0 || usedIds.has(tunnelId)) {
      while (usedIds.has(nextId)) nextId += 1;
      tunnelId = nextId;
    }
    usedIds.add(tunnelId);
    return [{ tunnelId, entryPoints }];
  }).sort((a, b) => a.tunnelId - b.tunnelId);
}

export function nextTunnelSequence(entries = []) {
  const ids = normalizeTunnelElement(entries).map((entry) => entry.tunnelId);
  return ids.length > 0 ? Math.max(...ids) + 1 : 0;
}

export function findTunnelById(state, tunnelId) {
  return normalizeTunnelElement(state?.tunnelElement)
    .find((entry) => Number(entry.tunnelId) === Number(tunnelId)) ?? null;
}

export function findTunnelAtIndex(state, index) {
  return normalizeTunnelElement(state?.tunnelElement)
    .find((entry) => entry.entryPoints.some((point) => point.index === Number(index))) ?? null;
}

export function findTunnelEntryAtIndex(state, index) {
  const tunnel = findTunnelAtIndex(state, index);
  if (!tunnel) return null;
  const entryIndex = tunnel.entryPoints.findIndex((point) => point.index === Number(index));
  return { tunnel, entryIndex, entryPoint: tunnel.entryPoints[entryIndex] };
}

export function otherTunnelEntry(tunnel, entryIndex) {
  if (!tunnel || ![0, 1].includes(entryIndex)) return null;
  return tunnel.entryPoints[entryIndex === 0 ? 1 : 0] ?? null;
}

function usedTunnelIndexes(state, excludeTunnelId = null) {
  const used = new Set();
  normalizeTunnelElement(state?.tunnelElement).forEach((tunnel) => {
    if (Number(tunnel.tunnelId) === Number(excludeTunnelId)) return;
    tunnel.entryPoints.forEach((point) => used.add(point.index));
  });
  return used;
}

export function normalizeTunnelDraft(draft) {
  if (!draft || typeof draft !== "object") return null;
  const tunnelId = Number(draft.tunnelId);
  if (!Number.isInteger(tunnelId) || tunnelId < 0) return null;
  const allowedSteps = new Set(["direction-a", "point-b", "direction-b"]);
  const step = allowedSteps.has(draft.step) ? draft.step : "direction-a";
  const rawPoints = Array.isArray(draft.entryPoints) ? draft.entryPoints.slice(0, 2) : [];
  const entryPoints = rawPoints.flatMap((point) => {
    const index = Math.floor(Number(point?.index));
    if (!Number.isInteger(index) || index < 0) return [];
    return [{
      index,
      direction: point?.direction === null || point?.direction === undefined ? null : normalizeTunnelDirection(point.direction)
    }];
  });
  if (entryPoints.length === 0) return null;
  if (step === "direction-a") return { tunnelId, step, entryPoints: entryPoints.slice(0, 1) };
  if (step === "point-b") {
    if (!Number.isInteger(entryPoints[0].direction)) return { tunnelId, step: "direction-a", entryPoints: entryPoints.slice(0, 1) };
    return { tunnelId, step, entryPoints: entryPoints.slice(0, 1) };
  }
  if (entryPoints.length < 2) return { tunnelId, step: "point-b", entryPoints: entryPoints.slice(0, 1) };
  return { tunnelId, step, entryPoints };
}

export function findTunnelDraftEntryAtIndex(state, index) {
  const draft = normalizeTunnelDraft(state?.tunnelDraft);
  if (!draft) return null;
  const entryIndex = draft.entryPoints.findIndex((point) => point.index === Number(index));
  if (entryIndex < 0) return null;
  return { draft, entryIndex, entryPoint: draft.entryPoints[entryIndex] };
}

function draftUsesIndex(state, index) {
  return normalizeTunnelDraft(state?.tunnelDraft)?.entryPoints.some((point) => point.index === Number(index)) ?? false;
}

export function startTunnelDraftAt(state, index) {
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  if (usedTunnelIndexes(state).has(Number(index))) return { changed: false, reason: "tunnel-overlap" };
  if (!Number.isInteger(state.nextTunnelId) || state.nextTunnelId < 0) {
    state.nextTunnelId = nextTunnelSequence(state.tunnelElement);
  }
  state.tunnelDraft = {
    tunnelId: state.nextTunnelId,
    step: "direction-a",
    entryPoints: [{ index: Number(index), direction: null }]
  };
  state.activeTunnelId = null;
  return { changed: true, action: "tunnel-point-a-selected", tunnelId: state.nextTunnelId };
}

export function placeTunnelDraftPointB(state, index) {
  const draft = normalizeTunnelDraft(state.tunnelDraft);
  if (!draft || draft.step !== "point-b") return { changed: false, reason: "tunnel-needs-direction-a" };
  if (draft.entryPoints[0].index === Number(index)) return { changed: false, reason: "tunnel-same-point" };
  if (usedTunnelIndexes(state).has(Number(index)) || draftUsesIndex(state, index)) return { changed: false, reason: "tunnel-overlap" };
  state.tunnelDraft = {
    ...draft,
    step: "direction-b",
    entryPoints: [...draft.entryPoints, { index: Number(index), direction: null }]
  };
  return { changed: true, action: "tunnel-point-b-selected", tunnelId: draft.tunnelId };
}

export function setTunnelDraftDirection(state, direction) {
  const draft = normalizeTunnelDraft(state.tunnelDraft);
  if (!draft) return { changed: false, reason: "tunnel-draft-missing" };
  if (draft.step === "direction-a") {
    state.tunnelDraft = {
      ...draft,
      step: "point-b",
      entryPoints: [{ ...draft.entryPoints[0], direction: normalizeTunnelDirection(direction) }]
    };
    return { changed: true, action: "tunnel-direction-a-selected", tunnelId: draft.tunnelId };
  }
  if (draft.step !== "direction-b" || draft.entryPoints.length !== 2) return { changed: false, reason: "tunnel-needs-point-b" };
  const tunnel = {
    tunnelId: draft.tunnelId,
    entryPoints: [
      { ...draft.entryPoints[0], direction: normalizeTunnelDirection(draft.entryPoints[0].direction) },
      { ...draft.entryPoints[1], direction: normalizeTunnelDirection(direction) }
    ]
  };
  state.tunnelElement = [...normalizeTunnelElement(state.tunnelElement), tunnel];
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  state.activeTunnelId = tunnel.tunnelId;
  state.nextTunnelId = Math.max(Number(state.nextTunnelId) || 0, tunnel.tunnelId + 1, nextTunnelSequence(state.tunnelElement));
  state.tunnelDraft = null;
  return { changed: true, action: "tunnel-created", tunnelId: tunnel.tunnelId };
}

export function cancelTunnelDraft(state) {
  const changed = Boolean(state.tunnelDraft);
  state.tunnelDraft = null;
  return changed;
}

export function setTunnelEntryIndex(state, tunnelId, entryIndex, index) {
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  const tunnel = state.tunnelElement.find((entry) => entry.tunnelId === Number(tunnelId));
  if (!tunnel || ![0, 1].includes(Number(entryIndex))) return false;
  const duplicate = tunnel.entryPoints.some((point, pointIndex) => pointIndex !== Number(entryIndex) && point.index === Number(index));
  if (duplicate || usedTunnelIndexes(state, tunnel.tunnelId).has(Number(index))) return false;
  tunnel.entryPoints[Number(entryIndex)].index = Number(index);
  state.activeTunnelId = tunnel.tunnelId;
  return true;
}

export function setTunnelEntryDirection(state, tunnelId, entryIndex, direction) {
  state.tunnelElement = normalizeTunnelElement(state.tunnelElement);
  const tunnel = state.tunnelElement.find((entry) => entry.tunnelId === Number(tunnelId));
  if (!tunnel || ![0, 1].includes(Number(entryIndex))) return false;
  tunnel.entryPoints[Number(entryIndex)].direction = normalizeTunnelDirection(direction);
  state.activeTunnelId = tunnel.tunnelId;
  return true;
}

export function removeTunnelById(state, tunnelId) {
  const before = normalizeTunnelElement(state.tunnelElement);
  state.tunnelElement = before.filter((entry) => Number(entry.tunnelId) !== Number(tunnelId));
  if (state.activeTunnelId === Number(tunnelId)) state.activeTunnelId = null;
  return before.length !== state.tunnelElement.length;
}

export function removeTunnelAtIndex(state, index) {
  const tunnel = findTunnelAtIndex(state, index);
  return tunnel ? removeTunnelById(state, tunnel.tunnelId) : false;
}

export function remapTunnelIndexes(entries = [], fromWidth, toWidth) {
  if (!Number.isInteger(fromWidth) || fromWidth < 1 || !Number.isInteger(toWidth) || toWidth < 1) {
    return normalizeTunnelElement(entries);
  }
  return normalizeTunnelElement(entries).map((entry) => ({
    ...entry,
    entryPoints: entry.entryPoints.map((point) => {
      const x = point.index % fromWidth;
      const y = Math.floor(point.index / fromWidth);
      return { ...point, index: (y * toWidth) + x };
    })
  }));
}
