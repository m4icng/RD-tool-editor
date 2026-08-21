import { pathConnectionsAt } from "../objects/element-placement-rules.js";
import { indexToPosition } from "../utils/grid-utils.js";

const clampAdaptiveValue = (value, min, max) => Math.max(min, Math.min(max, value));
const roundAdaptiveValue = (value, digits = 0) => Number(value.toFixed(digits));

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function distance(a, b, columns) {
  const pa = indexToPosition(a, columns);
  const pb = indexToPosition(b, columns);
  return Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y);
}

function collectPathTopology(state, source) {
  const pathIndexes = source.pathIndexes ?? [];
  const degrees = pathIndexes.map((index) => pathConnectionsAt(state, index).length);
  const narrowCount = degrees.filter((degree) => degree <= 1).length;
  const corridorCount = degrees.filter((degree) => degree === 2).length;
  const junctionCount = degrees.filter((degree) => degree >= 3).length;
  return {
    pathCellCount: pathIndexes.length,
    deadEndCount: narrowCount,
    corridorCount,
    junctionCount,
    narrowPathRatio: pathIndexes.length ? narrowCount / pathIndexes.length : 0,
    junctionRatio: pathIndexes.length ? junctionCount / pathIndexes.length : 0
  };
}

function collectDemandMetrics(source) {
  const byLayer = new Map();
  const byItem = new Map();
  const trayIds = new Set();
  source.requirements.forEach((entry) => {
    byLayer.set(entry.layerIndex, (byLayer.get(entry.layerIndex) ?? 0) + entry.amount);
    byItem.set(entry.itemId, (byItem.get(entry.itemId) ?? 0) + entry.amount);
    trayIds.add(entry.trayId);
  });
  const layerDemands = [...byLayer.values()];
  const maxLayerDemand = Math.max(0, ...layerDemands);
  const minLayerDemand = Math.min(...layerDemands, maxLayerDemand);
  return {
    totalRequired: source.stats.totalRequired,
    trayCount: trayIds.size,
    demandLayerCount: byLayer.size,
    itemColorCount: byItem.size,
    maxLayerDemand,
    averageLayerDemand: average(layerDemands),
    layerImbalance: maxLayerDemand ? (maxLayerDemand - minLayerDemand) / maxLayerDemand : 0,
    colorDiversityRatio: clampAdaptiveValue(byItem.size / 7, 0, 1)
  };
}

function collectReleaseOpportunityMetrics(state, source) {
  const columns = state.grid.columns;
  const distances = [];
  source.requirements.forEach((requirement) => {
    const cells = source.validByLayer.get(requirement.layerIndex) ?? [];
    cells.forEach((index) => distances.push(distance(index, requirement.deliverIndex, columns)));
  });
  const deliverIndexes = new Set(source.requirements.map((entry) => entry.deliverIndex));
  return {
    deliverPointCount: deliverIndexes.size,
    releaseCycleCount: Math.max(1, deliverIndexes.size + (source.stats.priorityPoints ?? 0)),
    averageReleaseDistance: average(distances),
    maxReleaseDistance: Math.max(0, ...distances),
    firstTraySafety: distances.length ? Math.min(...distances) : 0
  };
}

