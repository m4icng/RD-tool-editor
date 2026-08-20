import { BLOCK_ITEM_GLYPH, blockVisualMeta } from "../core/block-visuals.js";
import { createLayer, reindexLayers } from "../core/editor-state.js";
import { createFruit } from "../objects/fruit-object.js";
import { pathConnectionsAt } from "../objects/element-placement-rules.js";
import { cellKey, indexToPosition } from "../utils/grid-utils.js";
import { GENERATOR_VERSION, createRandomGenerateSeed, normalizeGenerateSettings, validateGenerateSettings } from "./generate-settings.js";
import { analyzeAdaptiveLevel, createTuningState, estimateDerivedGenerateParameters, updateTuningState } from "./adaptive-parameters.js";
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

function pathOrderMap(source) {
  return new Map((source.pathIndexes ?? []).map((index, order) => [index, order]));
}

function pathDistance(source, fromIndex, toIndex) {
  const order = pathOrderMap(source);
  const from = order.get(fromIndex);
  const to = order.get(toIndex);
  if (Number.isInteger(from) && Number.isInteger(to)) return Math.abs(from - to);
  return Math.abs(Number(fromIndex) - Number(toIndex));
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

function scoreCellForRequirement(state, source, settings, requirement, index, random) {
  const order = pathOrderMap(source).get(index) ?? index;
  const releaseDelay = pathDistance(source, index, requirement.deliverIndex);
  const releaseScore = Math.abs(releaseDelay - settings.releaseDelayTarget) * settings.releaseDistanceWeight;
  const connections = pathConnectionsAt(state, index).length;
  const narrowBonus = connections <= 1
    ? settings.loopRiskPressure + settings.narrowPathUsage
    : connections === 2
      ? settings.narrowPathUsage * 0.35
      : settings.routeChoicePressure * -0.35;
  const spawnPenalty = requirement.layerIndex > 0 && order < settings.spawnSafetyDistance
    ? (1 - settings.nextLayerTrapPressure) * 100
    : 0;
  return releaseScore - narrowBonus + spawnPenalty + random() * 0.25;
}

function takeCellsFromBranches(state, source, branches, requirement, settings, random, usedIndexes) {
  const branchQueues = branches
    .filter((branch) => branch.indexes.some((index) => !usedIndexes.has(index)));
  branchQueues.forEach((branch) => {
    const rankedIndexes = shuffle(branch.indexes.filter((index) => !usedIndexes.has(index)), random)
      .map((index) => ({ index, score: scoreCellForRequirement(state, source, settings, requirement, index, random) }))
      .sort((a, b) => a.score - b.score);
    branch.score = rankedIndexes[0]?.score ?? Number.POSITIVE_INFINITY;
    branch.indexes = rankedIndexes.map((entry) => entry.index);
  });
  const activeQueues = branchQueues
    .filter((branch) => branch.indexes.length > 0)
    .sort((a, b) => a.score - b.score);
  const picked = [];
  let cursor = 0;
  let guard = 0;
  while (picked.length < requirement.amount && activeQueues.length > 0 && guard < requirement.amount * Math.max(1, activeQueues.length) * 3) {
    const branch = activeQueues[cursor % activeQueues.length];
    const chunkSize = Math.max(1, Math.min(settings.maxClusterSizePerBranch, requirement.amount - picked.length));
    const actualChunk = Math.max(1, Math.round(chunkSize * Math.max(0.15, settings.clusterRatio)));
    for (let i = 0; i < actualChunk && picked.length < requirement.amount && branch.indexes.length > 0; i += 1) {
      const index = branch.indexes.shift();
      if (usedIndexes.has(index)) continue;
      usedIndexes.add(index);
      picked.push({ index, branchId: branch.branchId });
    }
    cursor += settings.multiBranchMode === "clustered" ? (random() > settings.branchDistributionBalance ? 1 : 0) : 1;
    guard += 1;
    for (let i = activeQueues.length - 1; i >= 0; i -= 1) {
      if (activeQueues[i].indexes.length === 0) activeQueues.splice(i, 1);
    }
  }
  return picked;
}

function requirementChunks(requirements, settings, random) {
  const remaining = requirements.map((requirement) => ({ ...requirement, remaining: requirement.amount }));
  const chunks = [];
  let cursor = 0;
  while (remaining.some((entry) => entry.remaining > 0)) {
    const available = remaining.filter((entry) => entry.remaining > 0);
    let index = remaining.indexOf(available[cursor % available.length]);
    if (chunks.length > 0 && random() > settings.clusterRatio) {
      const previous = chunks[chunks.length - 1];
      const different = available.find((entry) => entry.itemId !== previous.itemId);
      if (different) index = remaining.indexOf(different);
    }
    const entry = remaining[index];
    const clusterSize = Math.max(1, Math.min(settings.maxClusterSizePerBranch, Math.round(settings.maxClusterSizePerBranch * Math.max(0.2, settings.clusterRatio))));
    const amount = Math.min(entry.remaining, clusterSize);
    chunks.push({ ...entry, amount });
    entry.remaining -= amount;
    cursor += 1;
  }
  return chunks;
}

function quotaKey(layerIndex, itemId) {
  return `${layerIndex}:${itemId}`;
}

function quotaCountsFromRequirements(requirements) {
  const totalByLayer = new Map();
  const totalByLayerItem = new Map();
  let total = 0;
  requirements.forEach((entry) => {
    total += entry.amount;
    totalByLayer.set(entry.layerIndex, (totalByLayer.get(entry.layerIndex) ?? 0) + entry.amount);
    totalByLayerItem.set(quotaKey(entry.layerIndex, entry.itemId), (totalByLayerItem.get(quotaKey(entry.layerIndex, entry.itemId)) ?? 0) + entry.amount);
  });
  return { total, totalByLayer, totalByLayerItem };
}

function quotaCountsFromGenerated(generatedItems) {
  const totalByLayer = new Map();
  const totalByLayerItem = new Map();
  const seenCells = new Set();
  const duplicateCells = [];
  generatedItems.forEach((entry) => {
    totalByLayer.set(entry.layerIndex, (totalByLayer.get(entry.layerIndex) ?? 0) + 1);
    totalByLayerItem.set(quotaKey(entry.layerIndex, entry.itemId), (totalByLayerItem.get(quotaKey(entry.layerIndex, entry.itemId)) ?? 0) + 1);
    const cellKey = quotaKey(entry.layerIndex, entry.pathIndex);
    if (seenCells.has(cellKey)) duplicateCells.push(entry.pathIndex);
    seenCells.add(cellKey);
  });
  return { total: generatedItems.length, totalByLayer, totalByLayerItem, duplicateCells };
}

function validateGeneratedQuotas(generatedItems, source) {
  const required = quotaCountsFromRequirements(source.requirements);
  const generated = quotaCountsFromGenerated(generatedItems);
  const issues = [];
  if (generated.total !== required.total) {
    issues.push(createGeneratorIssue({
      code: "ITEM_QUOTA_MISMATCH",
      message: `Tổng vật phẩm sinh ra ${generated.total}/${required.total} không khớp yêu cầu khay.`,
      suggestion: "Không áp dụng màn; kiểm tra ô hợp lệ hoặc giảm áp lực sinh."
    }));
  }
  required.totalByLayer.forEach((amount, layerIndex) => {
    const actual = generated.totalByLayer.get(layerIndex) ?? 0;
    if (actual !== amount) {
      issues.push(createGeneratorIssue({
        code: "LAYER_QUOTA_MISMATCH",
        message: `Lớp ${layerIndex + 1} sinh ${actual}/${amount} vật phẩm.`,
        layerIndex,
        suggestion: "Giữ vật phẩm đúng lớp nguồn, không chuyển vật phẩm giữa các lớp."
      }));
    }
  });
  required.totalByLayerItem.forEach((amount, key) => {
    const actual = generated.totalByLayerItem.get(key) ?? 0;
    if (actual !== amount) {
      const [layerIndex, itemId] = key.split(":").map(Number);
      issues.push(createGeneratorIssue({
        code: "ITEM_ID_QUOTA_MISMATCH",
        message: `Lớp ${layerIndex + 1} mã vật phẩm ${itemId} sinh ${actual}/${amount}.`,
        layerIndex,
        suggestion: "Bộ sinh phải giữ đúng mã vật phẩm và số lượng từ khay nguồn."
      }));
    }
  });
  if (generated.duplicateCells.length > 0) {
    issues.push(createGeneratorIssue({
      code: "ITEM_QUOTA_MISMATCH",
      message: `Có ${generated.duplicateCells.length} vật phẩm trùng ô hoặc thứ tự đường ray.`,
      suggestion: "Sinh lại với seed khác hoặc giảm áp lực cụm."
    }));
  }
  return issues;
}

function estimatePeakUnreleasedInventory({ delayedCount, itemDensity, actualClusterRatio, settings }) {
  if (delayedCount <= 0) return 0;
  const densityPressure = Math.ceil(settings.releaseDelayTarget * Math.min(1, itemDensity) * (1 + settings.releaseDistanceWeight));
  const colorMixPressure = Math.ceil(settings.maxClusterSizePerBranch * Math.max(0.25, 1 - actualClusterRatio));
  const scalePressure = Math.ceil(Math.sqrt(delayedCount) * settings.unreleasedInventoryTarget);
  return Math.min(delayedCount, Math.max(settings.maxClusterSizePerBranch, densityPressure + colorMixPressure + scalePressure));
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
  const avgReleaseDelay = generatedItems.length
    ? generatedItems.reduce((sum, item) => sum + (Number(item.releaseDelay) || 0), 0) / generatedItems.length
    : 0;
  const maxReleaseDelay = generatedItems.reduce((max, item) => Math.max(max, Number(item.releaseDelay) || 0), 0);
  const itemDensity = source.stats.itemDensity ?? 0;
  const delayedCount = generatedItems.filter((item) => item.releaseDelay >= settings.releaseDelayTarget).length;
  const unreleasedInventoryRatio = generatedItems.length ? delayedCount / generatedItems.length : 0;
  const avgTailLength = Math.max(1, settings.avgTailLengthTarget
    + (avgReleaseDelay / Math.max(1, settings.releaseDelayTarget) - 1) * settings.releaseDistanceWeight * 2
    + itemDensity * settings.tailLengthVariance
    + (1 - actualClusterRatio) * settings.tailLengthVariance);
  const peakTailLength = Math.ceil(avgTailLength + settings.tailLengthVariance + Math.min(settings.maxClusterSizePerBranch, generatedItems.length) * itemDensity);
  const maxUnreleasedItems = estimatePeakUnreleasedInventory({ delayedCount, itemDensity, actualClusterRatio, settings });
  const spawnTrapCount = generatedItems.filter((item) => item.spawnRisk).length;
  const decisionPointFrequency = source.pathIndexes?.length ? (source.stats.priorityPoints ?? 0) / source.pathIndexes.length : 0;
  const loopRiskScore = generatedItems.length
    ? generatedItems.filter((item) => item.connectionCount <= 1).length / generatedItems.length
    : 0;
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
    itemDensity: Number(itemDensity.toFixed(3)),
    avgTailLength: Number(avgTailLength.toFixed(2)),
    peakTailLength,
    avgReleaseDelay: Number(avgReleaseDelay.toFixed(2)),
    maxReleaseDelay,
    unreleasedInventoryRatio: Number(unreleasedInventoryRatio.toFixed(3)),
    maxUnreleasedItems,
    spawnTrapCount,
    decisionPointFrequency: Number(decisionPointFrequency.toFixed(3)),
    loopRiskScore: Number(loopRiskScore.toFixed(3)),
    quotaValidated: true,
    difficultyScore: Number(settings.difficultyScore),
    derivedParameters: structuredClone(settings.autoDerivedParameters ?? null),
    autoTuningAttempt: Number(settings.autoTuningAttempt ?? 1),
    autoTuningProfile: structuredClone(settings.autoTuningProfile ?? null)
  };
}

