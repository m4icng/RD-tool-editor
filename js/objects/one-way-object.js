import { GATE_DIRECTIONS, ONE_WAY_ASSET_ID } from "../core/constants.js";
import { nextGroupedElementId, normalizeGroupedElementIds, remapGroupedElementId } from "../utils/grouped-element-ids.js";

export const ONE_WAY_DIRECTION_META = Object.freeze({
  [GATE_DIRECTIONS.UP]: { key: "up", label: "Up", className: "up", icon: "▲" },
  [GATE_DIRECTIONS.DOWN]: { key: "down", label: "Down", className: "down", icon: "▼" },
  [GATE_DIRECTIONS.RIGHT]: { key: "right", label: "Right", className: "right", icon: "▶" },
  [GATE_DIRECTIONS.LEFT]: { key: "left", label: "Left", className: "left", icon: "◀" }
});

export const ONE_WAY_COLORS = Object.freeze(["#d44f3a", "#1d8f78", "#7357d8", "#c48612", "#2673c7", "#b84f90"]);

export function createOneWayTool() {
  return {
    id: ONE_WAY_ASSET_ID,
    kind: "one-way",
    category: "element",
    label: "One Way",
    icon: "▲"
  };
}

export function isOneWayTool(object) {
  return object?.kind === "one-way" || object?.id === ONE_WAY_ASSET_ID;
}

export function normalizeOneWayDirection(value) {
  const direction = Number(value);
  return Object.hasOwn(ONE_WAY_DIRECTION_META, direction) ? direction : GATE_DIRECTIONS.UP;
}

export function isValidOneWayDirection(value) {
  return Number.isInteger(value) && Object.hasOwn(ONE_WAY_DIRECTION_META, value);
}

export function oneWayDirectionLabel(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].label;
}

export function oneWayDirectionClass(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].className;
}

export function oneWayDirectionKey(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].key;
}

export function oneWayDirectionIcon(direction) {
  return ONE_WAY_DIRECTION_META[normalizeOneWayDirection(direction)].icon;
}

export function reverseOneWayDirection(direction) {
  return {
    [GATE_DIRECTIONS.UP]: GATE_DIRECTIONS.DOWN,
    [GATE_DIRECTIONS.DOWN]: GATE_DIRECTIONS.UP,
    [GATE_DIRECTIONS.RIGHT]: GATE_DIRECTIONS.LEFT,
    [GATE_DIRECTIONS.LEFT]: GATE_DIRECTIONS.RIGHT
  }[normalizeOneWayDirection(direction)];
}

export function oneWayColor(oneWayId) {
  return ONE_WAY_COLORS[Math.abs(Number(oneWayId) || 0) % ONE_WAY_COLORS.length];
}

export function normalizeOneWayElement(entries = []) {
  return normalizeOneWayElementWithIdMap(entries).normalizedCollection;
}

export function normalizeOneWayElementWithIdMap(entries = []) {
  if (!Array.isArray(entries)) return { normalizedCollection: [], idMap: new Map() };
  const normalizedEntries = entries.flatMap((entry) => {
    const points = Array.isArray(entry?.entryPoints) ? entry.entryPoints.slice(0, 2) : [];
    if (points.length !== 2) return [];
    const entryPoints = points.map((point) => ({
      index: Math.floor(Number(point?.index)),
      direction: normalizeOneWayDirection(point?.direction)
    }));
    if (entryPoints.some((point) => !Number.isInteger(point.index) || point.index < 0)) return [];

    const oneWayId = Number(entry?.oneWayId);
    return [{ oneWayId, entryPoints }];
  });
  return normalizeGroupedElementIds(normalizedEntries, "oneWayId");
}

export function nextOneWaySequence(entries = []) {
  return nextGroupedElementId(normalizeOneWayElement(entries));
}

export function findOneWayById(state, oneWayId) {
  return normalizeOneWayElement(state?.oneWayElement)
    .find((entry) => Number(entry.oneWayId) === Number(oneWayId)) ?? null;
}

export function findOneWayAtIndex(state, index) {
  return normalizeOneWayElement(state?.oneWayElement)
    .find((entry) => entry.entryPoints.some((point) => point.index === Number(index))) ?? null;
}

