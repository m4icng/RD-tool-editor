export const GENERATOR_VERSION = "1.3.0";

export const GENERATE_PRESETS = Object.freeze({
  De: { difficultyScore: 0.25 },
  Thuong: { difficultyScore: 0.45 },
  Kho: { difficultyScore: 0.65 },
  ChuyenGia: { difficultyScore: 0.85 }
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
  sawtooth: "Răng cưa",
  ramp: "Tăng dần",
  "peak-late": "Khó cuối màn"
});

export const DERIVED_GENERATE_SETTING_FIELDS = Object.freeze([
  { key: "avgTailLengthTarget", label: "Đuôi TB mục tiêu", type: "number", min: 1, max: 40, step: 1, group: "Áp lực đuôi", tip: "Độ dài đuôi tàu trung bình mà bộ sinh cố gắng hướng tới." },
  { key: "targetPeakTail", label: "Đuôi đỉnh mục tiêu", type: "number", min: 2, max: 60, step: 1, group: "Áp lực đuôi", tip: "Đỉnh áp lực đuôi dự kiến cho level; dùng để designer khóa cảm giác peak mong muốn." },
  { key: "tailLengthCap", label: "Giới hạn đuôi", type: "number", min: 1, max: 60, step: 1, group: "Áp lực đuôi", tip: "Nếu ước tính đuôi vượt ngưỡng này, bộ sinh sẽ báo lỗi." },
  { key: "tailLengthVariance", label: "Dao động đuôi", type: "number", min: 0, max: 12, step: 1, group: "Áp lực đuôi", tip: "Mức dao động độ dài đuôi giữa các đoạn khó/dễ." },
  { key: "releaseDelayTarget", label: "Độ trễ xả", type: "number", min: 1, max: 80, step: 1, group: "Áp lực xả", tip: "Khoảng cách đường đi mục tiêu từ lúc ăn vật phẩm tới khay phù hợp." },
  { key: "unreleasedInventoryTarget", label: "Tồn kho mục tiêu", type: "percent", min: 0, max: 1, step: 0.01, group: "Áp lực xả", tip: "Tỷ lệ vật phẩm dự kiến chưa xả được tại các đoạn áp lực." },
  { key: "maxUnreleasedItems", label: "Tồn kho tối đa", type: "number", min: 1, max: 80, step: 1, group: "Áp lực xả", tip: "Số vật phẩm chưa xả tối đa cho phép theo mô phỏng nhanh." },
  { key: "releaseDistanceWeight", label: "Trọng số xả", type: "percent", min: 0, max: 1, step: 0.01, group: "Áp lực xả", tip: "Mức ưu tiên khoảng cách vật phẩm tới khay phù hợp khi chọn vị trí." },
  { key: "releaseAmountTarget", label: "Lượng xả mục tiêu", type: "number", min: 1, max: 12, step: 1, group: "Áp lực xả", tip: "Số item mục tiêu trong một nhịp xả/relief để kiểm soát độ nghẹt khi mở khay." },
  { key: "layerDistributionBalance", label: "Cân bằng lớp", type: "percent", min: 0, max: 1, step: 0.01, group: "Lớp và xuất hiện", tip: "Ưu tiên mềm để giữ phân bổ giữa các lớp theo đúng khay nguồn." },
  { key: "spawnSafetyDistance", label: "Khoảng cách xuất hiện an toàn", type: "number", min: 0, max: 30, step: 1, group: "Lớp và xuất hiện", tip: "Khoảng cách tối thiểu từ điểm bắt đầu tới vật phẩm lớp mới để tránh bẫy xuất hiện." },
  { key: "maxImmediateChainCount", label: "Chuỗi gần đầu tối đa", type: "number", min: 0, max: 12, step: 1, group: "Lớp và xuất hiện", tip: "Số vật phẩm lớp mới liên tiếp được phép xuất hiện quá gần đầu tàu." },
  { key: "nextLayerTrapPressure", label: "Áp lực bẫy lớp", type: "percent", min: 0, max: 1, step: 0.01, group: "Lớp và xuất hiện", tip: "Mức cho phép tạo áp lực khi chuyển sang lớp tiếp theo." },
  { key: "clusterRatio", label: "Tỷ lệ gom màu", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Tỷ lệ ưu tiên gom vật phẩm cùng màu; thấp hơn sẽ xen kẽ màu nhiều hơn." },
  { key: "noiseRatio", label: "Tỷ lệ noise", type: "percent", min: 0, max: 0.8, step: 0.01, group: "Cụm và đường đi", tip: "Tỷ lệ item lấy từ nhu cầu khay tương lai để kéo dài thân, chưa fill ngay ở layer hiện tại." },
  { key: "carryOverRatio", label: "Tỷ lệ carry-over", type: "percent", min: 0, max: 0.8, step: 0.01, group: "Cụm và đường đi", tip: "Tỷ lệ item được đẩy qua nhiều nhịp/layer trước khi có cơ hội xả vào khay." },
  { key: "maxClusterSizePerBranch", label: "Cụm tối đa/nhánh", type: "number", min: 1, max: 6, step: 1, group: "Cụm và đường đi", tip: "Giới hạn cứng số vật phẩm cùng màu trong một cụm trên mỗi nhánh." },
  { key: "branchDistributionBalance", label: "Cân bằng nhánh", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Ưu tiên mềm để không dồn toàn bộ vật phẩm vào một nhánh." },
  { key: "routeChoicePressure", label: "Áp lực chọn đường", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức độ buộc người chơi cân nhắc đường đi khi thu item." },
  { key: "narrowPathUsage", label: "Dùng ray hẹp", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức ưu tiên các đoạn ray ít lối thoát để tăng rủi ro." },
  { key: "loopRiskPressure", label: "Rủi ro vòng/ngõ cụt", type: "percent", min: 0, max: 1, step: 0.01, group: "Cụm và đường đi", tip: "Mức sử dụng vòng ngắn hoặc ngõ cụt có nguy cơ tự va chạm." },
  { key: "beamWidth", label: "Beam Width", type: "number", min: 1, max: 64, step: 1, group: "Tìm kiếm", tip: "Độ rộng beam cho bước thử/repair; cao hơn tốn thời gian hơn nhưng có thêm lựa chọn cân bằng." }
]);

export const DERIVED_GENERATE_SETTING_KEYS = Object.freeze(DERIVED_GENERATE_SETTING_FIELDS.map((field) => field.key));

export const DERIVED_GENERATE_PARAMETER_ALIASES = Object.freeze({
  avgTailLengthTarget: "targetAverageTail",
  tailLengthCap: "safeTailLimit",
  unreleasedInventoryTarget: "highPressureRatio",
  clusterRatio: "clusterAdjacencyRatio",
  maxClusterSizePerBranch: "clusterSizeDistribution.max",
  branchDistributionBalance: "branchDistribution"
});

export const GENERATE_SETTING_FIELDS = Object.freeze([
  { key: "difficultyScore", label: "Điểm độ khó", type: "percent", min: 0, max: 1, step: 0.01, group: "Designer Intent", tip: "Mục tiêu tổng quát; các thông số sinh chi tiết sẽ được tự tính theo level." }
]);

const FALLBACK_DERIVED_SETTINGS = Object.freeze({
  clusterRatio: 0.88,
  maxClusterSizePerBranch: 5,
  branchDistributionBalance: 0.84,
  routeChoicePressure: 0.34,
  narrowPathUsage: 0.26,
  loopRiskPressure: 0.24,
  layerDistributionBalance: 0.88,
  spawnSafetyDistance: 5,
  maxImmediateChainCount: 2,
  nextLayerTrapPressure: 0.24,
  avgTailLengthTarget: 4,
  targetPeakTail: 9,
  tailLengthCap: 8,
  tailLengthGrowthCurve: "linear",
  tailLengthVariance: 2,
  releaseDelayTarget: 6,
  unreleasedInventoryTarget: 0.28,
  maxUnreleasedItems: 7,
  releaseDistanceWeight: 0.42,
  releaseAmountTarget: 4,
  noiseRatio: 0.42,
  carryOverRatio: 0.34,
  beamWidth: 11
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createDefaultGenerateSettings() {
  return {
    seed: createRandomGenerateSeed(),
    maxRetries: 50,
    difficultyPreset: "Thuong",
    difficultyScore: GENERATE_PRESETS.Thuong.difficultyScore,
    multiBranchMode: "balanced",
    autoDerived: true,
    derivedOverrideKeys: [],
    ...FALLBACK_DERIVED_SETTINGS
  };
}

export function createRandomGenerateSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }
  return Math.floor((Date.now() + Math.random() * 4294967296) % 4294967296);
}

export function normalizeGenerateSettings(value = {}) {
  const defaults = createDefaultGenerateSettings();
  const settings = { ...defaults, ...(value ?? {}) };
  if (settings.difficultyPreset === "Easy") settings.difficultyPreset = "De";
  if (settings.difficultyPreset === "Normal") settings.difficultyPreset = "Thuong";
  if (settings.difficultyPreset === "Hard") settings.difficultyPreset = "Kho";
  if (settings.difficultyPreset === "Expert") settings.difficultyPreset = "ChuyenGia";
  settings.difficultyPreset = GENERATE_PRESETS[settings.difficultyPreset] ? settings.difficultyPreset : "Thuong";
  const presetScore = GENERATE_PRESETS[settings.difficultyPreset].difficultyScore;
  const difficultyScore = Number(settings.difficultyScore);
  settings.difficultyScore = clamp(Number.isFinite(difficultyScore) ? difficultyScore : presetScore, 0, 1);
  const numericSeed = Number(settings.seed);
  settings.seed = Number.isFinite(numericSeed) && numericSeed > 0
    ? Math.floor(numericSeed)
    : createRandomGenerateSeed();
  settings.maxRetries = Math.max(1, Math.min(500, Math.floor(Number(settings.maxRetries) || defaults.maxRetries)));
  settings.multiBranchMode = MULTI_BRANCH_MODE_LABELS[settings.multiBranchMode] ? settings.multiBranchMode : "balanced";
  settings.tailLengthGrowthCurve = TAIL_CURVE_LABELS[settings.tailLengthGrowthCurve] ? settings.tailLengthGrowthCurve : "linear";
  DERIVED_GENERATE_SETTING_FIELDS.forEach((field) => {
    const numeric = Number(settings[field.key]);
    settings[field.key] = clamp(Number.isFinite(numeric) ? numeric : defaults[field.key], field.min, field.max);
  });
  settings.autoDerived = settings.autoDerived !== false;
  settings.derivedOverrideKeys = Array.isArray(settings.derivedOverrideKeys)
    ? [...new Set(settings.derivedOverrideKeys.filter((key) => DERIVED_GENERATE_SETTING_KEYS.includes(key)))]
    : [];
  return settings;
}

export function applyGeneratePreset(settings, presetName) {
  const preset = GENERATE_PRESETS[presetName] ? presetName : "Thuong";
  return normalizeGenerateSettings({ ...settings, difficultyPreset: preset, difficultyScore: GENERATE_PRESETS[preset].difficultyScore, autoDerived: true, derivedOverrideKeys: [] });
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
