import { indexToPosition, isInsideGrid, positionToIndex } from "../utils/grid-utils.js";

const REGION_COLUMNS = 3;
const REGION_ROWS = 4;
const LOCAL_DENSITY_RADIUS = 4;
const MAX_DISTRIBUTION_REPAIR_ITERATIONS = 24;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function gridDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function spatialRegionKey(state, index) {
  const { x, y } = indexToPosition(index, state.grid.columns);
  const xBandSize = Math.max(1, Math.ceil(state.grid.columns / REGION_COLUMNS));
  const yBandSize = Math.max(1, Math.ceil(state.grid.rows / REGION_ROWS));
  const xBand = Math.min(REGION_COLUMNS - 1, Math.floor(x / xBandSize));
  const yBand = Math.min(REGION_ROWS - 1, Math.floor(y / yBandSize));
  return `${xBand}:${yBand}`;
}

function adjacentIndexes(state, index) {
  const { x, y } = indexToPosition(index, state.grid.columns);
  return [
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y }
  ]
    .filter((position) => isInsideGrid(state.grid, position.x, position.y))
    .map((position) => positionToIndex(position.x, position.y, state.grid.columns));
}

function createBranchStats(state, validCells, targetAmount) {
  const validSet = new Set(validCells);
  const remaining = new Set(validCells);
  const branches = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    const queue = [first];
    const indexes = [];
    remaining.delete(first);
    while (queue.length > 0) {
      const current = queue.shift();
      indexes.push(current);
      adjacentIndexes(state, current).forEach((next) => {
        if (!validSet.has(next) || !remaining.has(next)) return;
        remaining.delete(next);
        queue.push(next);
      });
    }
    branches.push({ branchId: `branch_${branches.length + 1}`, indexes: indexes.sort((a, b) => a - b) });
  }
  const totalCapacity = Math.max(1, validCells.length);
  const branchByIndex = new Map();
  const stats = new Map();
  branches.forEach((branch) => {
    branch.indexes.forEach((index) => branchByIndex.set(index, branch.branchId));
    stats.set(branch.branchId, {
      branchId: branch.branchId,
      capacity: branch.indexes.length,
      currentItemCount: 0,
      currentClusterCount: 0,
      targetItemCount: Math.max(1, targetAmount * (branch.indexes.length / totalCapacity))
    });
  });
  return { branchByIndex, stats };
}

function createRegionStats(state, validCells, targetAmount) {
  const totalCapacity = Math.max(1, validCells.length);
  const stats = new Map();
  validCells.forEach((index) => {
    const regionId = spatialRegionKey(state, index);
    const current = stats.get(regionId) ?? {
      regionId,
      capacity: 0,
      currentItemCount: 0,
      currentClusterCount: 0,
      targetItemCount: 1
    };
    current.capacity += 1;
    stats.set(regionId, current);
  });
  stats.forEach((region) => {
    region.targetItemCount = Math.max(1, targetAmount * (region.capacity / totalCapacity));
  });
  return stats;
}

function buildStraightRuns(state, validCells, branchByIndex) {
  const validSet = new Set(validCells);
  const runs = [];
  const axes = [
    { orientation: "horizontal", dx: 1, dy: 0 },
    { orientation: "vertical", dx: 0, dy: 1 }
  ];
  axes.forEach((axis) => {
    validCells.forEach((index) => {
      const position = indexToPosition(index, state.grid.columns);
      const previous = { x: position.x - axis.dx, y: position.y - axis.dy };
      if (isInsideGrid(state.grid, previous.x, previous.y)) {
        const previousIndex = positionToIndex(previous.x, previous.y, state.grid.columns);
        if (validSet.has(previousIndex)) return;
      }
      const indices = [];
      let cursor = position;
      while (isInsideGrid(state.grid, cursor.x, cursor.y)) {
        const cursorIndex = positionToIndex(cursor.x, cursor.y, state.grid.columns);
        if (!validSet.has(cursorIndex)) break;
        indices.push(cursorIndex);
        cursor = { x: cursor.x + axis.dx, y: cursor.y + axis.dy };
      }
      if (indices.length < 1) return;
      runs.push({
        id: `run_${runs.length + 1}`,
        orientation: axis.orientation,
        indices,
        length: indices.length,
        branchId: branchByIndex.get(indices[0]) ?? "branch_1",
        regionId: spatialRegionKey(state, indices[Math.floor(indices.length / 2)]),
        usableIndices: indices.slice()
      });
    });
  });
  return runs;
}

