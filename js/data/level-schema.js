import { SCHEMA_VERSION } from "../core/constants.js";

export function createLevelDocument(editorData) {
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: { name: "Snacky Level", updatedAt: new Date().toISOString() },
    grid: structuredClone(editorData.grid),
    sharedCells: structuredClone(editorData.sharedCells ?? {}),
    activeLayerId: editorData.activeLayerId,
    layers: structuredClone(editorData.layers)
  };
}
