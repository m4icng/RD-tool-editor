import { BLOCK_ITEM_GLYPH, blockVisualMeta } from "../core/block-visuals.js";
import { createLayer, reindexLayers } from "../core/editor-state.js";
import { createFruit } from "../objects/fruit-object.js";
import { pathConnectionsAt } from "../objects/element-placement-rules.js";
import { cellKey, indexToPosition } from "../utils/grid-utils.js";
import { DERIVED_GENERATE_PARAMETER_ALIASES, DERIVED_GENERATE_SETTING_KEYS, GENERATOR_VERSION, createRandomGenerateSeed, normalizeGenerateSettings, validateGenerateSettings } from "./generate-settings.js";
import { analyzeAdaptiveLevel, createTuningState, estimateDerivedGenerateParameters, updateTuningState } from "./adaptive-parameters.js";
import { buildStraightClusterContext, placeLayerClusters, summarizeSpatialDistribution } from "./cluster-distribution.js";
import { analyzeGenerateSource, createGeneratorIssue, fruitTypeFromItemId } from "./generate-source.js";
import { isItemLayerLocked } from "./item-layer-locks.js";

function createRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
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
  (state.layers ?? []).forEach((layer, order) => {
    const layerIndex = Number.isInteger(layer.layer) ? layer.layer : order;
    if (isItemLayerLocked(state, layerIndex)) return;
    layer.cells = {};
  });
  state.mysteryFruitElement = (state.mysteryFruitElement ?? []).filter((entry) => isItemLayerLocked(state, entry.layer));
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

function quotaKey(layerIndex, itemId) {
  return `${layerIndex}:${itemId}`;
}

function autoLayerIndexesForSource(source) {
  return (source.autoLayerIndexes?.length ? source.autoLayerIndexes : [...(source.validByLayer?.keys() ?? [])]).sort((a, b) => a - b);
}

function nudgeEqualBudgets(budgets, capacities, random) {
  const values = new Set(budgets);
  if (values.size > 1 || budgets.length <= 1) return budgets;
  const donors = budgets
    .map((budget, index) => ({ budget, index }))
    .filter((entry) => entry.budget > 1);
  const receivers = budgets
    .map((budget, index) => ({ budget, index }))
    .filter((entry) => entry.budget < capacities[entry.index]);
  if (donors.length === 0 || receivers.length === 0) return budgets;
  const donor = donors[Math.floor(random() * donors.length)];
  const receiverPool = receivers.filter((entry) => entry.index !== donor.index);
  const receiver = receiverPool[Math.floor(random() * receiverPool.length)] ?? receivers[0];
  if (!receiver || receiver.index === donor.index) return budgets;
  const next = budgets.slice();
  next[donor.index] -= 1;
  next[receiver.index] += 1;
  return next;
}

function allocateWeightedBudgets(total, capacities, weights, random) {
  const budgets = Array.from({ length: capacities.length }, () => 0);
  const available = capacities
    .map((capacity, index) => ({ capacity, index }))
    .filter((entry) => entry.capacity > 0);
  if (available.length === 0) return budgets;
  let remaining = total;
  if (total >= available.length) {
    available.forEach(({ index }) => {
      budgets[index] = 1;
      remaining -= 1;
    });
  }
  const remainingCapacities = capacities.map((capacity, index) => Math.max(0, capacity - budgets[index]));
  const totalWeight = weights.reduce((sum, weight, index) => sum + (remainingCapacities[index] > 0 ? weight : 0), 0);
  if (totalWeight <= 0) return budgets;
  const quotas = weights.map((weight, index) => remaining * (remainingCapacities[index] > 0 ? weight : 0) / totalWeight);
  quotas.forEach((quota, index) => {
    const amount = Math.min(remainingCapacities[index], Math.floor(quota));
    budgets[index] += amount;
  });
  remaining = total - budgets.reduce((sum, value) => sum + value, 0);
  let ranked = quotas
    .map((quota, index) => ({ index, score: quota - Math.floor(quota) + random() * 0.01 }))
    .sort((a, b) => b.score - a.score);
  let cursor = 0;
  while (remaining > 0 && ranked.some((entry) => budgets[entry.index] < capacities[entry.index])) {
    const entry = ranked[cursor % ranked.length];
    if (budgets[entry.index] < capacities[entry.index]) {
      budgets[entry.index] += 1;
      remaining -= 1;
    }
    cursor += 1;
    if (cursor > ranked.length * Math.max(1, total)) {
      ranked = ranked.filter((entry) => budgets[entry.index] < capacities[entry.index]);
      cursor = 0;
    }
  }
  return budgets;
}