function noiseProfileForDifficulty({ difficultyScore, demandLayerCount, tuning }) {
  const futureDepth = Math.max(1, demandLayerCount - 1);
  const relief = Math.max(tuning.releaseRelief, tuning.tailRelief);
  const desiredMax = difficultyScore >= 0.72
    ? 3
    : difficultyScore >= 0.48
      ? 2
      : 1;
  const maxDistance = clampAdaptiveValue(desiredMax - Math.min(1, Math.floor(relief / 2)), 1, Math.min(3, futureDepth));
  const deepPenalty = relief * 0.08;
  const weightsByDistance = {
    1: maxDistance >= 1 ? clampAdaptiveValue(0.9 - difficultyScore * 0.35 + relief * 0.05, 0.45, 1) : 0,
    2: maxDistance >= 2 ? clampAdaptiveValue(0.18 + difficultyScore * 0.25 - deepPenalty, 0.05, 0.4) : 0,
    3: maxDistance >= 3 ? clampAdaptiveValue(0.06 + difficultyScore * 0.18 - deepPenalty, 0.03, 0.24) : 0
  };
  const totalWeight = Object.values(weightsByDistance).reduce((sum, value) => sum + value, 0) || 1;
  Object.keys(weightsByDistance).forEach((distance) => {
    weightsByDistance[distance] = roundAdaptiveValue(weightsByDistance[distance] / totalWeight, 3);
  });
  return {
    minDistance: 1,
    maxDistance,
    weightsByDistance,
    maxPreloadRatioByDistance: {
      1: 1,
      2: roundAdaptiveValue(clampAdaptiveValue(0.72 - difficultyScore * 0.14 - relief * 0.04, 0.38, 0.76), 3),
      3: roundAdaptiveValue(clampAdaptiveValue(0.48 - difficultyScore * 0.1 - relief * 0.05, 0.22, 0.54), 3)
    }
  };
}

export function analyzeAdaptiveLevel(state, source) {
  const topology = collectPathTopology(state, source);
  const demand = collectDemandMetrics(source);
  const release = collectReleaseOpportunityMetrics(state, source);
  const branchCounts = [...(source.validByLayer?.values?.() ?? [])].map((cells) => cells.length);
  const averageLayerCapacity = average(branchCounts);
  const density = source.stats.itemDensity ?? 0;
  const topologyPressure = clampAdaptiveValue(
    topology.narrowPathRatio * 0.35
      + topology.junctionRatio * 0.25
      + density * 0.3
      + demand.layerImbalance * 0.1,
    0,
    1
  );
  return {
    topology,
    demand,
    release,
    capacity: {
      averageLayerCapacity,
      totalValidSlots: source.stats.totalValidSlots,
      itemDensity: density
    },
    topologyPressure
  };
}

export function createTuningState() {
  return {
    iteration: 0,
    repairIntensity: 0,
    tailRelief: 0,
    releaseRelief: 0,
    spawnRelief: 0,
    quotaRelief: 0
  };
}

export function updateTuningState(tuning, result) {
  const next = { ...tuning, iteration: tuning.iteration + 1 };
  (result?.issues ?? []).forEach((issue) => {
    if (issue.code === "TAIL_PRESSURE_EXCEEDED") next.tailRelief += 1;
    else if (issue.code === "RELEASE_PRESSURE_EXCEEDED") next.releaseRelief += 1;
    else if (issue.code === "NEXT_LAYER_SPAWN_TRAP") next.spawnRelief += 1;
    else if (issue.code?.includes("QUOTA")) next.quotaRelief += 1;
  });
  next.repairIntensity = clampAdaptiveValue(next.tailRelief + next.releaseRelief + next.spawnRelief + next.quotaRelief, 0, 12);
  return next;
}