export function findOneWayEntryAtIndex(state, index) {
  const oneWay = findOneWayAtIndex(state, index);
  if (!oneWay) return null;
  const entryIndex = oneWay.entryPoints.findIndex((point) => point.index === Number(index));
  return { oneWay, entryIndex, entryPoint: oneWay.entryPoints[entryIndex] };
}

function usedOneWayIndexes(state, excludeOneWayId = null) {
  const used = new Set();
  normalizeOneWayElement(state?.oneWayElement).forEach((oneWay) => {
    if (Number(oneWay.oneWayId) === Number(excludeOneWayId)) return;
    oneWay.entryPoints.forEach((point) => used.add(point.index));
  });
  return used;
}

export function normalizeOneWayDraft(draft) {
  if (!draft || typeof draft !== "object") return null;
  const oneWayId = Number(draft.oneWayId);
  if (!Number.isInteger(oneWayId) || oneWayId < 0) return null;
  const allowedSteps = new Set(["direction-a", "point-b", "direction-b"]);
  const step = allowedSteps.has(draft.step) ? draft.step : "direction-a";
  const rawPoints = Array.isArray(draft.entryPoints) ? draft.entryPoints.slice(0, 2) : [];
  const entryPoints = rawPoints.flatMap((point) => {
    const index = Math.floor(Number(point?.index));
    if (!Number.isInteger(index) || index < 0) return [];
    return [{
      index,
      direction: point?.direction === null || point?.direction === undefined ? null : normalizeOneWayDirection(point.direction)
    }];
  });
  if (entryPoints.length === 0) return null;
  if (step === "direction-a") return { oneWayId, step, entryPoints: entryPoints.slice(0, 1) };
  if (step === "point-b") {
    if (!Number.isInteger(entryPoints[0].direction)) return { oneWayId, step: "direction-a", entryPoints: entryPoints.slice(0, 1) };
    return { oneWayId, step, entryPoints: entryPoints.slice(0, 1) };
  }
  if (entryPoints.length < 2) return { oneWayId, step: "point-b", entryPoints: entryPoints.slice(0, 1) };
  return { oneWayId, step, entryPoints };
}

export function findOneWayDraftEntryAtIndex(state, index) {
  const draft = normalizeOneWayDraft(state?.oneWayDraft);
  if (!draft) return null;
  const entryIndex = draft.entryPoints.findIndex((point) => point.index === Number(index));
  if (entryIndex < 0) return null;
  return { draft, entryIndex, entryPoint: draft.entryPoints[entryIndex] };
}

function draftUsesIndex(state, index) {
  return normalizeOneWayDraft(state?.oneWayDraft)?.entryPoints.some((point) => point.index === Number(index)) ?? false;
}

export function startOneWayDraftAt(state, index) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  if (usedOneWayIndexes(state).has(Number(index))) return { changed: false, reason: "one-way-overlap" };
  state.nextOneWayId = nextOneWaySequence(state.oneWayElement);
  state.oneWayDraft = {
    oneWayId: state.nextOneWayId,
    step: "direction-a",
    entryPoints: [{ index: Number(index), direction: null }]
  };
  state.activeOneWayId = null;
  return { changed: true, action: "one-way-point-a-selected", oneWayId: state.nextOneWayId };
}

export function placeOneWayDraftPointB(state, index) {
  const draft = normalizeOneWayDraft(state.oneWayDraft);
  if (!draft || draft.step !== "point-b") return { changed: false, reason: "one-way-needs-direction-a" };
  if (draft.entryPoints[0].index === Number(index)) return { changed: false, reason: "one-way-same-point" };
  if (usedOneWayIndexes(state).has(Number(index)) || draftUsesIndex(state, index)) return { changed: false, reason: "one-way-overlap" };
  state.oneWayDraft = {
    ...draft,
    step: "direction-b",
    entryPoints: [...draft.entryPoints, { index: Number(index), direction: null }]
  };
  return { changed: true, action: "one-way-point-b-selected", oneWayId: draft.oneWayId };
}