function generatedLayerBudgets(total, layerIndexes, source, random) {
  if (layerIndexes.length <= 1) return [total];
  const capacities = layerIndexes.map((layerIndex) => source.validByLayer.get(layerIndex)?.length ?? 0);
  const totalCapacity = capacities.reduce((sum, value) => sum + value, 0);
  if (totalCapacity > 0 && total > totalCapacity) return capacities;
  const layerCount = layerIndexes.length;
  const jitter = layerCount > 2 ? 0.22 : 0.14;
  const weights = capacities.map((capacity) => {
    if (capacity <= 0) return 0;
    return 1 + (random() - 0.5) * jitter * 2;
  });
  return nudgeEqualBudgets(allocateWeightedBudgets(total, capacities, weights, random), capacities, random);
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
  const autoLayerIndexes = autoLayerIndexesForSource(source);
  if (autoLayerIndexes.length === 0) return { layerCount: 0, layerIndexes: [], requirements: [] };
  const budgets = generatedLayerBudgets(source.stats.totalRequired, autoLayerIndexes, source, random);
  const span = demandSpan(source);
  const noiseRatio = Number(settings.autoDerivedParameters?.noiseRatio ?? 0.42);
  const carryOverRatio = Number(settings.autoDerivedParameters?.carryOverRatio ?? noiseRatio);
  const futureRatio = Math.max(noiseRatio, carryOverRatio);
  const pool = source.requirements
    .map((entry) => ({ ...entry, sourceTrayLayerIndex: entry.layerIndex, remaining: entry.amount }))
    .sort((a, b) => a.sourceTrayLayerIndex - b.sourceTrayLayerIndex || a.trayId - b.trayId || a.itemId - b.itemId);
  const planned = [];
  budgets.forEach((budget, mapLayerOrder) => {
    const mapLayerIndex = autoLayerIndexes[mapLayerOrder];
    if (!Number.isInteger(mapLayerIndex)) return;
    const remainingTotal = pool.reduce((sum, entry) => sum + entry.remaining, 0);
    const isLastAutoLayer = mapLayerOrder === budgets.length - 1;
    const target = isLastAutoLayer ? remainingTotal : Math.min(budget, remainingTotal);
    if (target <= 0) return;
    const futureStart = Math.min(span.max, mapLayerOrder + 2);
    const futureFocus = Math.min(span.max, futureStart + 1 + Math.round(random() * Math.max(1, span.max - futureStart)));
    const futureTarget = isLastAutoLayer
      ? 0
      : Math.min(target, Math.round(target * futureRatio));
    const nearTarget = isLastAutoLayer
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
      (entry) => entry.sourceTrayLayerIndex >= mapLayerOrder && entry.sourceTrayLayerIndex < futureStart,
      (entry) => 8 - Math.abs(entry.sourceTrayLayerIndex - (mapLayerOrder + 1)),
      random
    );
    const anchor = takeDemandFromPool(
      pool,
      anchorTarget,
      () => true,
      (entry) => 4 - Math.abs(entry.sourceTrayLayerIndex - mapLayerOrder) * 0.6,
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
        mapLayerOrder,
        sourceTrayLayerIndex: entry.sourceTrayLayerIndex,
        amount: entry.amount
      });
    });
  });
  pool.filter((entry) => entry.remaining > 0).forEach((entry) => {
    planned.push({ ...entry, layerIndex: autoLayerIndexes[autoLayerIndexes.length - 1], mapLayerOrder: autoLayerIndexes.length - 1, amount: entry.remaining });
    entry.remaining = 0;
  });
  return { layerCount: autoLayerIndexes.length, layerIndexes: autoLayerIndexes, requirements: planned };
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
  const byCluster = new Set(generatedItems.map((item) => item.clusterId).filter(Boolean));
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
    clusterCount: byCluster.size || Math.max(1, Math.ceil(generatedItems.length / Math.max(1, settings.maxClusterSizePerBranch))),
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
    autoTuningProfile: structuredClone(settings.autoTuningProfile ?? null),
    spatialDistribution: structuredClone(source.spatialDistribution ?? null)
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
    const context = buildStraightClusterContext(state, validCells, requiredInGeneratedLayer, settings.maxClusterSizePerBranch);
    if (context.straightRuns.length === 0 && requirements.some((entry) => entry.amount > 0)) {
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
    const previousLayerIndexes = generatedLayerIndexes.get(layerIndex - 1) ?? new Set();
    const placed = placeLayerClusters({
      state,
      context,
      requirements,
      settings,
      random,
      previousLayerIndexes,
      scoreCell: (requirement, index) => scoreCellForRequirement(state, source, settings, requirement, index, random)
    });
    if (!placed.ok) {
      return {
        ok: false,
        preview: null,
        source,
        settings,
        issues: [createGeneratorIssue({
          code: "ITEM_DISTRIBUTION_REPAIR_FAILED",
          message: `Lớp ${layerIndex + 1} không tìm được cụm thẳng hợp lệ cho ${placed.missing.reduce((sum, entry) => sum + entry.amount, 0)} vật phẩm còn lại.`,
          layerIndex,
          suggestion: "Sinh lại với seed khác, giảm mật độ item hoặc thêm đoạn path thẳng hợp lệ."
        })]
      };
    }
    const layer = next.layers.find((candidate, order) => (Number.isInteger(candidate.layer) ? candidate.layer : order) === layerIndex);
    placed.placedCells.forEach((cell, order) => {
      const requirement = cell.requirement;
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
        regionId: cell.regionId,
        clusterId: cell.clusterId,
        clusterSize: cell.clusterSize,
        clusterOrientation: cell.orientation,
        sourceTrayId: `tray_${requirement.trayId}`,
        releaseDelay,
        spawnRisk: requirement.layerIndex > 0 && pathOrder < settings.spawnSafetyDistance,
        connectionCount: pathConnectionsAt(state, cell.index).length
      });
    });
    source.spatialDistribution = {
      ...(source.spatialDistribution ?? {}),
      [String(layerIndex)]: summarizeSpatialDistribution(context, placed.placedClusters)
    };
    const usedLayerIndexes = new Set(placed.placedCells.map((cell) => cell.index));
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
    "NEXT_LAYER_SPAWN_TRAP",
    "ITEM_DISTRIBUTION_REPAIR_FAILED"
  ]);
  return result?.issues?.some((issue) => retryableCodes.has(issue.code));
}

