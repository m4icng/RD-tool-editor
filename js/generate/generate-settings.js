export const GENERATOR_VERSION = "1.0.0";

export const GENERATE_PRESETS = Object.freeze({
  Easy: {
    clusterRatio: 0.62,
    maxClusterSizePerBranch: 4,
    layerDistributionBalance: 0.9,
    branchDistributionBalance: 0.9,
    avgTailLengthTarget: 5,
    tailLengthGrowthCurve: "linear",
    tailLengthCap: 9,
    tailLengthVariance: 1,
    progressionPressure: 0.25,
    pressureCurve: "Flat",
    reliefSegmentRatio: 0.35,
    noiseClusterCountBeforeTarget: 0,
    noiseItemCountPerCluster: 1,
    noiseBeforeTargetRatio: 0.08,
    noiseSpacingMin: 4,
    noiseColorDiversity: 1,
    itemDensityTarget: 0.35,
    clusterCompactness: 0.55,
    routeChoicePressure: 0.2,
    decisionPointFrequency: 0.2
  },
  Normal: {
    clusterRatio: 0.8,
    maxClusterSizePerBranch: 6,
    layerDistributionBalance: 0.8,
    branchDistributionBalance: 0.75,
    avgTailLengthTarget: 8,
    tailLengthGrowthCurve: "linear",
    tailLengthCap: 14,
    tailLengthVariance: 2,
    progressionPressure: 0.5,
    pressureCurve: "Ramp",
    reliefSegmentRatio: 0.22,
    noiseClusterCountBeforeTarget: 1,
    noiseItemCountPerCluster: 2,
    noiseBeforeTargetRatio: 0.2,
    noiseSpacingMin: 3,
    noiseColorDiversity: 2,
    itemDensityTarget: 0.5,
    clusterCompactness: 0.72,
    routeChoicePressure: 0.45,
    decisionPointFrequency: 0.45
  },
  Hard: {
    clusterRatio: 0.88,
    maxClusterSizePerBranch: 6,
    layerDistributionBalance: 0.65,
    branchDistributionBalance: 0.58,
    avgTailLengthTarget: 11,
    tailLengthGrowthCurve: "ramp",
    tailLengthCap: 18,
    tailLengthVariance: 3,
    progressionPressure: 0.72,
    pressureCurve: "PeakLate",
    reliefSegmentRatio: 0.14,
    noiseClusterCountBeforeTarget: 2,
    noiseItemCountPerCluster: 3,
    noiseBeforeTargetRatio: 0.32,
    noiseSpacingMin: 2,
    noiseColorDiversity: 3,
    itemDensityTarget: 0.68,
    clusterCompactness: 0.86,
    routeChoicePressure: 0.68,
    decisionPointFrequency: 0.66
  },
  Expert: {
    clusterRatio: 0.94,
    maxClusterSizePerBranch: 6,
    layerDistributionBalance: 0.52,
    branchDistributionBalance: 0.45,
    avgTailLengthTarget: 14,
    tailLengthGrowthCurve: "peak-late",
    tailLengthCap: 22,
    tailLengthVariance: 4,
    progressionPressure: 0.9,
    pressureCurve: "Sawtooth",
    reliefSegmentRatio: 0.08,
    noiseClusterCountBeforeTarget: 3,
    noiseItemCountPerCluster: 4,
    noiseBeforeTargetRatio: 0.45,
    noiseSpacingMin: 1,
    noiseColorDiversity: 4,
    itemDensityTarget: 0.82,
    clusterCompactness: 0.94,
    routeChoicePressure: 0.86,
    decisionPointFrequency: 0.82
  }
});

