import { explainAutoRepair, highestPriorityIssue, isHardSourceIssue } from "./error-analyzer.js";

const DEFAULT_GROUP_BUDGETS = Object.freeze({
  CAPACITY_ERROR: 8,
  DISTRIBUTION_ERROR: 10,
  DIFFICULTY_ERROR: 10,
  LAYER_DISTRIBUTION_ERROR: 6,
  TRAY_BALANCE_ERROR: 6,
  GENERATION_SEARCH_ERROR: 5,
  VISUAL_CLUSTER_QUALITY_ERROR: 4,
  SOLVABILITY_ERROR: 0,
  HARD_SOURCE_ERROR: 0
});

function levelScale(profile) {
  const cells = Number(profile?.map?.effectiveCapacity ?? 0);
  if (cells < 60) return 0.75;
  if (cells > 160) return 1.25;
  return 1;
}

export function createRebalanceState(profile, maxRetries) {
  const scale = levelScale(profile);
  const hardMax = Math.max(1, Math.min(Number(maxRetries) || 1, Math.round(36 * scale)));
  return {
    iteration: 0,
    hardMax,
    budgets: Object.fromEntries(Object.entries(DEFAULT_GROUP_BUDGETS).map(([group, budget]) => [group, Math.max(0, Math.round(budget * scale))])),
    repairIntensity: 0,
    capacityRelief: 0,
    distributionRelief: 0,
    tailRelief: 0,
    releaseRelief: 0,
    spawnRelief: 0,
    quotaRelief: 0,
    layerRelief: 0,
    trayTimingRelief: 0,
    searchRelief: 0,
    activeErrorGroup: null,
    lastRepairAction: null,
    repairHistory: []
  };
}

function applyGroupFeedback(next, issue) {
  const code = issue?.code;
  const group = issue?.errorGroup;
  if (group === "CAPACITY_ERROR") {
    next.capacityRelief += 1;
    next.quotaRelief += 1;
  } else if (group === "DISTRIBUTION_ERROR") {
    next.distributionRelief += 1;
  } else if (group === "DIFFICULTY_ERROR") {
    if (code === "TAIL_PRESSURE_EXCEEDED" || code === "TAIL_PRESSURE_TOO_HIGH") next.tailRelief += 1;
    if (code === "TAIL_PRESSURE_TOO_LOW") next.tailRelief = Math.max(0, next.tailRelief - 0.5);
    if (code === "RELEASE_PRESSURE_EXCEEDED") next.releaseRelief += 1;
    if (code === "NEXT_LAYER_SPAWN_TRAP") next.spawnRelief += 1;
  } else if (group === "LAYER_DISTRIBUTION_ERROR") {
    next.layerRelief += 1;
  } else if (group === "TRAY_BALANCE_ERROR") {
    next.trayTimingRelief += 1;
    next.releaseRelief += 0.5;
  } else if (group === "GENERATION_SEARCH_ERROR") {
    next.searchRelief += 1;
  }
}

export function rebalanceAfterFailure(rebalance, result) {
  const issue = highestPriorityIssue(result?.issues ?? []);
  if (!issue || isHardSourceIssue(issue)) {
    return { canContinue: false, rebalance, issue, action: null };
  }
  const next = structuredClone(rebalance);
  const group = issue.errorGroup;
  const remainingBudget = Number(next.budgets[group] ?? 0);
  if (next.iteration >= next.hardMax || remainingBudget <= 0) {
    return { canContinue: false, rebalance: next, issue, action: null };
  }
  next.iteration += 1;
  next.budgets[group] = remainingBudget - 1;
  next.activeErrorGroup = group;
  next.lastRepairAction = explainAutoRepair(issue);
  applyGroupFeedback(next, issue);
  next.repairIntensity = Math.min(18, next.capacityRelief + next.distributionRelief + next.tailRelief + next.releaseRelief + next.spawnRelief + next.layerRelief + next.trayTimingRelief + next.searchRelief);
  next.repairHistory.push({
    attempt: next.iteration,
    code: issue.code,
    errorGroup: group,
    action: next.lastRepairAction
  });
  return { canContinue: true, rebalance: next, issue, action: next.lastRepairAction };
}

export function autoRepairStatusRows(rebalance) {
  return (rebalance?.repairHistory ?? []).map((entry) => ({
    code: entry.code,
    errorGroup: entry.errorGroup,
    action: entry.action,
    status: "Auto balanced"
  }));
}
