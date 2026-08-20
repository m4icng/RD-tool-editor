import { BLOCK_ITEM_GLYPH, blockVisualMeta } from "../core/block-visuals.js";
import { createLayer, reindexLayers } from "../core/editor-state.js";
import { createFruit } from "../objects/fruit-object.js";
import { cellKey, indexToPosition } from "../utils/grid-utils.js";
import { GENERATOR_VERSION, normalizeGenerateSettings, validateGenerateSettings } from "./generate-settings.js";
import { analyzeGenerateSource, branchCellsForIndexes, createGeneratorIssue, fruitTypeFromItemId } from "./generate-source.js";

function createRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

function shuffle(values, random) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ensureLayers(state, maxLayerIndex) {
  while ((state.layers ?? []).length <= maxLayerIndex) {
    state.layers.push(createLayer(state.layers.length));
  }
  reindexLayers(state.layers);
}

function clearGeneratedLayerItems(state) {
  (state.layers ?? []).forEach((layer) => {
    layer.cells = {};
  });
  state.mysteryFruitElement = [];
}

function createItemFromRequirement(requirement) {
  const fruitType = requirement.fruitType ?? fruitTypeFromItemId(requirement.itemId);
  if (fruitType) return createFruit(fruitType, blockVisualMeta(fruitType).label, BLOCK_ITEM_GLYPH);
  return {
    id: requirement.itemId,
    itemId: requirement.itemId,
    kind: "fruit",
    category: "item",
    fruitType: `unknown-${requirement.itemId}`,
    label: `Unknown #${requirement.itemId}`,
    icon: "?"
  };
}

function takeCellsFromBranches(branches, amount, settings, random) {
  const branchQueues = branches
    .map((branch) => ({ ...branch, indexes: shuffle(branch.indexes, random) }))
    .filter((branch) => branch.indexes.length > 0);
  const picked = [];
  let cursor = 0;
  let guard = 0;
  while (picked.length < amount && branchQueues.length > 0 && guard < amount * Math.max(1, branchQueues.length) * 3) {
    const branch = branchQueues[cursor % branchQueues.length];
    const chunkSize = Math.max(1, Math.min(settings.maxClusterSizePerBranch, amount - picked.length));
    const actualChunk = Math.max(1, Math.round(chunkSize * Math.max(0.15, settings.clusterRatio)));
    for (let i = 0; i < actualChunk && picked.length < amount && branch.indexes.length > 0; i += 1) {
      picked.push({ index: branch.indexes.shift(), branchId: branch.branchId });
    }
    cursor += settings.multiBranchMode === "clustered" ? (random() > settings.branchDistributionBalance ? 1 : 0) : 1;
    guard += 1;
    for (let i = branchQueues.length - 1; i >= 0; i -= 1) {
      if (branchQueues[i].indexes.length === 0) branchQueues.splice(i, 1);
    }
  }
  return picked;
}

function generatedMetrics(generatedItems, settings, source) {
  const byBranch = new Set(generatedItems.map((item) => item.branchId).filter(Boolean));
  const byLayer = new Map();
  generatedItems.forEach((item) => byLayer.set(item.layerIndex, (byLayer.get(item.layerIndex) ?? 0) + 1));
  let sameAdjacent = 0;
  let comparable = 0;
  [...byLayer.keys()].forEach((layerIndex) => {
    const items = generatedItems
      .filter((item) => item.layerIndex === layerIndex)
      .sort((a, b) => a.pathIndex - b.pathIndex);
    for (let i = 1; i < items.length; i += 1) {
      comparable += 1;
      if (items[i].itemId === items[i - 1].itemId) sameAdjacent += 1;
    }
  });
  const actualClusterRatio = comparable ? sameAdjacent / comparable : 1;
  const avgTailLength = Math.min(settings.tailLengthCap, Math.max(1, settings.avgTailLengthTarget + (actualClusterRatio - settings.clusterRatio) * settings.tailLengthVariance));
  return {
    status: "Generated",
    generatedAt: Date.now(),
    generatorVersion: GENERATOR_VERSION,
    totalRequired: source.stats.totalRequired,
    totalGenerated: generatedItems.length,
    missing: Math.max(0, source.stats.totalRequired - generatedItems.length),
    branchCount: byBranch.size,
    clusterCount: Math.max(1, Math.ceil(generatedItems.length / Math.max(1, settings.maxClusterSizePerBranch))),
    actualClusterRatio: Number(actualClusterRatio.toFixed(3)),
    avgTailLength: Number(avgTailLength.toFixed(2))
  };
}