function buildClusterCandidates(state, runs, maxClusterSize) {
  const candidates = [];
  runs.forEach((run) => {
    for (let size = 1; size <= maxClusterSize; size += 1) {
      if (run.indices.length < size) continue;
      for (let start = 0; start <= run.indices.length - size; start += 1) {
        const indices = run.indices.slice(start, start + size);
        const positions = indices.map((index) => indexToPosition(index, state.grid.columns));
        const centerX = positions.reduce((sum, position) => sum + position.x, 0) / positions.length;
        const centerY = positions.reduce((sum, position) => sum + position.y, 0) / positions.length;
        candidates.push({
          id: `candidate_${candidates.length + 1}`,
          straightRunId: run.id,
          orientation: run.orientation,
          indices,
          size,
          centerX,
          centerY,
          regionId: spatialRegionKey(state, indices[Math.floor(indices.length / 2)]),
          branchId: run.branchId
        });
      }
    }
  });
  return candidates;
}

export function buildStraightClusterContext(state, validCells, targetAmount, maxClusterSize) {
  const maxSize = clamp(Number(maxClusterSize) || 6, 1, 20);
  const branch = createBranchStats(state, validCells, targetAmount);
  const regionStats = createRegionStats(state, validCells, targetAmount);
  const straightRuns = buildStraightRuns(state, validCells, branch.branchByIndex);
  const candidates = buildClusterCandidates(state, straightRuns, maxSize);
  return {
    validCells,
    maxClusterSize: maxSize,
    regionStats,
    branchStats: branch.stats,
    branchByIndex: branch.branchByIndex,
    straightRuns,
    candidates,
    candidatesBySize: candidates.reduce((map, candidate) => {
      const list = map.get(candidate.size) ?? [];
      list.push(candidate);
      map.set(candidate.size, list);
      return map;
    }, new Map())
  };
}

function preferredClusterSize(requirement, settings, random) {
  const derived = settings.autoDerivedParameters?.clusterSizeDistribution ?? {};
  const distance = Math.max(0, Number(requirement.noiseDistance) || 0);
  const deepNoiseScale = distance > 1 ? Math.max(0.45, 1 - (distance - 1) * 0.2) : 1;
  const maxSize = clamp(Math.ceil((Number(settings.maxClusterSizePerBranch) || Number(derived.max) || 6) * deepNoiseScale), 1, 20);
  const minSize = clamp(Number(settings.minClusterSizePerBranch) || Number(derived.min) || 1, 1, maxSize);
  const preferred = clamp(Number(derived.preferred) || Math.round(maxSize * Math.max(0.35, settings.clusterRatio)), minSize, maxSize);
  const variance = random() < 0.35 ? (random() < 0.5 ? -1 : 1) : 0;
  let size = clamp(Math.round(preferred + variance), minSize, maxSize);
  size = Math.min(size, requirement.remaining);
  if (requirement.remaining - size > 0 && requirement.remaining - size < minSize && requirement.remaining <= maxSize) {
    size = requirement.remaining;
  }
  return Math.max(1, size);
}

export function splitRequirementsIntoClusterQueue(requirements, settings, random) {
  const buckets = requirements.map((requirement) => ({ ...requirement, remaining: requirement.amount, clusters: [] }));
  buckets.forEach((bucket) => {
    while (bucket.remaining > 0) {
      const amount = preferredClusterSize(bucket, settings, random);
      bucket.clusters.push({ ...bucket, amount });
      bucket.remaining -= amount;
    }
  });
  const queue = [];
  let lastItemId = null;
  while (buckets.some((bucket) => bucket.clusters.length > 0)) {
    const available = buckets
      .filter((bucket) => bucket.clusters.length > 0)
      .sort((a, b) => b.clusters.reduce((sum, entry) => sum + entry.amount, 0) - a.clusters.reduce((sum, entry) => sum + entry.amount, 0));
    const picked = available.find((bucket) => bucket.itemId !== lastItemId) ?? available[0];
    const cluster = picked.clusters.shift();
    queue.push(cluster);
    lastItemId = cluster.itemId;
  }
  return queue;
}

function statSaturation(stat) {
  return stat.currentItemCount / Math.max(1, stat.targetItemCount);
}

