import { COUNT_BARRIER_ASSET_ID } from "../core/constants.js";
import { nextGroupedElementId, normalizeGroupedElementIds, remapGroupedElementId } from "../utils/grouped-element-ids.js";

export function createCountBarrierTool() {
  return {
    id: COUNT_BARRIER_ASSET_ID,
    kind: "count-barrier",
    category: "element",
    label: "Count Barrier",
    icon: "#"
  };
}

export function isCountBarrierTool(object) {
  return object?.kind === "count-barrier" || object?.id === COUNT_BARRIER_ASSET_ID;
}

export function normalizeCountBarrierCount(value) {
  const count = Math.floor(Number(value));
  return Number.isInteger(count) && count > 0 ? count : 1;
}

export function normalizeCountBarrierElement(entries = []) {
  return normalizeCountBarrierElementWithIdMap(entries).normalizedCollection;
}

export function normalizeCountBarrierElementWithIdMap(entries = []) {
  if (!Array.isArray(entries)) return { normalizedCollection: [], idMap: new Map() };
  const normalizedEntries = entries.flatMap((entry) => {
    const indexes = new Set();
    (Array.isArray(entry?.index) ? entry.index : []).forEach((rawIndex) => {
      const index = Number(rawIndex);
      if (Number.isInteger(index) && index >= 0) indexes.add(index);
    });

    const rawStart = Number(entry?.startIndex);
    const rawEnd = Number(entry?.endIndex);
    if (Number.isInteger(rawStart) && rawStart >= 0) indexes.add(rawStart);
    if (Number.isInteger(rawEnd) && rawEnd >= 0) indexes.add(rawEnd);
    if (indexes.size === 0) return [];

    const index = [...indexes].sort((a, b) => a - b);
    const startIndex = Number.isInteger(rawStart) && rawStart >= 0 ? rawStart : index[0];
    const endIndex = Number.isInteger(rawEnd) && rawEnd >= 0 ? rawEnd : index[index.length - 1];
    return [{
      barrierId: Number(entry?.barrierId),
      count: normalizeCountBarrierCount(entry?.count),
      startIndex,
      endIndex,
      index
    }];
  });
  return normalizeGroupedElementIds(normalizedEntries, "barrierId");
}

export function nextCountBarrierId(entries = []) {
  return nextCountBarrierSequence(entries);
}

export function nextCountBarrierSequence(entries = []) {
  return nextGroupedElementId(normalizeCountBarrierElement(entries));
}

export function createNewActiveCountBarrier(state) {
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  const barrierId = nextCountBarrierSequence(state.countBarrierElement);
  state.activeBarrierId = barrierId;
  state.nextBarrierId = barrierId;
  state.drawingCountBarrierId = null;
  return barrierId;
}

export function findCountBarrierAtIndex(state, index) {
  return normalizeCountBarrierElement(state?.countBarrierElement)
    .find((entry) => entry.index.includes(index)) ?? null;
}

export function findCountBarrierById(state, barrierId) {
  return normalizeCountBarrierElement(state?.countBarrierElement)
    .find((entry) => Number(entry.barrierId) === Number(barrierId)) ?? null;
}

export function removeCountBarrierAtIndex(state, index) {
  const barrier = findCountBarrierAtIndex(state, index);
  if (!barrier) return false;
  const next = normalizeCountBarrierElementWithIdMap(normalizeCountBarrierElement(state.countBarrierElement)
    .filter((entry) => entry.barrierId !== barrier.barrierId));
  state.countBarrierElement = next.normalizedCollection;
  state.nextBarrierId = nextCountBarrierSequence(state.countBarrierElement);
  state.activeBarrierId = remapGroupedElementId(state.activeBarrierId, next.idMap, { pendingId: state.nextBarrierId });
  state.drawingCountBarrierId = remapGroupedElementId(state.drawingCountBarrierId, next.idMap);
  return true;
}

export function removeCountBarrierById(state, barrierId) {
  const before = normalizeCountBarrierElement(state.countBarrierElement);
  const next = normalizeCountBarrierElementWithIdMap(before.filter((entry) => Number(entry.barrierId) !== Number(barrierId)));
  state.countBarrierElement = next.normalizedCollection;
  state.nextBarrierId = nextCountBarrierSequence(state.countBarrierElement);
  state.activeBarrierId = remapGroupedElementId(state.activeBarrierId, next.idMap, { pendingId: state.nextBarrierId });
  state.drawingCountBarrierId = remapGroupedElementId(state.drawingCountBarrierId, next.idMap);
  return before.length !== state.countBarrierElement.length;
}

export function removeCountBarrierCell(state, barrierId, index) {
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  const barrier = state.countBarrierElement.find((entry) => Number(entry.barrierId) === Number(barrierId));
  if (!barrier || !barrier.index.includes(index)) return false;
  barrier.index = barrier.index.filter((entryIndex) => entryIndex !== index);
  if (barrier.index.length < 2) {
    const next = normalizeCountBarrierElementWithIdMap(state.countBarrierElement.filter((entry) => entry.barrierId !== barrier.barrierId));
    state.countBarrierElement = next.normalizedCollection;
    state.nextBarrierId = nextCountBarrierSequence(state.countBarrierElement);
    state.activeBarrierId = remapGroupedElementId(state.activeBarrierId, next.idMap, { pendingId: state.nextBarrierId });
    state.drawingCountBarrierId = remapGroupedElementId(state.drawingCountBarrierId, next.idMap);
    return true;
  }
  if (barrier.startIndex === index) barrier.startIndex = barrier.index[0];
  if (barrier.endIndex === index) barrier.endIndex = barrier.index[barrier.index.length - 1];
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  return true;
}

export function remapCountBarrierIndexes(entries = [], fromWidth, toWidth) {
  if (!Number.isInteger(fromWidth) || fromWidth < 1 || !Number.isInteger(toWidth) || toWidth < 1) {
    return normalizeCountBarrierElement(entries);
  }
  return normalizeCountBarrierElement(entries).map((entry) => {
    const remap = (index) => {
      const x = index % fromWidth;
      const y = Math.floor(index / fromWidth);
      return (y * toWidth) + x;
    };
    return {
      ...entry,
      startIndex: remap(entry.startIndex),
      endIndex: remap(entry.endIndex),
      index: [...new Set(entry.index.map(remap))].sort((a, b) => a - b)
    };
  });
}