function validateDifficultyMetrics(meta, settings) {
  const issues = [];
  if (meta.peakTailLength > settings.tailLengthCap) {
    issues.push(createGeneratorIssue({
      code: "TAIL_PRESSURE_EXCEEDED",
      message: `Đuôi đỉnh ước tính ${meta.peakTailLength} vượt giới hạn ${settings.tailLengthCap}.`,
      suggestion: "Tăng giới hạn đuôi, tăng gom cụm màu hoặc giảm độ trễ xả."
    }));
  }
  if (meta.maxUnreleasedItems > settings.maxUnreleasedItems) {
    issues.push(createGeneratorIssue({
      code: "RELEASE_PRESSURE_EXCEEDED",
      message: `Tồn kho chưa xả ${meta.maxUnreleasedItems} vượt ngưỡng ${settings.maxUnreleasedItems}.`,
      suggestion: "Giảm độ trễ xả, tăng gom màu hoặc chọn preset dễ hơn."
    }));
  }
  if (meta.spawnTrapCount > settings.maxImmediateChainCount) {
    issues.push(createGeneratorIssue({
      code: "NEXT_LAYER_SPAWN_TRAP",
      message: `Có ${meta.spawnTrapCount} vật phẩm lớp mới nằm trong vùng xuất hiện rủi ro.`,
      suggestion: "Tăng khoảng cách xuất hiện an toàn hoặc giảm áp lực bẫy lớp."
    }));
  }
  return issues;
}