function sameColorContiguousCount(state, itemByIndex, candidate, itemId) {
  const nextColorIndexes = new Set(candidate.indices);
  const visited = new Set();
  let count = 0;
  const queue = [candidate.indices[0]];
  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const existing = itemByIndex.get(current);
    if (!nextColorIndexes.has(current) && existing !== itemId) continue;
    count += 1;
    adjacentIndexes(state, current).forEach((next) => {
      if (visited.has(next)) return;
      if (nextColorIndexes.has(next) || itemByIndex.get(next) === itemId) queue.push(next);
    });
  }
  return count;
}

function localDensity(state, placedIndexes, candidate) {
  const center = { x: candidate.centerX, y: candidate.centerY };
  let count = 0;
  placedIndexes.forEach((index) => {
    const position = indexToPosition(index, state.grid.columns);
    if (gridDistance(center, position) <= LOCAL_DENSITY_RADIUS) count += 1;
  });
  return count;
}

function averageDifficultyScore(candidate, requirement, scoreCell) {
  if (!scoreCell) return 0;
  const total = candidate.indices.reduce((sum, index) => sum + scoreCell(requirement, index), 0);
  return total / Math.max(1, candidate.indices.length);
}

function scoreCandidate({ state, context, candidate, requirement, settings, placedClusters, placedIndexes, previousLayerIndexes, overlap, scoreCell, random }) {
  const region = context.regionStats.get(candidate.regionId);
  const branch = context.branchStats.get(candidate.branchId);
  const regionSaturation = region ? statSaturation(region) : 1;
  const branchSaturation = branch ? statSaturation(branch) : 1;
  const unusedRegions = [...context.regionStats.values()].filter((entry) => entry.currentClusterCount === 0);
  const unusedBranches = [...context.branchStats.values()].filter((entry) => entry.currentClusterCount === 0);
  const coverageBonus = unusedRegions.length > 0 && region?.currentClusterCount === 0 ? 56 : 0;
  const branchCoverageBonus = unusedBranches.length > 0 && branch?.currentClusterCount === 0 ? 22 : 0;
  const minDistance = placedClusters.length
    ? Math.min(...placedClusters.map((cluster) => gridDistance({ x: candidate.centerX, y: candidate.centerY }, cluster.center)))
    : 0;
  const overlapCount = candidate.indices.filter((index) => previousLayerIndexes?.has(index)).length;
  if (overlapCount > Math.max(0, overlap.budget - overlap.used)) return Number.POSITIVE_INFINITY;
  return averageDifficultyScore(candidate, requirement, scoreCell)
    + regionSaturation * (64 + settings.branchDistributionBalance * 36)
    + branchSaturation * (28 + settings.branchDistributionBalance * 20)
    + localDensity(state, placedIndexes, candidate) * (10 + settings.branchDistributionBalance * 10)
    + overlapCount * (34 + settings.branchDistributionBalance * 24)
    - coverageBonus
    - branchCoverageBonus
    - minDistance * (5 + settings.branchDistributionBalance * 6)
    + random() * 0.2;
}

function isCandidateAvailable(state, context, occupiedIndexes, itemByIndex, candidate, requirement) {
  if (!candidate || candidate.size !== requirement.amount) return false;
  if (candidate.indices.some((index) => occupiedIndexes.has(index))) return false;
  return sameColorContiguousCount(state, itemByIndex, candidate, requirement.itemId) <= context.maxClusterSize;
}

function commitCluster({ context, candidate, requirement, occupiedIndexes, itemByIndex, placedIndexes, placedClusters, overlap }) {
  candidate.indices.forEach((index) => {
    occupiedIndexes.add(index);
    placedIndexes.add(index);
    itemByIndex.set(index, requirement.itemId);
  });
  const region = context.regionStats.get(candidate.regionId);
  if (region) {
    region.currentItemCount += candidate.size;
    region.currentClusterCount += 1;
  }
  const branch = context.branchStats.get(candidate.branchId);
  if (branch) {
    branch.currentItemCount += candidate.size;
    branch.currentClusterCount += 1;
  }
  const overlapCount = candidate.indices.filter((index) => overlap.previous.has(index)).length;
  overlap.used += overlapCount;
  const clusterId = `cluster_${placedClusters.length + 1}`;
  placedClusters.push({
    clusterId,
    itemId: requirement.itemId,
    amount: requirement.amount,
    indices: candidate.indices.slice(),
    center: { x: candidate.centerX, y: candidate.centerY },
    regionId: candidate.regionId,
    branchId: candidate.branchId,
    orientation: candidate.orientation
  });
  return candidate.indices.map((index) => ({
    index,
    branchId: candidate.branchId,
    regionId: candidate.regionId,
    clusterId,
    clusterSize: candidate.size,
    orientation: candidate.orientation
  }));
}

