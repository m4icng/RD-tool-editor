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

function spatialRegionKey(state, index) {
  const { x, y } = indexToPosition(index, state.grid.columns);
  const xBandSize = Math.max(1, Math.ceil(state.grid.columns / 3));
  const yBandSize = Math.max(1, Math.ceil(state.grid.rows / 3));
  const xBand = Math.min(2, Math.floor(x / xBandSize));
  const yBand = Math.min(2, Math.floor(y / yBandSize));
  return `${xBand}:${yBand}`;
}

function createSpatialSpreadState(state, validCells, targetAmount) {
  const capacityByRegion = new Map();
  validCells.forEach((index) => {
    const key = spatialRegionKey(state, index);
    capacityByRegion.set(key, (capacityByRegion.get(key) ?? 0) + 1);
  });
  return {
    totalCapacity: Math.max(1, validCells.length),
    targetAmount: Math.max(1, targetAmount),
    capacityByRegion,
    usedByRegion: new Map()
  };
}

function spatialSpreadPenalty(state, spread, settings, index) {
  const key = spatialRegionKey(state, index);
  const capacity = spread.capacityByRegion.get(key) ?? 1;
  const capacityRatio = capacity / spread.totalCapacity;
  const idealUse = Math.max(1, spread.targetAmount * capacityRatio);
  const used = spread.usedByRegion.get(key) ?? 0;
  const pressure = used / idealUse;
  const spreadWeight = 12 + settings.branchDistributionBalance * 18;
  return pressure * spreadWeight + Math.max(0, pressure - 1) * 38;
}

function markSpatialUse(state, spread, index) {
  const key = spatialRegionKey(state, index);
  spread.usedByRegion.set(key, (spread.usedByRegion.get(key) ?? 0) + 1);
}

function adjacentOverlapRatio(validCellCount, targetAmount) {
  const roomRatio = validCellCount / Math.max(1, targetAmount);
  if (roomRatio >= 3) return 0.1;
  if (roomRatio >= 2) return 0.15;
  if (roomRatio >= 1.4) return 0.2;
  return 0.25;
}

function createAdjacentOverlapState(validCells, targetAmount, previousIndexes) {
  const previous = previousIndexes ?? new Set();
  const nonOverlapCapacity = validCells.filter((index) => !previous.has(index)).length;
  const ratio = adjacentOverlapRatio(validCells.length, targetAmount);
  const baseBudget = Math.floor(targetAmount * ratio);
  return {
    previous,
    budget: Math.max(baseBudget, Math.max(0, targetAmount - nonOverlapCapacity)),
    used: 0
  };
}

function adjacentOverlapPenalty(overlap, settings, index) {
  if (!overlap.previous.has(index)) return 0;
  if (overlap.used >= overlap.budget) return Number.POSITIVE_INFINITY;
  return 34 + settings.branchDistributionBalance * 24;
}

function markAdjacentOverlapUse(overlap, index) {
  if (overlap.previous.has(index)) overlap.used += 1;
}

function bestBranchCandidate(state, source, branch, requirement, settings, random, usedIndexes, spread, overlap) {
  let best = null;
  branch.indexes.forEach((index) => {
    if (usedIndexes.has(index)) return;
    const overlapPenalty = adjacentOverlapPenalty(overlap, settings, index);
    if (!Number.isFinite(overlapPenalty)) return;
    const score = scoreCellForRequirement(state, source, settings, requirement, index, random)
      + spatialSpreadPenalty(state, spread, settings, index)
      + overlapPenalty;
    if (!best || score < best.score) best = { index, score };
  });
  return best;
}