function generatePreviewAttempt(state, source, settings) {
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
          message: `Lớp ${layerIndex + 1} không có nhánh hợp lệ để sinh vật phẩm.`,
          layerIndex,
          suggestion: "Thêm path có thể đi được hoặc bỏ vùng chặn trên layer này."
        })]
      };
    }
    const branchCopies = branches.map((branch) => ({ ...branch, indexes: branch.indexes.slice() }));
    const usedLayerIndexes = new Set();
    requirementChunks(requirements, settings, random).forEach((requirement) => {
      const cells = takeCellsFromBranches(state, source, branchCopies, requirement, settings, random, usedLayerIndexes);
      if (cells.length < requirement.amount) return;
      const layer = next.layers.find((candidate, order) => (Number.isInteger(candidate.layer) ? candidate.layer : order) === layerIndex);
      cells.forEach((cell, order) => {
        const { x, y } = indexToPosition(cell.index, next.grid.columns);
        const releaseDelay = pathDistance(source, cell.index, requirement.deliverIndex);
        const pathOrder = pathOrderMap(source).get(cell.index) ?? cell.index;
        layer.cells[cellKey(x, y)] = { item: createItemFromRequirement(requirement) };
        generatedItems.push({
          id: `gen_${layerIndex}_${requirement.trayId}_${requirement.itemId}_${cell.index}_${order}`,
          itemId: requirement.itemId,
          layerIndex,
          gridX: x,
          gridY: y,
          pathIndex: cell.index,
          branchId: cell.branchId,
          sourceTrayId: `tray_${requirement.trayId}`,
          releaseDelay,
          spawnRisk: requirement.layerIndex > 0 && pathOrder < settings.spawnSafetyDistance,
          connectionCount: pathConnectionsAt(state, cell.index).length
        });
      });
    });
  }

  const quotaIssues = validateGeneratedQuotas(generatedItems, source);
  if (quotaIssues.length > 0) {
    return {
      ok: false,
      preview: null,
      source,
      settings,
      issues: quotaIssues
    };
  }

  const meta = generatedMetrics(generatedItems, settings, source);
  const metricIssues = validateDifficultyMetrics(meta, settings);
  if (metricIssues.length > 0) {
    return { ok: false, preview: null, source, settings, issues: metricIssues, generatedItems, meta };
  }
  next.generateSettings = settings;
  next.generatedItems = generatedItems;
  next.generationMeta = meta;
  return { ok: true, preview: next, source, settings, issues: [], generatedItems, meta };
}