export function estimateDerivedGenerateParameters(source, analysis, intent, tuning = createTuningState()) {
  const intentScore = Number(intent.difficultyScore);
  const difficultyScore = clampAdaptiveValue(Number.isFinite(intentScore) ? intentScore : 0.45, 0, 1);
  const density = clampAdaptiveValue(analysis.capacity.itemDensity, 0, 1.5);
  const demandScale = clampAdaptiveValue(Math.sqrt(Math.max(0, analysis.demand.totalRequired)) / 12, 0, 2);
  const topologyPressure = analysis.topologyPressure;
  const releaseDistance = analysis.release.averageReleaseDistance || Math.max(3, source.pathIndexes.length / 4);
  const repair = tuning.repairIntensity * 0.025;

  const targetAverageTail = clampAdaptiveValue(Math.round(2 + difficultyScore * 4.5 + density * 3 + topologyPressure * 2 - tuning.tailRelief * 0.45), 2, 18);
  const targetPeakTail = clampAdaptiveValue(Math.round(targetAverageTail + 2 + difficultyScore * 3 + demandScale + density * 2 - tuning.tailRelief * 0.25), targetAverageTail + 1, 32);
  const safeTailLimit = clampAdaptiveValue(Math.round(targetPeakTail + 2 + topologyPressure * 4 + demandScale), targetPeakTail + 1, 60);
  const noiseRatio = clampAdaptiveValue(0.24 + difficultyScore * 0.34 + density * 0.1 + analysis.demand.colorDiversityRatio * 0.08 - tuning.releaseRelief * 0.02, 0.18, 0.68);
  const requiredColorRatio = clampAdaptiveValue(1 - noiseRatio, 0.32, 0.82);
  const clusterMin = 1;
  const clusterMax = clampAdaptiveValue(Math.round(2 + difficultyScore * 6 + demandScale * 1.4 - tuning.quotaRelief * 0.25), clusterMin, 20);
  const clusterAdjacencyRatio = clampAdaptiveValue(0.96 - difficultyScore * 0.16 + density * 0.04 + tuning.releaseRelief * 0.025, 0.72, 0.96);
  const highPressureRatio = clampAdaptiveValue(0.16 + difficultyScore * 0.28 + density * 0.14 + topologyPressure * 0.1 - tuning.releaseRelief * 0.02, 0.1, 0.58);
  const releaseDelayTarget = clampAdaptiveValue(Math.round(releaseDistance * (0.18 + difficultyScore * 0.18) + 2 + topologyPressure * 3 - tuning.releaseRelief), 2, 80);
  const maxUnreleasedItems = clampAdaptiveValue(Math.round(targetPeakTail + clusterMax * 0.5 + highPressureRatio * 5), 3, 80);
  const spawnSafetyDistance = clampAdaptiveValue(Math.round(8 - difficultyScore * 4 + density * 2 + topologyPressure * 3), 1, 30);
  const branchDistribution = clampAdaptiveValue(0.96 - difficultyScore * 0.28 + Math.min(0.08, analysis.topology.junctionRatio) - repair, 0.55, 0.98);
  const releaseCycleCount = analysis.release.releaseCycleCount;
  const reliefDuration = clampAdaptiveValue(Math.round(2 + (1 - difficultyScore) * 3 + tuning.releaseRelief), 1, 10);
  const continuousGrowthTarget = clampAdaptiveValue(Math.round(targetAverageTail + difficultyScore * 3 + density * 2 - tuning.tailRelief * 0.4), 2, 18);
  const releaseAmountTarget = clampAdaptiveValue(Math.round(clusterMax * requiredColorRatio + reliefDuration * 0.35), 1, 9);
  const noiseProfile = noiseProfileForDifficulty({ difficultyScore, demandLayerCount: analysis.demand.demandLayerCount, tuning });
  const layerDensity = source.validByLayer
    ? [...source.validByLayer.entries()].map(([layerIndex, cells]) => ({
      layerIndex,
      density: roundAdaptiveValue((source.requirements.filter((entry) => entry.layerIndex === layerIndex).reduce((sum, entry) => sum + entry.amount, 0)) / Math.max(1, cells.length), 3)
    }))
    : [];

  const engineSettings = {
    avgTailLengthTarget: targetAverageTail,
    tailLengthCap: safeTailLimit,
    tailLengthGrowthCurve: difficultyScore >= 0.8 ? "peak-late" : difficultyScore >= 0.58 ? "sawtooth" : difficultyScore <= 0.3 ? "flat" : "linear",
    tailLengthVariance: clampAdaptiveValue(Math.round(1 + difficultyScore * 3 + topologyPressure * 2 - tuning.tailRelief * 0.35), 1, 12),
    releaseDelayTarget,
    unreleasedInventoryTarget: highPressureRatio,
    maxUnreleasedItems,
    releaseDistanceWeight: clampAdaptiveValue(0.24 + difficultyScore * 0.38 + topologyPressure * 0.14 - tuning.releaseRelief * 0.025, 0.15, 0.9),
    layerDistributionBalance: clampAdaptiveValue(0.96 - difficultyScore * 0.18 - analysis.demand.layerImbalance * 0.08, 0.62, 0.98),
    spawnSafetyDistance,
    maxImmediateChainCount: clampAdaptiveValue(Math.round(1 + difficultyScore * 3 - tuning.spawnRelief * 0.2), 1, 12),
    nextLayerTrapPressure: clampAdaptiveValue(0.08 + difficultyScore * 0.46 - tuning.spawnRelief * 0.06, 0.02, 0.7),
    clusterRatio: clusterAdjacencyRatio,
    minClusterSizePerBranch: clusterMin,
    maxClusterSizePerBranch: clusterMax,
    noiseMinDistance: noiseProfile.minDistance,
    noiseMaxDistance: noiseProfile.maxDistance,
    noiseDistanceWeight1: noiseProfile.weightsByDistance[1] ?? 0,
    noiseDistanceWeight2: noiseProfile.weightsByDistance[2] ?? 0,
    noiseDistanceWeight3: noiseProfile.weightsByDistance[3] ?? 0,
    branchDistributionBalance: branchDistribution,
    routeChoicePressure: clampAdaptiveValue(0.12 + difficultyScore * 0.68 + analysis.topology.junctionRatio * 0.3, 0.08, 0.92),
    narrowPathUsage: clampAdaptiveValue(0.08 + difficultyScore * 0.48 + analysis.topology.narrowPathRatio * 0.25 - tuning.tailRelief * 0.02, 0.04, 0.85),
    loopRiskPressure: clampAdaptiveValue(0.07 + difficultyScore * 0.5 + analysis.topology.narrowPathRatio * 0.22 - tuning.tailRelief * 0.02, 0.04, 0.85)
  };

  const derivedParameters = {
    difficultyScore,
    targetAverageTail,
    targetPeakTail,
    safeTailLimit,
    noiseRatio: roundAdaptiveValue(noiseRatio, 3),
    requiredColorRatio: roundAdaptiveValue(requiredColorRatio, 3),
    carryOverRatio: roundAdaptiveValue(clampAdaptiveValue(noiseRatio * 0.9 + difficultyScore * 0.08, 0.18, 0.72), 3),
    noiseProfile,
    maxPreloadRatioByDistance: noiseProfile.maxPreloadRatioByDistance,
    clusterSizeDistribution: { min: clusterMin, preferred: clampAdaptiveValue(Math.round((clusterMin + clusterMax) / 2), clusterMin, clusterMax), max: clusterMax },
    clusterAdjacencyRatio: roundAdaptiveValue(clusterAdjacencyRatio, 3),
    highPressureRatio: roundAdaptiveValue(highPressureRatio, 3),
    continuousGrowthTarget,
    releaseAmountTarget,
    releaseCycleCount,
    reliefDuration,
    layerDensity,
    branchDistribution: roundAdaptiveValue(branchDistribution, 3),
    firstTraySafety: Math.round(analysis.release.firstTraySafety),
    repairIntensity: roundAdaptiveValue(tuning.repairIntensity, 2),
    searchDepth: clampAdaptiveValue(Math.round(8 + difficultyScore * 8 + demandScale * 2 + tuning.repairIntensity), 8, 40),
    beamWidth: clampAdaptiveValue(Math.round(6 + difficultyScore * 10 + topologyPressure * 8 + tuning.repairIntensity), 6, 48)
  };

  return {
    settings: engineSettings,
    derivedParameters,
    analysis,
    tuning
  };
}
