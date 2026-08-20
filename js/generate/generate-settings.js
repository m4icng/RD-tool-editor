export const GENERATOR_VERSION = "1.1.0";

export const GENERATE_PRESETS = Object.freeze({
  De: {
    clusterRatio: 0.9,
    maxClusterSizePerBranch: 4,
    branchDistributionBalance: 0.9,
    routeChoicePressure: 0.18,
    narrowPathUsage: 0.18,
    loopRiskPressure: 0.15,
    layerDistributionBalance: 0.92,
    spawnSafetyDistance: 6,
    maxImmediateChainCount: 1,
    nextLayerTrapPressure: 0.1,
    avgTailLengthTarget: 5,
    tailLengthCap: 9,
    tailLengthGrowthCurve: "linear",
    tailLengthVariance: 1,
    releaseDelayTarget: 5,
    unreleasedInventoryTarget: 0.22,
    maxUnreleasedItems: 7,
    releaseDistanceWeight: 0.35
  },
  Thuong: {
    clusterRatio: 0.8,
    maxClusterSizePerBranch: 6,
    branchDistributionBalance: 0.75,
    routeChoicePressure: 0.45,
    narrowPathUsage: 0.32,
    loopRiskPressure: 0.3,
    layerDistributionBalance: 0.8,
    spawnSafetyDistance: 4,
    maxImmediateChainCount: 2,
    nextLayerTrapPressure: 0.32,
    avgTailLengthTarget: 8,
    tailLengthCap: 14,
    tailLengthGrowthCurve: "linear",
    tailLengthVariance: 2,
    releaseDelayTarget: 9,
    unreleasedInventoryTarget: 0.42,
    maxUnreleasedItems: 12,
    releaseDistanceWeight: 0.55
  },
  Kho: {
    clusterRatio: 0.68,
    maxClusterSizePerBranch: 6,
    branchDistributionBalance: 0.58,
    routeChoicePressure: 0.68,
    narrowPathUsage: 0.58,
    loopRiskPressure: 0.56,
    layerDistributionBalance: 0.68,
    spawnSafetyDistance: 3,
    maxImmediateChainCount: 3,
    nextLayerTrapPressure: 0.58,
    avgTailLengthTarget: 11,
    tailLengthCap: 18,
    tailLengthGrowthCurve: "ramp",
    tailLengthVariance: 3,
    releaseDelayTarget: 14,
    unreleasedInventoryTarget: 0.58,
    maxUnreleasedItems: 17,
    releaseDistanceWeight: 0.72
  },
  ChuyenGia: {
    clusterRatio: 0.55,
    maxClusterSizePerBranch: 6,
    branchDistributionBalance: 0.45,
    routeChoicePressure: 0.86,
    narrowPathUsage: 0.78,
    loopRiskPressure: 0.78,
    layerDistributionBalance: 0.56,
    spawnSafetyDistance: 2,
    maxImmediateChainCount: 4,
    nextLayerTrapPressure: 0.8,
    avgTailLengthTarget: 14,
    tailLengthCap: 22,
    tailLengthGrowthCurve: "peak-late",
    tailLengthVariance: 4,
    releaseDelayTarget: 18,
    unreleasedInventoryTarget: 0.72,
    maxUnreleasedItems: 22,
    releaseDistanceWeight: 0.9
  }
});

export const PRESET_LABELS = Object.freeze({
  De: "Dễ",
  Thuong: "Thường",
  Kho: "Khó",
  ChuyenGia: "Chuyên gia"
});

export const MULTI_BRANCH_MODE_LABELS = Object.freeze({
  balanced: "Cân bằng",
  spread: "Rải đều",
  clustered: "Gom nhánh"
});

export const TAIL_CURVE_LABELS = Object.freeze({
  linear: "Tuyến tính",
  flat: "Phẳng",
  ramp: "Tăng dần",
  "peak-late": "Khó cuối màn"
});