export function generatePreview(state, rawSettings = {}) {
  const settingsResult = validateGenerateSettings(rawSettings);
  const settings = normalizeGenerateSettings(settingsResult.settings);
  const source = analyzeGenerateSource(state);
  const errors = [...settingsResult.errors, ...source.issues.filter((issue) => issue.severity === "error")];
  if (errors.length > 0) {
    return { ok: false, preview: null, source, settings, issues: errors };
  }

  const random = createRandom(settings.seed);
  const next = structuredClone(state);
  const maxLayerIndex = Math.max(0, ...source.requirements.map((entry) => entry.layerIndex));
  ensureLayers(next, maxLayerIndex);
  clearGeneratedLayerItems(next);

  const generatedItems = [];
  const sourceByLayer = new Map();
  source.requirements.forEach((requirement) => {
    const list = sourceByLayer.get(requirement.layerIndex) ?? [];
    list.push(requirement);
    sourceByLayer.set(requirement.layerIndex, list);
  });

  for (const [layerIndex, requirements] of sourceByLayer.entries()) {
    const validCells = source.validByLayer.get(layerIndex) ?? [];
    const branches = branchCellsForIndexes(state, validCells);
    if (branches.length === 0 && requirements.some((entry) => entry.amount > 0)) {
      return {
        ok: false,
        preview: null,
        source,
        settings,
        issues: [createGeneratorIssue({
          code: "BRANCH_DISTRIBUTION_FAILED",
          message: `Layer ${layerIndex + 1} has no valid branch for generated items.`,
          layerIndex,
          suggestion: "Add playable path cells or remove blocked cells on this layer."
        })]
      };
    }
    const branchCopies = branches.map((branch) => ({ ...branch, indexes: branch.indexes.slice() }));
    requirements.forEach((requirement) => {
      const cells = takeCellsFromBranches(branchCopies, requirement.amount, settings, random);
      if (cells.length < requirement.amount) return;
      const layer = next.layers.find((candidate, order) => (Number.isInteger(candidate.layer) ? candidate.layer : order) === layerIndex);
      cells.forEach((cell, order) => {
        const { x, y } = indexToPosition(cell.index, next.grid.columns);
        layer.cells[cellKey(x, y)] = { item: createItemFromRequirement(requirement) };
        generatedItems.push({
          id: `gen_${layerIndex}_${requirement.trayId}_${requirement.itemId}_${cell.index}_${order}`,
          itemId: requirement.itemId,
          layerIndex,
          gridX: x,
          gridY: y,
          pathIndex: cell.index,
          branchId: cell.branchId,
          sourceTrayId: `tray_${requirement.trayId}`
        });
      });
    });
  }

  if (generatedItems.length !== source.stats.totalRequired) {
    return {
      ok: false,
      preview: null,
      source,
      settings,
      issues: [createGeneratorIssue({
        code: "GENERATION_FAILED",
        message: `Generated ${generatedItems.length}/${source.stats.totalRequired} items after ${settings.maxRetries} retry limit.`,
        suggestion: "Increase valid slots, lower cluster pressure, or use an easier preset."
      })]
    };
  }

  const meta = generatedMetrics(generatedItems, settings, source);
  next.generateSettings = settings;
  next.generatedItems = generatedItems;
  next.generationMeta = meta;
  return { ok: true, preview: next, source, settings, issues: [], generatedItems, meta };
}

export function applyGeneratedPreview(targetState, previewState) {
  if (!previewState?.layers || !previewState?.generationMeta) return false;
  targetState.layers = structuredClone(previewState.layers);
  targetState.activeLayerId = previewState.activeLayerId;
  targetState.mysteryFruitElement = structuredClone(previewState.mysteryFruitElement ?? []);
  targetState.generateSettings = structuredClone(previewState.generateSettings);
  targetState.generatedItems = structuredClone(previewState.generatedItems ?? []);
  targetState.generationMeta = structuredClone(previewState.generationMeta);
  return true;
}

export function resetGeneratedItems(targetState, backupState) {
  if (!backupState?.layers) return false;
  targetState.layers = structuredClone(backupState.layers);
  targetState.activeLayerId = backupState.activeLayerId;
  targetState.mysteryFruitElement = structuredClone(backupState.mysteryFruitElement ?? []);
  targetState.generatedItems = [];
  targetState.generationMeta = { status: "Not Generated", generatedAt: 0, generatorVersion: GENERATOR_VERSION };
  return true;
}
