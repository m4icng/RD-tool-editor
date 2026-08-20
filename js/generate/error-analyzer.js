const ERROR_GROUP_PRIORITY = Object.freeze({
  HARD_SOURCE_ERROR: 1,
  SOLVABILITY_ERROR: 2,
  CAPACITY_ERROR: 3,
  TRAY_BALANCE_ERROR: 4,
  DIFFICULTY_ERROR: 5,
  LAYER_DISTRIBUTION_ERROR: 6,
  DISTRIBUTION_ERROR: 7,
  GENERATION_SEARCH_ERROR: 8,
  VISUAL_CLUSTER_QUALITY_ERROR: 9
});

const ERROR_CODE_GROUPS = Object.freeze({
  SOURCE_INVALID: "HARD_SOURCE_ERROR",
  TRAY_INVALID: "HARD_SOURCE_ERROR",
  LOCKED_ITEM_QUOTA_EXCEEDED: "HARD_SOURCE_ERROR",
  LOCKED_ITEM_INVALID_POSITION: "HARD_SOURCE_ERROR",
  ALL_ITEM_LAYERS_LOCKED: "HARD_SOURCE_ERROR",
  SOLVABILITY_FAILED: "SOLVABILITY_ERROR",
  DEADLOCK_DETECTED: "SOLVABILITY_ERROR",
  NOT_ENOUGH_VALID_CELLS: "CAPACITY_ERROR",
  ITEM_QUOTA_MISMATCH: "CAPACITY_ERROR",
  ITEM_ID_QUOTA_MISMATCH: "CAPACITY_ERROR",
  LAYER_QUOTA_MISMATCH: "LAYER_DISTRIBUTION_ERROR",
  LAYER_IMBALANCE: "LAYER_DISTRIBUTION_ERROR",
  TRAY_LAYER_TIMING_ERROR: "TRAY_BALANCE_ERROR",
  TAIL_PRESSURE_EXCEEDED: "DIFFICULTY_ERROR",
  TAIL_PRESSURE_TOO_HIGH: "DIFFICULTY_ERROR",
  TAIL_PRESSURE_TOO_LOW: "DIFFICULTY_ERROR",
  RELEASE_PRESSURE_EXCEEDED: "DIFFICULTY_ERROR",
  NEXT_LAYER_SPAWN_TRAP: "DIFFICULTY_ERROR",
  ITEM_DISTRIBUTION_REPAIR_FAILED: "DISTRIBUTION_ERROR",
  BRANCH_DISTRIBUTION_FAILED: "DISTRIBUTION_ERROR",
  CLUSTER_PLACEMENT_ERROR: "DISTRIBUTION_ERROR",
  GENERATION_SEARCH_EXHAUSTED: "GENERATION_SEARCH_ERROR"
});

export function classifyGeneratorIssue(issue) {
  const group = ERROR_CODE_GROUPS[issue?.code] ?? "GENERATION_SEARCH_ERROR";
  return {
    ...issue,
    errorGroup: group,
    priority: ERROR_GROUP_PRIORITY[group] ?? ERROR_GROUP_PRIORITY.GENERATION_SEARCH_ERROR
  };
}

export function classifyGeneratorIssues(issues = []) {
  return issues
    .map((issue) => classifyGeneratorIssue(issue))
    .sort((a, b) => a.priority - b.priority);
}

export function highestPriorityIssue(issues = []) {
  return classifyGeneratorIssues(issues)[0] ?? null;
}

export function isHardSourceIssue(issue) {
  return classifyGeneratorIssue(issue).errorGroup === "HARD_SOURCE_ERROR";
}

export function scoreGeneratorCandidate(result) {
  if (!result?.generatedItems?.length && !result?.preview) return Number.NEGATIVE_INFINITY;
  const issues = classifyGeneratorIssues(result.issues ?? []);
  if (issues.some((issue) => issue.errorGroup === "HARD_SOURCE_ERROR" || issue.errorGroup === "SOLVABILITY_ERROR")) {
    return Number.NEGATIVE_INFINITY;
  }
  const meta = result.meta ?? {};
  const totalRequired = Number(meta.totalRequired ?? result.source?.stats?.totalRequired ?? 0);
  const totalGenerated = Number(meta.totalGenerated ?? result.generatedItems?.length ?? 0);
  const quotaScore = totalRequired > 0 ? Math.min(totalGenerated / totalRequired, 1) * 420 : 0;
  const issuePenalty = issues.reduce((sum, issue) => sum + issue.priority * 34, 0);
  const missingPenalty = Number(meta.missing ?? Math.max(0, totalRequired - totalGenerated)) * 18;
  const tailPenalty = Math.max(0, Number(meta.peakTailLength ?? 0) - Number(meta.derivedParameters?.safeTailLimit ?? 0)) * 12;
  const releasePenalty = Math.max(0, Number(meta.maxUnreleasedItems ?? 0) - Number(meta.settings?.maxUnreleasedItems ?? 0)) * 10;
  const distributionScore = Number(meta.spatialDistributionScore ?? 0) * 80;
  const clusterQuality = Number(meta.actualClusterRatio ?? 0) * 35;
  return quotaScore + distributionScore + clusterQuality - issuePenalty - missingPenalty - tailPenalty - releasePenalty;
}

export function explainAutoRepair(issue) {
  const classified = classifyGeneratorIssue(issue);
  const messages = {
    HARD_SOURCE_ERROR: "Không tự sửa dữ liệu nguồn hoặc layer đang khóa.",
    SOLVABILITY_ERROR: "Ưu tiên giữ solvability, không đổi Tray hay Locked Layer.",
    CAPACITY_ERROR: "Giảm spacing, tăng cụm hợp lệ và phân lại tải layer Auto.",
    TRAY_BALANCE_ERROR: "Dời màu cần sớm hơn và reserve demand tương lai.",
    DIFFICULTY_ERROR: "Giảm áp lực tail/release bằng cách giảm noise và dời cụm required.",
    LAYER_DISTRIBUTION_ERROR: "Phân phối lại item giữa các Auto Layer theo capacity.",
    DISTRIBUTION_ERROR: "Sửa cục bộ region/branch/candidate trước khi sinh lại layer.",
    GENERATION_SEARCH_ERROR: "Thử candidate giới hạn với profile mới.",
    VISUAL_CLUSTER_QUALITY_ERROR: "Tách cụm và cải thiện khoảng cách cụm."
  };
  return messages[classified.errorGroup] ?? messages.GENERATION_SEARCH_ERROR;
}