function takeCellsFromBranches(state, source, branches, requirement, settings, random, usedIndexes, spread, overlap) {
  const picked = [];
  let guard = 0;
  while (picked.length < requirement.amount && guard < requirement.amount * Math.max(1, branches.length) * 5) {
    const rankedBranches = branches
      .map((branch) => ({ branch, candidate: bestBranchCandidate(state, source, branch, requirement, settings, random, usedIndexes, spread, overlap) }))
      .filter((entry) => entry.candidate)
      .sort((a, b) => a.candidate.score - b.candidate.score);
    if (rankedBranches.length === 0) break;
    const branch = rankedBranches[0].branch;
    const chunkSize = Math.max(1, Math.min(settings.maxClusterSizePerBranch, requirement.amount - picked.length));
    const actualChunk = Math.max(1, Math.round(chunkSize * Math.max(0.15, settings.clusterRatio)));
    for (let i = 0; i < actualChunk && picked.length < requirement.amount && branch.indexes.length > 0; i += 1) {
      const candidate = bestBranchCandidate(state, source, branch, requirement, settings, random, usedIndexes, spread, overlap);
      if (!candidate) break;
      const index = candidate.index;
      branch.indexes = branch.indexes.filter((entry) => entry !== index);
      if (usedIndexes.has(index)) continue;
      usedIndexes.add(index);
      markSpatialUse(state, spread, index);
      markAdjacentOverlapUse(overlap, index);
      picked.push({ index, branchId: branch.branchId });
    }
    guard += 1;
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

function deriveGeneratedMapLayerCount(state, source) {
  const explicitCount = Math.max(1, state.layers?.length ?? 1);
  const trayLayerCount = new Set(source.requirements.map((entry) => entry.layerIndex)).size;
  const densityCount = Math.max(1, Math.ceil((source.stats.totalRequired || 1) / 32));
  const autoCount = Math.max(1, Math.min(8, densityCount, Math.max(1, trayLayerCount)));
  if (explicitCount > 1 && explicitCount < trayLayerCount) return explicitCount;
  return autoCount;
}

function generatedLayerBudgets(total, layerCount) {
  if (layerCount <= 1) return [total];
  const weights = Array.from({ length: layerCount }, (_, index) => 1 + index / Math.max(1, layerCount - 1) * 0.22);
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const budgets = weights.map((weight) => Math.floor(total * weight / weightSum));
  let remainder = total - budgets.reduce((sum, value) => sum + value, 0);
  for (let index = budgets.length - 1; remainder > 0; index = (index - 1 + budgets.length) % budgets.length) {
    budgets[index] += 1;
    remainder -= 1;
  }
  return budgets;
}

function takeDemandFromPool(pool, amount, predicate, scoreEntry, random) {
  const taken = [];
  let remaining = amount;
  const candidates = pool
    .filter((entry) => entry.remaining > 0 && predicate(entry))
    .map((entry) => ({ entry, score: scoreEntry(entry) + random() * 0.35 }))
    .sort((a, b) => b.score - a.score)
    .map((candidate) => candidate.entry);
  candidates.forEach((entry) => {
    if (remaining <= 0) return;
    const count = Math.min(entry.remaining, remaining);
    entry.remaining -= count;
    remaining -= count;
    taken.push({ ...entry, amount: count });
  });
  return { taken, missing: remaining };
}

function demandSpan(source) {
  const layers = source.requirements.map((entry) => entry.layerIndex);
  return {
    min: Math.min(0, ...layers),
    max: Math.max(0, ...layers)
  };
}

function buildAdaptiveLayerRequirements(state, source, settings, random) {
  const layerCount = deriveGeneratedMapLayerCount(state, source);
  const budgets = generatedLayerBudgets(source.stats.totalRequired, layerCount);
  const span = demandSpan(source);
  const noiseRatio = Number(settings.autoDerivedParameters?.noiseRatio ?? 0.42);
  const carryOverRatio = Number(settings.autoDerivedParameters?.carryOverRatio ?? noiseRatio);
  const futureRatio = Math.max(noiseRatio, carryOverRatio);
  const pool = source.requirements
    .map((entry) => ({ ...entry, sourceTrayLayerIndex: entry.layerIndex, remaining: entry.amount }))
    .sort((a, b) => a.sourceTrayLayerIndex - b.sourceTrayLayerIndex || a.trayId - b.trayId || a.itemId - b.itemId);
  const planned = [];
  budgets.forEach((budget, mapLayerIndex) => {
    const remainingTotal = pool.reduce((sum, entry) => sum + entry.remaining, 0);
    const target = mapLayerIndex === budgets.length - 1 ? remainingTotal : Math.min(budget, remainingTotal);
    if (target <= 0) return;
    const futureStart = Math.min(span.max, mapLayerIndex + 2);
    const futureFocus = Math.min(span.max, futureStart + 1 + Math.round(random() * Math.max(1, span.max - futureStart)));
    const futureTarget = mapLayerIndex === budgets.length - 1
      ? 0
      : Math.min(target, Math.round(target * futureRatio));
    const nearTarget = mapLayerIndex === budgets.length - 1
      ? 0
      : Math.min(target - futureTarget, Math.round(target * 0.18));
    const anchorTarget = Math.max(0, target - futureTarget - nearTarget);
    const future = takeDemandFromPool(
      pool,
      futureTarget,
      (entry) => entry.sourceTrayLayerIndex >= futureStart,
      (entry) => 12 - Math.abs(entry.sourceTrayLayerIndex - futureFocus) * 1.7 + entry.sourceTrayLayerIndex * 0.08,
      random
    );
    const near = takeDemandFromPool(
      pool,
      nearTarget,
      (entry) => entry.sourceTrayLayerIndex >= mapLayerIndex && entry.sourceTrayLayerIndex < futureStart,
      (entry) => 8 - Math.abs(entry.sourceTrayLayerIndex - (mapLayerIndex + 1)),
      random
    );
    const anchor = takeDemandFromPool(
      pool,
      anchorTarget,
      () => true,
      (entry) => 4 - Math.abs(entry.sourceTrayLayerIndex - mapLayerIndex) * 0.6,
      random
    );
    const missing = future.missing + near.missing + anchor.missing;
    const fallback = missing > 0
      ? takeDemandFromPool(
        pool,
        missing,
        () => true,
        (entry) => 2 - entry.sourceTrayLayerIndex * 0.03,
        random
      ).taken
      : [];
    [...future.taken, ...near.taken, ...anchor.taken, ...fallback].forEach((entry) => {
      planned.push({
        ...entry,
        layerIndex: mapLayerIndex,
        sourceTrayLayerIndex: entry.sourceTrayLayerIndex,
        amount: entry.amount
      });
    });
  });
  pool.filter((entry) => entry.remaining > 0).forEach((entry) => {
    planned.push({ ...entry, layerIndex: layerCount - 1, amount: entry.remaining });
    entry.remaining = 0;
  });
  return { layerCount, requirements: planned };
}

function quotaCountsFromRequirements(requirements) {
  const totalByItem = new Map();
  let total = 0;
  requirements.forEach((entry) => {
    total += entry.amount;
    totalByItem.set(entry.itemId, (totalByItem.get(entry.itemId) ?? 0) + entry.amount);
  });
  return { total, totalByItem };
}

function quotaCountsFromGenerated(generatedItems) {
  const totalByItem = new Map();
  const seenCells = new Set();
  const duplicateCells = [];
  generatedItems.forEach((entry) => {
    totalByItem.set(entry.itemId, (totalByItem.get(entry.itemId) ?? 0) + 1);
    const cellKey = quotaKey(entry.layerIndex, entry.pathIndex);
    if (seenCells.has(cellKey)) duplicateCells.push(entry.pathIndex);
    seenCells.add(cellKey);
  });
  return { total: generatedItems.length, totalByItem, duplicateCells };
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
  required.totalByItem.forEach((amount, itemId) => {
    const actual = generated.totalByItem.get(itemId) ?? 0;
    if (actual !== amount) {
      issues.push(createGeneratorIssue({
        code: "ITEM_ID_QUOTA_MISMATCH",
        message: `Mã vật phẩm ${itemId} sinh ${actual}/${amount}, không khớp tổng yêu cầu khay.`,
        suggestion: "Bộ sinh phải giữ đúng tổng mã vật phẩm từ khay nguồn."
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
  const indexesByLayer = new Map();
  generatedItems.forEach((item) => byLayer.set(item.layerIndex, (byLayer.get(item.layerIndex) ?? 0) + 1));
  generatedItems.forEach((item) => {
    const indexes = indexesByLayer.get(item.layerIndex) ?? new Set();
    indexes.add(item.pathIndex);
    indexesByLayer.set(item.layerIndex, indexes);
  });
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
  const carryOverCount = generatedItems.filter((item) => Number(item.sourceTrayLayerIndex) > Number(item.layerIndex) + 1).length;
  let adjacentOverlapCount = 0;
  let adjacentLayerItemCount = 0;
  [...indexesByLayer.keys()].sort((a, b) => a - b).forEach((layerIndex) => {
    const previous = indexesByLayer.get(layerIndex - 1);
    const current = indexesByLayer.get(layerIndex);
    if (!previous || !current) return;
    current.forEach((index) => {
      if (previous.has(index)) adjacentOverlapCount += 1;
    });
    adjacentLayerItemCount += current.size;
  });
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
    carryOverCount,
    carryOverActualRatio: generatedItems.length ? Number((carryOverCount / generatedItems.length).toFixed(3)) : 0,
    adjacentOverlapCount,
    adjacentOverlapRatio: adjacentLayerItemCount ? Number((adjacentOverlapCount / adjacentLayerItemCount).toFixed(3)) : 0,
    generatedMapLayerCount: byLayer.size,
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
  const layerPlan = buildAdaptiveLayerRequirements(state, source, settings, random);
  const maxLayerIndex = Math.max(0, layerPlan.layerCount - 1);
  ensureLayers(next, maxLayerIndex);
  clearGeneratedLayerItems(next);

  const generatedItems = [];
  const sourceByLayer = new Map();
  layerPlan.requirements.forEach((requirement) => {
    const list = sourceByLayer.get(requirement.layerIndex) ?? [];
    list.push(requirement);
    sourceByLayer.set(requirement.layerIndex, list);
  });
  const generatedLayerIndexes = new Map();

  for (const [layerIndex, requirements] of [...sourceByLayer.entries()].sort(([a], [b]) => a - b)) {
    const validCells = source.validByLayer.get(layerIndex) ?? [];
    const requiredInGeneratedLayer = requirements.reduce((sum, entry) => sum + entry.amount, 0);
    if (requiredInGeneratedLayer > validCells.length) {
      return {
        ok: false,
        preview: null,
        source,
        settings,
        issues: [createGeneratorIssue({
          code: "NOT_ENOUGH_VALID_CELLS",
          message: `Layer sinh ${layerIndex + 1} cần ${requiredInGeneratedLayer} vật phẩm nhưng chỉ có ${validCells.length} ô hợp lệ.`,
          layerIndex,
          suggestion: "Tăng số item layer hoặc mở thêm path hợp lệ để giảm mật độ mỗi layer."
        })]
      };
    }
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
    const spatialSpread = createSpatialSpreadState(state, validCells, requiredInGeneratedLayer);
    const adjacentOverlap = createAdjacentOverlapState(validCells, requiredInGeneratedLayer, generatedLayerIndexes.get(layerIndex - 1));
    requirementChunks(requirements, settings, random).forEach((requirement) => {
      const cells = takeCellsFromBranches(state, source, branchCopies, requirement, settings, random, usedLayerIndexes, spatialSpread, adjacentOverlap);
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
          sourceTrayLayerIndex: requirement.sourceTrayLayerIndex,
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
    generatedLayerIndexes.set(layerIndex, new Set(usedLayerIndexes));
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
