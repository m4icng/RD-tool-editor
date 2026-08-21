const DEFAULT_AUTO_NOISE_PROFILE = Object.freeze({
  minDistance: 1,
  maxDistance: 2,
  weightsByDistance: { 1: 0.7, 2: 0.3 }
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeWeightMap(weightsByDistance, minDistance, maxDistance) {
  const weights = {};
  for (let distance = minDistance; distance <= maxDistance; distance += 1) {
    const value = Number(weightsByDistance?.[distance] ?? weightsByDistance?.[String(distance)] ?? 0);
    weights[distance] = Number.isFinite(value) && value > 0 ? value : 0;
  }
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total > 0) {
    Object.keys(weights).forEach((distance) => {
      weights[distance] = weights[distance] / total;
    });
    return weights;
  }
  for (let distance = minDistance; distance <= maxDistance; distance += 1) {
    weights[distance] = distance === minDistance ? 1 : 0;
  }
  return weights;
}

export function createNoiseProfile(settings) {
  const mode = settings.noiseDepthMode ?? "auto";
  const derived = settings.autoDerivedParameters?.noiseProfile;
  const source = mode === "auto"
    ? (derived ?? DEFAULT_AUTO_NOISE_PROFILE)
    : mode === "custom"
      ? {
        minDistance: settings.noiseMinDistance,
        maxDistance: settings.noiseMaxDistance,
        weightsByDistance: {
          1: settings.noiseDistanceWeight1,
          2: settings.noiseDistanceWeight2,
          3: settings.noiseDistanceWeight3
        }
      }
      : (derived ?? DEFAULT_AUTO_NOISE_PROFILE);
  const minDistance = clamp(Math.floor(Number(source.minDistance) || 1), 1, 8);
  const maxDistance = clamp(Math.floor(Number(source.maxDistance) || minDistance), minDistance, 8);
  return {
    mode,
    minDistance,
    maxDistance,
    weightsByDistance: normalizeWeightMap(source.weightsByDistance, minDistance, maxDistance),
    preloadRatioByDistance: {
      1: 1,
      ...(settings.autoDerivedParameters?.maxPreloadRatioByDistance ?? {})
    }
  };
}

function availableNoiseCount(entry, distance, profile) {
  const ratio = Number(profile.preloadRatioByDistance?.[distance] ?? Math.max(0.2, 1 - (distance - 1) * 0.22));
  const maxPreload = Math.max(1, Math.ceil(entry.amount * clamp(ratio, 0.05, 1)));
  return Math.max(0, Math.min(entry.remaining, maxPreload - (entry.preloaded ?? 0)));
}

function distanceCapacity(pool, currentTrayLayerIndex, distance, profile) {
  return pool.reduce((sum, entry) => {
    const entryDistance = entry.sourceTrayLayerIndex - currentTrayLayerIndex;
    if (entryDistance !== distance) return sum;
    return sum + availableNoiseCount(entry, distance, profile);
  }, 0);
}

function allocateWeightedCounts(total, distances, capacities, weights, random) {
  const counts = Object.fromEntries(distances.map((distance) => [distance, 0]));
  const capacityTotal = distances.reduce((sum, distance) => sum + capacities[distance], 0);
  let remaining = Math.min(total, capacityTotal);
  while (remaining > 0 && distances.some((distance) => counts[distance] < capacities[distance])) {
    const available = distances.filter((distance) => counts[distance] < capacities[distance]);
    const weightTotal = available.reduce((sum, distance) => sum + (weights[distance] ?? 0), 0);
    const quotas = available.map((distance) => {
      const weight = weightTotal > 0 ? weights[distance] ?? 0 : 1 / available.length;
      return { distance, quota: remaining * weight / (weightTotal > 0 ? weightTotal : 1) };
    });
    let allocatedThisPass = 0;
    quotas.forEach(({ distance, quota }) => {
      const amount = Math.min(capacities[distance] - counts[distance], Math.floor(quota));
      if (amount <= 0) return;
      counts[distance] += amount;
      allocatedThisPass += amount;
    });
    remaining -= allocatedThisPass;
    if (remaining <= 0) break;
    const ranked = quotas
      .filter(({ distance }) => counts[distance] < capacities[distance])
      .map((entry) => ({ ...entry, score: entry.quota - Math.floor(entry.quota) + random() * 0.01 }))
      .sort((a, b) => b.score - a.score);
    const picked = ranked[0];
    if (!picked) break;
    counts[picked.distance] += 1;
    remaining -= 1;
  }
  return counts;
}

function takeFromDistance({ pool, currentTrayLayerIndex, distance, count, profile, existingCarryByItemId, random }) {
  const taken = [];
  let remaining = count;
  while (remaining > 0) {
    const candidates = pool
      .filter((entry) => entry.sourceTrayLayerIndex - currentTrayLayerIndex === distance)
      .map((entry) => ({ entry, capacity: availableNoiseCount(entry, distance, profile) }))
      .filter((candidate) => candidate.capacity > 0)
      .map((candidate) => {
        const sameCarry = existingCarryByItemId.get(candidate.entry.itemId) ?? 0;
        const demandScore = candidate.capacity + candidate.entry.remaining * 0.35;
        const trayScore = 1 / (1 + Number(candidate.entry.trayId ?? 0) * 0.001);
        return {
          ...candidate,
          score: demandScore + trayScore - sameCarry * 0.55 + random() * 0.2
        };
      })
      .sort((a, b) => b.score - a.score);
    const picked = candidates[0];
    if (!picked) break;
    const amount = Math.min(picked.capacity, remaining);
    picked.entry.remaining -= amount;
    picked.entry.preloaded = (picked.entry.preloaded ?? 0) + amount;
    existingCarryByItemId.set(picked.entry.itemId, (existingCarryByItemId.get(picked.entry.itemId) ?? 0) + amount);
    taken.push({
      ...picked.entry,
      amount,
      isNoise: true,
      noiseDistance: distance
    });
    remaining -= amount;
  }
  return { taken, missing: remaining };
}

export function allocateFutureNoise({ pool, currentTrayLayerIndex, totalNoiseCount, settings, random, existingCarryByItemId = new Map() }) {
  const profile = createNoiseProfile(settings);
  const maxAvailableDistance = Math.max(0, ...pool
    .filter((entry) => entry.remaining > 0)
    .map((entry) => entry.sourceTrayLayerIndex - currentTrayLayerIndex));
  const minDistance = Math.min(profile.minDistance, Math.max(1, maxAvailableDistance || profile.minDistance));
  const maxDistance = Math.min(profile.maxDistance, maxAvailableDistance);
  if (totalNoiseCount <= 0 || maxDistance < minDistance) {
    return { taken: [], missing: Math.max(0, totalNoiseCount), report: { profile, effectiveMinDistance: minDistance, effectiveMaxDistance: maxDistance, byDistance: {} } };
  }
  const distances = [];
  for (let distance = minDistance; distance <= maxDistance; distance += 1) distances.push(distance);
  const capacities = Object.fromEntries(distances.map((distance) => [distance, distanceCapacity(pool, currentTrayLayerIndex, distance, profile)]));
  const eligibleDistances = distances.filter((distance) => capacities[distance] > 0);
  if (eligibleDistances.length === 0) {
    return { taken: [], missing: totalNoiseCount, report: { profile, effectiveMinDistance: minDistance, effectiveMaxDistance: maxDistance, byDistance: {} } };
  }
  const weights = normalizeWeightMap(profile.weightsByDistance, minDistance, maxDistance);
  const distanceCounts = allocateWeightedCounts(totalNoiseCount, eligibleDistances, capacities, weights, random);
  const taken = [];
  const byDistance = {};
  eligibleDistances.forEach((distance) => {
    const result = takeFromDistance({ pool, currentTrayLayerIndex, distance, count: distanceCounts[distance], profile, existingCarryByItemId, random });
    taken.push(...result.taken);
    byDistance[distance] = {
      target: distanceCounts[distance],
      actual: result.taken.reduce((sum, entry) => sum + entry.amount, 0),
      capacity: capacities[distance],
      weight: weights[distance] ?? 0
    };
  });
  const actual = taken.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    taken,
    missing: Math.max(0, totalNoiseCount - actual),
    report: {
      profile,
      effectiveMinDistance: minDistance,
      effectiveMaxDistance: maxDistance,
      byDistance
    }
  };
}
