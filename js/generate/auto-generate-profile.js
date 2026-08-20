import { branchCellsForIndexes } from "./generate-source.js";
import { indexToPosition } from "../utils/grid-utils.js";

const profileClamp = (value, min, max) => Math.max(min, Math.min(max, value));
const profileRound = (value, digits = 0) => Number((Number(value) || 0).toFixed(digits));

function profileAverage(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function uniqueValidCells(source) {
  return [...new Set([...(source.validByLayer?.values?.() ?? [])].flat())].sort((a, b) => a - b);
}

function collectColorDemand(requirements) {
  const colorDemand = {};
  requirements.forEach((entry) => {
    colorDemand[String(entry.itemId)] = (colorDemand[String(entry.itemId)] ?? 0) + entry.amount;
  });
  return colorDemand;
}

function trayLayerStats(requirements) {
  const trayLayers = new Set();
  const trayIds = new Set();
  const colorSwitchesByTray = new Map();
  requirements.forEach((entry) => {
    trayLayers.add(`${entry.trayId}:${entry.layerIndex}`);
    trayIds.add(entry.trayId);
    const list = colorSwitchesByTray.get(entry.trayId) ?? [];
    list.push({ layerIndex: entry.layerIndex, itemId: entry.itemId });
    colorSwitchesByTray.set(entry.trayId, list);
  });
  let switches = 0;
  colorSwitchesByTray.forEach((entries) => {
    const ordered = entries.slice().sort((a, b) => a.layerIndex - b.layerIndex || a.itemId - b.itemId);
    for (let i = 1; i < ordered.length; i += 1) {
      if (ordered[i].itemId !== ordered[i - 1].itemId) switches += 1;
    }
  });
  return {
    trayCount: trayIds.size,
    trayLayerCount: trayLayers.size,
    colorSwitches: switches
  };
}
function layerCapacityRows(source) {
  return (source.autoLayerIndexes ?? []).map((layerIndex) => {
    const capacity = source.validByLayer?.get(layerIndex)?.length ?? 0;
    return { layerIndex, capacity };
  });
}

function targetLayerLoad(source) {
  const rows = layerCapacityRows(source);
  const totalCapacity = rows.reduce((sum, row) => sum + row.capacity, 0);
  let assigned = 0;
  const targets = rows.map((row, index) => {
    if (totalCapacity <= 0) return { ...row, targetLoad: 0 };
    const isLast = index === rows.length - 1;
    const targetLoad = isLast
      ? Math.max(0, source.stats.totalRequired - assigned)
      : Math.min(row.capacity, Math.round(source.stats.totalRequired * row.capacity / totalCapacity));
    assigned += targetLoad;
    return { ...row, targetLoad };
  });
  return targets;
}

function releaseWindows(state, source) {
  const columns = state.grid.columns;
  const effectiveCells = uniqueValidCells(source);
  const grouped = new Map();
  source.requirements.forEach((entry) => {
    const group = grouped.get(entry.deliverIndex) ?? { deliverIndex: entry.deliverIndex, demand: 0, itemIds: new Set() };
    group.demand += entry.amount;
    group.itemIds.add(entry.itemId);
    grouped.set(entry.deliverIndex, group);
  });
  return [...grouped.values()].map((group) => {
    const deliverPosition = indexToPosition(group.deliverIndex, columns);
    const distances = effectiveCells.map((index) => {
      const position = indexToPosition(index, columns);
      return Math.abs(position.x - deliverPosition.x) + Math.abs(position.y - deliverPosition.y);
    });
    const routeLength = profileRound(profileAverage(distances), 1);
    const candidateItemCount = effectiveCells.length;
    const possibleRelease = Math.min(group.demand, Math.max(1, group.itemIds.size * 9));
    const tailRisk = profileRound(profileClamp(routeLength / Math.max(1, effectiveCells.length) + group.demand / Math.max(1, candidateItemCount), 0, 1), 3);
    return {
      deliverIndex: group.deliverIndex,
      routeLength,
      candidateItemCount,
      expectedCollect: Math.min(group.demand, candidateItemCount),
      possibleRelease,
      tailRisk
    };
  });
}

function demandComplexity(source, trayStats, colorDemand) {
  const colorCount = Object.keys(colorDemand).length;
  const itemLayerCount = Math.max(1, source.stats.editorLayers ?? source.stats.layers ?? 1);
  const trayLayerRatio = trayStats.trayLayerCount / itemLayerCount;
  return profileRound(profileClamp(
    colorCount / 7 * 0.28
      + trayStats.trayCount / Math.max(1, itemLayerCount) * 0.18
      + trayLayerRatio / 5 * 0.32
      + trayStats.colorSwitches / Math.max(1, trayStats.trayLayerCount) * 0.22,
    0,
    1
  ), 3);
}

function topologyTailCapacity(state, analysis, source) {
  const pathCount = Math.max(1, source.pathIndexes?.length ?? 0);
  const branchCount = branchCellsForIndexes(state, source.pathIndexes ?? []).length;
  const junctionBonus = (analysis.topology?.junctionCount ?? 0) * 0.65;
  const corridorBonus = Math.sqrt(Math.max(0, analysis.topology?.corridorCount ?? 0)) * 1.4;
  const narrowPenalty = (analysis.topology?.deadEndCount ?? 0) * 0.2;
  const branchBonus = Math.sqrt(Math.max(1, branchCount)) * 0.8;
  return profileClamp(Math.round(3 + Math.sqrt(pathCount) * 0.55 + junctionBonus + corridorBonus + branchBonus - narrowPenalty), 3, 60);
}

export function buildAutoGenerateProfile(state, source, analysis, derivedParameters = {}, tuning = {}) {
  const effectiveCells = uniqueValidCells(source);
  const trayStats = trayLayerStats(source.rawRequirements ?? source.requirements ?? []);
  const remainingColorDemand = collectColorDemand(source.requirements ?? []);
  const totalColorDemand = collectColorDemand(source.rawRequirements ?? source.requirements ?? []);
  const autoLayerCount = source.stats.autoLayers ?? source.autoLayerIndexes?.length ?? 0;
  const totalAvailableAutoLayerCells = source.stats.totalValidSlots ?? 0;
  const practicalLayerCapacity = Math.floor(totalAvailableAutoLayerCells * (source.stats.itemDensity > 0.72 ? 0.92 : 0.82));
  const requiredDensity = totalAvailableAutoLayerCells > 0 ? source.stats.totalRequired / totalAvailableAutoLayerCells : 0;
  const branches = effectiveCells.length ? branchCellsForIndexes(state, effectiveCells) : [];
  const complexity = demandComplexity(source, trayStats, totalColorDemand);
  const safeTail = Math.max(Number(derivedParameters.safeTailLimit) || 0, topologyTailCapacity(state, analysis, source));
  const release = releaseWindows(state, source);
  return {
    map: {
      pathCells: source.pathIndexes?.length ?? 0,
      effectiveCapacity: effectiveCells.length,
      restrictedCells: Math.max(0, (source.pathIndexes?.length ?? 0) - effectiveCells.length),
      totalAvailableAutoLayerCells,
      practicalLayerCapacity,
      requiredDensity: profileRound(requiredDensity, 3),
      densityClass: requiredDensity < 0.28 ? "Low" : requiredDensity < 0.64 ? "Medium" : "High",
      branchCount: branches.length,
      usableRegions: analysis.regionLayout?.usableRegionCount ?? null
    },
    layer: {
      totalLayers: source.stats.editorLayers ?? 0,
      lockedLayers: source.stats.lockedLayers ?? 0,
      autoLayers: autoLayerCount,
      targetLoad: targetLayerLoad(source)
    },
    tray: {
      trayCount: trayStats.trayCount,
      trayLayerCount: trayStats.trayLayerCount,
      trayLayerPerItemLayerRatio: profileRound(trayStats.trayLayerCount / Math.max(1, source.stats.editorLayers ?? 1), 2),
      totalColorDemand,
      remainingColorDemand,
      demandComplexity: complexity
    },
    cluster: {
      adaptiveMinSize: derivedParameters.clusterSizeDistribution?.min ?? null,
      adaptivePreferredSize: derivedParameters.clusterSizeDistribution?.preferred ?? null,
      adaptiveMaxSize: derivedParameters.clusterSizeDistribution?.max ?? null,
      expectedClusterCount: Math.ceil((source.stats.totalRequired ?? 0) / Math.max(1, derivedParameters.clusterSizeDistribution?.preferred ?? 3))
    },
    difficulty: {
      safeTail,
      targetAverageTail: derivedParameters.targetAverageTail ?? null,
      targetPeakTail: derivedParameters.targetPeakTail ?? null,
      noiseBudget: derivedParameters.noiseRatio ?? null,
      releaseTargets: release,
      demandComplexity: complexity
    },
    repair: {
      currentAttempt: Number(tuning.iteration ?? 0) + 1,
      repairIntensity: Number(tuning.repairIntensity ?? 0),
      activeErrorGroup: tuning.activeErrorGroup ?? null
    }
  };
}