function canRetryGeneration(result) {
  const retryableCodes = new Set([
    "ITEM_QUOTA_MISMATCH",
    "LAYER_QUOTA_MISMATCH",
    "ITEM_ID_QUOTA_MISMATCH",
    "TAIL_PRESSURE_EXCEEDED",
    "RELEASE_PRESSURE_EXCEEDED",
    "NEXT_LAYER_SPAWN_TRAP"
  ]);
  return result?.issues?.some((issue) => retryableCodes.has(issue.code));
}

export function generatePreview(state, rawSettings = {}) {
  const settingsResult = validateGenerateSettings({ ...rawSettings, seed: createRandomGenerateSeed() });
  const baseSettings = normalizeGenerateSettings(settingsResult.settings);
  const source = analyzeGenerateSource(state);
  const analysis = analyzeAdaptiveLevel(state, source);
  const errors = [...settingsResult.errors, ...source.issues.filter((issue) => issue.severity === "error")];
  if (errors.length > 0) {
    return { ok: false, preview: null, source, analysis, settings: baseSettings, issues: errors };
  }

  let lastResult = null;
  let tuning = createTuningState();
  for (let attempt = 0; attempt < baseSettings.maxRetries; attempt += 1) {
    const derived = estimateDerivedGenerateParameters(source, analysis, baseSettings, tuning);
    const settings = normalizeGenerateSettings({
      ...baseSettings,
      ...derived.settings,
      seed: createRandomGenerateSeed(),
      autoDerivedParameters: derived.derivedParameters,
      autoTuningAttempt: attempt + 1,
      autoTuningProfile: tuning
    });
    const result = generatePreviewAttempt(state, source, settings);
    result.analysis = analysis;
    if (result.ok) return result;
    lastResult = result;
    if (!canRetryGeneration(result)) return result;
    tuning = updateTuningState(tuning, result);
  }
  return lastResult ?? { ok: false, preview: null, source, settings: baseSettings, issues: [] };
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