export function setOneWayDraftDirection(state, direction) {
  const draft = normalizeOneWayDraft(state.oneWayDraft);
  if (!draft) return { changed: false, reason: "one-way-draft-missing" };
  if (draft.step === "direction-a") {
    state.oneWayDraft = {
      ...draft,
      step: "point-b",
      entryPoints: [{ ...draft.entryPoints[0], direction: normalizeOneWayDirection(direction) }]
    };
    return { changed: true, action: "one-way-direction-a-selected", oneWayId: draft.oneWayId };
  }
  if (draft.step !== "direction-b" || draft.entryPoints.length !== 2) return { changed: false, reason: "one-way-needs-point-b" };
  const oneWay = {
    oneWayId: draft.oneWayId,
    entryPoints: [
      { ...draft.entryPoints[0], direction: normalizeOneWayDirection(draft.entryPoints[0].direction) },
      { ...draft.entryPoints[1], direction: normalizeOneWayDirection(direction) }
    ]
  };
  state.oneWayElement = [...normalizeOneWayElement(state.oneWayElement), oneWay];
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  state.activeOneWayId = oneWay.oneWayId;
  state.nextOneWayId = nextOneWaySequence(state.oneWayElement);
  state.oneWayDraft = null;
  return { changed: true, action: "one-way-created", oneWayId: oneWay.oneWayId };
}

export function cancelOneWayDraft(state) {
  const changed = Boolean(state.oneWayDraft);
  state.oneWayDraft = null;
  return changed;
}

export function setOneWayEntryIndex(state, oneWayId, entryIndex, index) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  const oneWay = state.oneWayElement.find((entry) => entry.oneWayId === Number(oneWayId));
  if (!oneWay || ![0, 1].includes(Number(entryIndex))) return false;
  const duplicate = oneWay.entryPoints.some((point, pointIndex) => pointIndex !== Number(entryIndex) && point.index === Number(index));
  if (duplicate || usedOneWayIndexes(state, oneWay.oneWayId).has(Number(index))) return false;
  oneWay.entryPoints[Number(entryIndex)].index = Number(index);
  state.activeOneWayId = oneWay.oneWayId;
  return true;
}

export function setOneWayDirection(state, oneWayId, direction) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  const oneWay = state.oneWayElement.find((entry) => entry.oneWayId === Number(oneWayId));
  if (!oneWay) return false;
  const nextDirection = normalizeOneWayDirection(direction);
  oneWay.entryPoints = oneWay.entryPoints.map((point) => ({ ...point, direction: nextDirection }));
  state.activeOneWayId = oneWay.oneWayId;
  return true;
}

export function setOneWayEntryDirection(state, oneWayId, entryIndex, direction) {
  state.oneWayElement = normalizeOneWayElement(state.oneWayElement);
  const oneWay = state.oneWayElement.find((entry) => entry.oneWayId === Number(oneWayId));
  if (!oneWay || ![0, 1].includes(Number(entryIndex))) return false;
  oneWay.entryPoints[Number(entryIndex)].direction = normalizeOneWayDirection(direction);
  state.activeOneWayId = oneWay.oneWayId;
  return true;
}

export function removeOneWayById(state, oneWayId) {
  const before = normalizeOneWayElement(state.oneWayElement);
  const next = normalizeOneWayElementWithIdMap(before.filter((entry) => Number(entry.oneWayId) !== Number(oneWayId)));
  state.oneWayElement = next.normalizedCollection;
  state.nextOneWayId = nextOneWaySequence(state.oneWayElement);
  state.activeOneWayId = remapGroupedElementId(state.activeOneWayId, next.idMap);
  return before.length !== state.oneWayElement.length;
}

export function removeOneWayAtIndex(state, index) {
  const oneWay = findOneWayAtIndex(state, index);
  return oneWay ? removeOneWayById(state, oneWay.oneWayId) : false;
}

export function remapOneWayIndexes(entries = [], fromWidth, toWidth) {
  if (!Number.isInteger(fromWidth) || fromWidth < 1 || !Number.isInteger(toWidth) || toWidth < 1) {
    return normalizeOneWayElement(entries);
  }
  return normalizeOneWayElement(entries).map((entry) => ({
    ...entry,
    entryPoints: entry.entryPoints.map((point) => {
      const x = point.index % fromWidth;
      const y = Math.floor(point.index / fromWidth);
      return { ...point, index: (y * toWidth) + x };
    })
  }));
}