function splitClusterForRetry(cluster) {
  if (cluster.amount <= 1) return [cluster];
  const first = Math.ceil(cluster.amount / 2);
  const second = cluster.amount - first;
  return [
    { ...cluster, amount: first },
    ...(second > 0 ? [{ ...cluster, amount: second }] : [])
  ];
}

export function placeLayerClusters({ state, context, requirements, settings, random, previousLayerIndexes, scoreCell }) {
  const queue = splitRequirementsIntoClusterQueue(requirements, settings, random);
  const occupiedIndexes = new Set();
  const itemByIndex = new Map();
  const placedIndexes = new Set();
  const placedClusters = [];
  const placedCells = [];
  const overlap = {
    previous: previousLayerIndexes ?? new Set(),
    budget: Math.max(0, Math.floor(requirements.reduce((sum, entry) => sum + entry.amount, 0) * 0.18)),
    used: 0
  };
  let cursor = 0;
  let repairIterations = 0;
  while (cursor < queue.length) {
    const requirement = queue[cursor];
    const candidates = context.candidatesBySize.get(requirement.amount) ?? [];
    let best = null;
    candidates.forEach((candidate) => {
      if (!isCandidateAvailable(state, context, occupiedIndexes, itemByIndex, candidate, requirement)) return;
      const score = scoreCandidate({
        state,
        context,
        candidate,
        requirement,
        settings,
        placedClusters,
        placedIndexes,
        previousLayerIndexes,
        overlap,
        scoreCell,
        random
      });
      if (!Number.isFinite(score)) return;
      if (!best || score < best.score) best = { candidate, score };
    });
    if (!best) {
      if (requirement.amount > 1 && repairIterations < MAX_DISTRIBUTION_REPAIR_ITERATIONS) {
        queue.splice(cursor, 1, ...splitClusterForRetry(requirement));
        repairIterations += 1;
        continue;
      }
      return { ok: false, placedCells, placedClusters, missing: queue.slice(cursor) };
    }
    placedCells.push(...commitCluster({
      context,
      candidate: best.candidate,
      requirement,
      occupiedIndexes,
      itemByIndex,
      placedIndexes,
      placedClusters,
      overlap
    }).map((cell) => ({ ...cell, requirement })));
    cursor += 1;
  }
  return { ok: true, placedCells, placedClusters, missing: [] };
}

export function summarizeSpatialDistribution(context, placedClusters) {
  const totalItems = placedClusters.reduce((sum, cluster) => sum + cluster.amount, 0);
  const occupiedRegions = new Set(placedClusters.map((cluster) => cluster.regionId));
  const occupiedBranches = new Set(placedClusters.map((cluster) => cluster.branchId));
  const availableRegions = [...context.regionStats.values()].filter((region) => region.capacity > 0);
  const availableBranches = [...context.branchStats.values()].filter((branch) => branch.capacity > 0);
  const largestRegionItems = Math.max(0, ...availableRegions.map((region) => region.currentItemCount));
  const averageClusterDistance = placedClusters.length > 1
    ? placedClusters.reduce((sum, cluster, index) => {
      if (index === 0) return sum;
      const previous = placedClusters.slice(0, index);
      return sum + Math.min(...previous.map((entry) => gridDistance(cluster.center, entry.center)));
    }, 0) / (placedClusters.length - 1)
    : 0;
  return {
    clusterCount: placedClusters.length,
    occupiedRegions: occupiedRegions.size,
    availableRegions: availableRegions.length,
    coverageRatio: availableRegions.length ? Number((occupiedRegions.size / availableRegions.length).toFixed(3)) : 0,
    occupiedBranches: occupiedBranches.size,
    availableBranches: availableBranches.length,
    largestRegionShare: totalItems ? Number((largestRegionItems / totalItems).toFixed(3)) : 0,
    averageClusterSize: placedClusters.length ? Number((totalItems / placedClusters.length).toFixed(2)) : 0,
    averageClusterDistance: Number(averageClusterDistance.toFixed(2)),
    repairIterationCap: MAX_DISTRIBUTION_REPAIR_ITERATIONS
  };
}