export const GENERATE_SETTING_FIELDS = Object.freeze([
  { key: "clusterRatio", label: "Cluster Ratio", type: "percent", min: 0, max: 1, step: 0.01, group: "Distribution", tip: "Ty le uu tien gom cung mau thanh cum." },
  { key: "maxClusterSizePerBranch", label: "Max Cluster", type: "number", min: 1, max: 6, step: 1, group: "Distribution", tip: "So item toi da trong mot cum tren moi nhanh." },
  { key: "layerDistributionBalance", label: "Layer Balance", type: "percent", min: 0, max: 1, step: 0.01, group: "Distribution", tip: "Uu tien mem cho phan bo deu theo layer path." },
  { key: "branchDistributionBalance", label: "Branch Balance", type: "percent", min: 0, max: 1, step: 0.01, group: "Distribution", tip: "Uu tien mem cho phan bo deu giua cac nhanh hop le." },
  { key: "avgTailLengthTarget", label: "Avg Tail", type: "number", min: 1, max: 40, step: 1, group: "Tail Pressure", tip: "Do dai duoi tau trung binh muc tieu." },
  { key: "tailLengthCap", label: "Tail Cap", type: "number", min: 1, max: 60, step: 1, group: "Tail Pressure", tip: "Gioi han do dai duoi toi da." },
  { key: "tailLengthVariance", label: "Tail Variance", type: "number", min: 0, max: 12, step: 1, group: "Tail Pressure", tip: "Muc dao dong do dai duoi giua cac doan." },
  { key: "progressionPressure", label: "Progression", type: "percent", min: 0, max: 1, step: 0.01, group: "Progression", tip: "Ap luc tong the theo tien trinh level." },
  { key: "reliefSegmentRatio", label: "Relief Ratio", type: "percent", min: 0, max: 1, step: 0.01, group: "Progression", tip: "Ty le doan giam ap luc." },
  { key: "noiseClusterCountBeforeTarget", label: "Noise Clusters", type: "number", min: 0, max: 12, step: 1, group: "Noise", tip: "So cum nhieu truoc item muc tieu." },
  { key: "noiseItemCountPerCluster", label: "Noise Size", type: "number", min: 0, max: 9, step: 1, group: "Noise", tip: "So item trong moi cum nhieu." },
  { key: "noiseBeforeTargetRatio", label: "Noise Ratio", type: "percent", min: 0, max: 1, step: 0.01, group: "Noise", tip: "Ty le item nhieu truoc muc tieu." },
  { key: "noiseSpacingMin", label: "Noise Spacing", type: "number", min: 0, max: 20, step: 1, group: "Noise", tip: "Khoang cach toi thieu giua cac cum nhieu." },
  { key: "noiseColorDiversity", label: "Noise Diversity", type: "number", min: 1, max: 7, step: 1, group: "Noise", tip: "Do da dang itemId trong vung nhieu." },
  { key: "itemDensityTarget", label: "Item Density", type: "percent", min: 0, max: 1, step: 0.01, group: "Item & Route", tip: "Mat do item muc tieu tren path hop le." },
  { key: "clusterCompactness", label: "Compactness", type: "percent", min: 0, max: 1, step: 0.01, group: "Item & Route", tip: "Muc do nen chat cum cung itemId." },
  { key: "routeChoicePressure", label: "Route Choice", type: "percent", min: 0, max: 1, step: 0.01, group: "Item & Route", tip: "Ap luc buoc nguoi choi can nhac nhanh." },
  { key: "decisionPointFrequency", label: "Decision Freq", type: "percent", min: 0, max: 1, step: 0.01, group: "Item & Route", tip: "Tan suat diem can quyet dinh." },
  { key: "bodyCollisionPressure", label: "Body Collision", type: "percent", min: 0, max: 1, step: 0.01, group: "Collision", tip: "Muc nguy co dau tau va vao than tau." },
  { key: "narrowPathUsage", label: "Narrow Usage", type: "percent", min: 0, max: 1, step: 0.01, group: "Collision", tip: "Muc su dung cac doan path hep." },
  { key: "obstacleProximity", label: "Obstacle Prox", type: "number", min: 0, max: 8, step: 1, group: "Collision", tip: "Khoang cach item toi element hoac vung han che." }
]);

export function createDefaultGenerateSettings() {
  return {
    seed: 12345,
    maxRetries: 50,
    difficultyPreset: "Normal",
    multiBranchMode: "balanced",
    pressureCurve: "Ramp",
    tailLengthGrowthCurve: "linear",
    bodyCollisionPressure: 0.35,
    narrowPathUsage: 0.3,
    obstacleProximity: 1,
    ...GENERATE_PRESETS.Normal
  };
}

export function normalizeGenerateSettings(value = {}) {
  const defaults = createDefaultGenerateSettings();
  const settings = { ...defaults, ...(value ?? {}) };
  settings.difficultyPreset = GENERATE_PRESETS[settings.difficultyPreset] ? settings.difficultyPreset : "Normal";
  settings.seed = Math.max(0, Math.floor(Number(settings.seed) || defaults.seed));
  settings.maxRetries = Math.max(1, Math.min(500, Math.floor(Number(settings.maxRetries) || defaults.maxRetries)));
  settings.multiBranchMode = ["balanced", "spread", "clustered"].includes(settings.multiBranchMode) ? settings.multiBranchMode : "balanced";
  settings.pressureCurve = ["Flat", "Ramp", "Sawtooth", "PeakLate"].includes(settings.pressureCurve) ? settings.pressureCurve : defaults.pressureCurve;
  settings.tailLengthGrowthCurve = ["linear", "flat", "ramp", "peak-late"].includes(settings.tailLengthGrowthCurve) ? settings.tailLengthGrowthCurve : defaults.tailLengthGrowthCurve;
  GENERATE_SETTING_FIELDS.forEach((field) => {
    const numeric = Number(settings[field.key]);
    settings[field.key] = Number.isFinite(numeric) ? numeric : defaults[field.key];
  });
  return settings;
}

export function applyGeneratePreset(settings, presetName) {
  const preset = GENERATE_PRESETS[presetName] ? presetName : "Normal";
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
        message: `${field.label} must be between ${field.min} and ${field.max}.`,
        settingKey: field.key,
        suggestion: "Reset preset or adjust the value inside the allowed range."
      });
    }
  });
  if (normalized.maxRetries < 1) {
    errors.push({
      code: "DIFFICULTY_OUT_OF_RANGE",
      severity: "error",
      message: "maxRetries must be greater than 0.",
      settingKey: "maxRetries",
      suggestion: "Use a retry limit from 1 to 500."
    });
  }
  return { settings: normalized, errors };
}