export const GENERATE_SETTING_FIELDS = Object.freeze([
  { key: "avgTailLengthTarget", label: "Đuôi TB mục tiêu", type: "number", min: 1, max: 40, step: 1, group: "Áp lực đuôi", tip: "Độ dài đuôi tàu trung bình mà bộ sinh cố gắng hướng tới." },
  { key: "tailLengthCap", label: "Giới hạn đuôi", type: "number", min: 1, max: 60, step: 1, group: "Áp lực đuôi", tip: "Nếu ước tính đuôi vượt ngưỡng này, bộ sinh sẽ báo lỗi." },
  { key: "tailLengthVariance", label: "Dao động đuôi", type: "number", min: 0, max: 12, step: 1, group: "Áp lực đuôi", tip: "Mức dao động độ dài đuôi giữa các đoạn khó/dễ." },
  { key: "releaseDelayTarget", label: "Độ trễ xả", type: "number", min: 1, max: 80, step: 1, group: "Áp lực xả", tip: "Khoảng cách đường đi mục tiêu từ lúc ăn vật phẩm tới khay phù hợp." },
  { key: "unreleasedInventoryTarget", label: "Tồn kho mục tiêu", type: "percent", min: 0, max: 1, step: 0.01, group: "Áp lực xả", tip: "Tỷ lệ vật phẩm dự kiến chưa xả được tại các đoạn áp lực." },
  { key: "maxUnreleasedItems", label: "Tồn kho tối đa", type: "number", min: 1, max: 80, step: 1, group: "Áp lực xả", tip: "Số vật phẩm chưa xả tối đa cho phép theo mô phỏng nhanh." },
  { key: "releaseDistanceWeight", label: "Trọng số xả", type: "percent", min: 0, max: 1, step: 0.01, group: "Áp lực xả", tip: "Mức ưu tiên khoảng cách vật phẩm tới khay phù hợp khi chọn vị trí." },
  { key: "layerDistributionBalance", label: "Cân bằng lớp", type: "percent", min: 0, max: 1, step: 0.01, group: "Lớp và xuất hiện", tip: "Ưu tiên mềm để giữ phân bổ giữa các lớp theo đúng khay nguồn." },
  { key: "spawnSafetyDistance", label: "Khoảng cách xuất hiện an toàn", type: "number", min: 0, max: 30, step: 1, group: "Lớp và xuất hiện", tip: "Khoảng cách tối thiểu từ điểm bắt đầu tới vật phẩm lớp mới để tránh bẫy xuất hiện." },
  { key: "maxImmediateChainCount", label: "Chuỗi gần đầu tối đa", type: "number", min: 0, max: 12, step: 1, group: "Lớp và xuất hiện", tip: "Số vật phẩm lớp mới liên tiếp được phép xuất hiện quá gần đầu tàu." },
  { key: "nextLayerTrapPressure", label: "Áp lực bẫy lớp", type: "percent", min: 0, max: 1, step: 0.01, group: "Lớp và xuất hiện", tip: "Mức cho phép tạo áp lực khi chuyển sang lớp tiếp theo." },
  { key: "clusterRatio", label: "Tỷ lệ gom màu", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Tỷ lệ ưu tiên gom vật phẩm cùng màu; thấp hơn sẽ xen kẽ màu nhiều hơn." },
  { key: "maxClusterSizePerBranch", label: "Cụm tối đa/nhánh", type: "number", min: 1, max: 6, step: 1, group: "Cụm và đường đi", tip: "Giới hạn cứng số vật phẩm cùng màu trong một cụm trên mỗi nhánh." },
  { key: "branchDistributionBalance", label: "Cân bằng nhánh", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Ưu tiên mềm để không dồn toàn bộ vật phẩm vào một nhánh." },
  { key: "routeChoicePressure", label: "Áp lực chọn đường", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức độ buộc người chơi cân nhắc đường đi khi thu item." },
  { key: "narrowPathUsage", label: "Dùng ray hẹp", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức ưu tiên các đoạn ray ít lối thoát để tăng rủi ro." },
  { key: "loopRiskPressure", label: "Rủi ro vòng/ngõ cụt", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức sử dụng vòng ngắn hoặc ngõ cụt có nguy cơ tự va chạm." }
]);

export function createDefaultGenerateSettings() {
  return {
    seed: 12345,
    maxRetries: 50,
    difficultyPreset: "Thuong",
    multiBranchMode: "balanced",
    tailLengthGrowthCurve: "linear",
    ...GENERATE_PRESETS.Thuong
  };
}

export function normalizeGenerateSettings(value = {}) {
  const defaults = createDefaultGenerateSettings();
  const settings = { ...defaults, ...(value ?? {}) };
  if (settings.difficultyPreset === "Easy") settings.difficultyPreset = "De";
  if (settings.difficultyPreset === "Normal") settings.difficultyPreset = "Thuong";
  if (settings.difficultyPreset === "Hard") settings.difficultyPreset = "Kho";
  if (settings.difficultyPreset === "Expert") settings.difficultyPreset = "ChuyenGia";
  settings.difficultyPreset = GENERATE_PRESETS[settings.difficultyPreset] ? settings.difficultyPreset : "Thuong";
  settings.seed = Math.max(0, Math.floor(Number(settings.seed) || defaults.seed));
  settings.maxRetries = Math.max(1, Math.min(500, Math.floor(Number(settings.maxRetries) || defaults.maxRetries)));
  settings.multiBranchMode = MULTI_BRANCH_MODE_LABELS[settings.multiBranchMode] ? settings.multiBranchMode : "balanced";
  settings.tailLengthGrowthCurve = TAIL_CURVE_LABELS[settings.tailLengthGrowthCurve] ? settings.tailLengthGrowthCurve : "linear";
  GENERATE_SETTING_FIELDS.forEach((field) => {
    const numeric = Number(settings[field.key]);
    settings[field.key] = Number.isFinite(numeric) ? numeric : defaults[field.key];
  });
  return settings;
}

export function applyGeneratePreset(settings, presetName) {
  const preset = GENERATE_PRESETS[presetName] ? presetName : "Thuong";
  return normalizeGenerateSettings({ ...settings, difficultyPreset: preset, ...GENERATE_PRESETS[preset] });
}

export function validateGenerateSettings(settings) {
  const normalized = normalizeGenerateSettings(settings);
  const errors = [];
  GENERATE_SETTING_FIELDS.forEach((field) => {
    const value = Number(normalized[field.key]);
    if (value < field.min || value > field.max) {
      errors.push({
        code: "DIFFICULTY_OUT_OF_RANGE",
        severity: "error",
        message: `${field.label} phải nằm trong khoảng ${field.min} - ${field.max}.`,
        settingKey: field.key,
        suggestion: "Chọn lại preset hoặc chỉnh giá trị về đúng giới hạn."
      });
    }
  });
  if (normalized.maxRetries < 1) {
    errors.push({
      code: "DIFFICULTY_OUT_OF_RANGE",
      severity: "error",
      message: "Số lần thử lại phải lớn hơn 0.",
      settingKey: "maxRetries",
      suggestion: "Dùng giá trị từ 1 đến 500."
    });
  }
  return { settings: normalized, errors };
}
