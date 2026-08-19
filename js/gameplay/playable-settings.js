export const PLAYABLE_SETTING_LIMITS = Object.freeze({
  trainMoveSpeed: Object.freeze({ min: 5, max: 30, step: 1 }),
  trayFillSpeed: Object.freeze({ min: 1, max: 20, step: 1 })
});

export const DEFAULT_PLAYABLE_SETTINGS = Object.freeze({
  trainMoveSpeed: 15,
  trayFillSpeed: 9
});

const PLAYABLE_SETTINGS_STORAGE_KEY = "railwayDash.playableSettings";

function clampSetting(key, value) {
  const limits = PLAYABLE_SETTING_LIMITS[key];
  const fallback = DEFAULT_PLAYABLE_SETTINGS[key];
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(limits.max, Math.max(limits.min, Math.round(number)));
}

export function normalizePlayableSettings(settings = {}) {
  return {
    trainMoveSpeed: clampSetting("trainMoveSpeed", settings.trainMoveSpeed ?? settings.speed),
    trayFillSpeed: clampSetting("trayFillSpeed", settings.trayFillSpeed)
  };
}

export function changePlayableSetting(settings, key, delta) {
  if (!PLAYABLE_SETTING_LIMITS[key]) return normalizePlayableSettings(settings);
  return normalizePlayableSettings({
    ...settings,
    [key]: clampSetting(key, Number(settings?.[key] ?? DEFAULT_PLAYABLE_SETTINGS[key]) + delta)
  });
}

export function loadPlayableSettings(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(PLAYABLE_SETTINGS_STORAGE_KEY);
    return normalizePlayableSettings(raw ? JSON.parse(raw) : DEFAULT_PLAYABLE_SETTINGS);
  } catch {
    return normalizePlayableSettings(DEFAULT_PLAYABLE_SETTINGS);
  }
}

export function savePlayableSettings(settings, storage = globalThis.localStorage) {
  const normalized = normalizePlayableSettings(settings);
  try {
    storage?.setItem(PLAYABLE_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Runtime settings still apply even if browser storage is unavailable.
  }
  return normalized;
}

export function playableSettingIntervalMs(value) {
  return 1000 / Math.max(1, Number(value) || 1);
}
