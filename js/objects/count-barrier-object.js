import { COUNT_BARRIER_ASSET_ID } from "../core/constants.js";

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
  if (!Array.isArray(entries)) return [];
  const usedIds = new Set();
  let nextId = 0;
  return entries.flatMap((entry) => {
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

    let barrierId = Number(entry?.barrierId);
    if (!Number.isInteger(barrierId) || barrierId < 0 || usedIds.has(barrierId)) {
      while (usedIds.has(nextId)) nextId += 1;
      barrierId = nextId;
    }
    usedIds.add(barrierId);

    const index = [...indexes].sort((a, b) => a - b);
    const startIndex = Number.isInteger(rawStart) && rawStart >= 0 ? rawStart : index[0];
    const endIndex = Number.isInteger(rawEnd) && rawEnd >= 0 ? rawEnd : index[index.length - 1];
    return [{
      barrierId,
      count: normalizeCountBarrierCount(entry?.count),
      startIndex,
      endIndex,
      index
    }];
  }).sort((a, b) => a.barrierId - b.barrierId);
}

export function nextCountBarrierId(entries = []) {
  const used = new Set(normalizeCountBarrierElement(entries).map((entry) => entry.barrierId));
  let barrierId = 0;
  while (used.has(barrierId)) barrierId += 1;
  return barrierId;
}

export function nextCountBarrierSequence(entries = []) {
  const ids = normalizeCountBarrierElement(entries).map((entry) => entry.barrierId);
  return ids.length > 0 ? Math.max(...ids) + 1 : 0;
}

export function createNewActiveCountBarrier(state) {
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  if (!Number.isInteger(state.nextBarrierId) || state.nextBarrierId < 0) {
    state.nextBarrierId = nextCountBarrierSequence(state.countBarrierElement);
  }
  const barrierId = state.nextBarrierId;
  state.activeBarrierId = barrierId;
  state.nextBarrierId += 1;
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
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement)
    .filter((entry) => entry.barrierId !== barrier.barrierId);
  if (state.activeBarrierId === barrier.barrierId) state.activeBarrierId = null;
  if (state.drawingCountBarrierId === barrier.barrierId) state.drawingCountBarrierId = null;
  return true;
}

export function removeCountBarrierById(state, barrierId) {
  const before = normalizeCountBarrierElement(state.countBarrierElement);
  state.countBarrierElement = before.filter((entry) => Number(entry.barrierId) !== Number(barrierId));
  if (state.activeBarrierId === Number(barrierId)) state.activeBarrierId = null;
  if (state.drawingCountBarrierId === Number(barrierId)) state.drawingCountBarrierId = null;
  return before.length !== state.countBarrierElement.length;
}

export function removeCountBarrierCell(state, barrierId, index) {
  state.countBarrierElement = normalizeCountBarrierElement(state.countBarrierElement);
  const barrier = state.countBarrierElement.find((entry) => Number(entry.barrierId) === Number(barrierId));
  if (!barrier || !barrier.index.includes(index)) return false;
  barrier.index = barrier.index.filter((entryIndex) => entryIndex !== index);
  if (barrier.index.length < 2) {
    state.countBarrierElement = state.countBarrierElement.filter((entry) => entry.barrierId !== barrier.barrierId);
    if (state.activeBarrierId === barrier.barrierId) state.activeBarrierId = null;
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
