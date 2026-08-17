import { SCHEMA_VERSION } from "../core/constants.js";

export function createLevelDocument(editorData) {
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: { name: "Snacky Level", updatedAt: new Date().toISOString() },
    grid: structuredClone(editorData.grid),
    sharedCells: structuredClone(editorData.sharedCells ?? {}),
    activeLayerId: editorData.activeLayerId,
    layers: structuredClone(editorData.layers),
    mysteryFruitElement: structuredClone(editorData.mysteryFruitElement ?? []),
    countBarrierElement: structuredClone(editorData.countBarrierElement ?? []),
    tunnelElement: structuredClone(editorData.tunnelElement ?? []),
    oneWayElement: structuredClone(editorData.oneWayElement ?? [])
  };
}
