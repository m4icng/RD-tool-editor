export function normalizeGroupedElementIds(collection = [], idField) {
  if (!Array.isArray(collection)) return { normalizedCollection: [], idMap: new Map() };
  const idMap = new Map();
  const normalizedCollection = collection.map((entry, index) => {
    const oldId = Number(entry?.[idField]);
    if (Number.isInteger(oldId) && oldId >= 0 && !idMap.has(oldId)) idMap.set(oldId, index);
    return { ...entry, [idField]: index };
  });
  return { normalizedCollection, idMap };
}

export function nextGroupedElementId(collection = []) {
  return Array.isArray(collection) ? collection.length : 0;
}

export function remapGroupedElementId(id, idMap, { pendingId = null } = {}) {
  const currentId = Number(id);
  if (!Number.isInteger(currentId) || currentId < 0) return null;
  if (idMap?.has(currentId)) return idMap.get(currentId);
  return currentId === pendingId ? currentId : null;
}

export function findGroupedElementIdSequenceIssue(collection = [], idField, label) {
  if (!Array.isArray(collection)) return null;
  const ids = collection.map((entry) => Number(entry?.[idField]));
  const valid = ids.every((id, index) => Number.isInteger(id) && id === index);
  if (valid) return null;
  return {
    label,
    ids,
    expected: ids.map((_, index) => index)
  };
}