function applyOverrideDerivedParameters(derivedParameters, overrideSettings) {
  const next = {
    ...derivedParameters,
    clusterSizeDistribution: { ...(derivedParameters.clusterSizeDistribution ?? {}) }
  };
  Object.entries(overrideSettings).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = value;
      return;
    }
    const alias = DERIVED_GENERATE_PARAMETER_ALIASES[key];
    if (!alias) return;
    if (alias === "clusterSizeDistribution.max") {
      const max = Number(value);
      const min = Math.min(Number(next.clusterSizeDistribution.min ?? 1), max);
      next.clusterSizeDistribution = {
        ...next.clusterSizeDistribution,
        min,
        preferred: Math.min(Math.max(Number(next.clusterSizeDistribution.preferred ?? max), min), max),
        max
      };
      return;
    }
    next[alias] = value;
  });
  return next;
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
    const overrideSettings = Object.fromEntries((baseSettings.derivedOverrideKeys ?? [])
      .filter((key) => DERIVED_GENERATE_SETTING_KEYS.includes(key))
      .map((key) => [key, baseSettings[key]]));
    const autoDerivedParameters = applyOverrideDerivedParameters(derived.derivedParameters, overrideSettings);
    const settings = normalizeGenerateSettings({
      ...baseSettings,
      ...derived.settings,
      ...overrideSettings,
      seed: createRandomGenerateSeed(),
      autoDerivedParameters,
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
