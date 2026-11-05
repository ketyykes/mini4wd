// Local records are versioned: future physics/track changes need a new key.
export const RESULTS_KEY = 'mini4wd-results-v6'; // v6: coupled wall contact friction and stops.
const LIMIT = 20;

export function readResults(storage) {
  try {
    const rows = JSON.parse(storage.getItem(RESULTS_KEY) ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter((r) => r && typeof r.id === 'string' && typeof r.label === 'string'
      && Number.isFinite(r.time) && r.time > 0 && typeof r.date === 'string'
      && r.config && typeof r.config === 'object' && !Array.isArray(r.config)
      && Array.isArray(r.lapTimes) && r.lapTimes.length === 3 && r.lapTimes.every((t) => Number.isFinite(t) && t > 0))
      .sort((a, b) => a.time - b.time).slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function recordResult(storage, result, config, label) {
  const rows = readResults(storage);
  if (result.status !== 'finished' || result.laps < 3 || !Number.isFinite(result.simTime)
    || result.simTime <= 0 || !Array.isArray(result.lapTimes) || result.lapTimes.length !== 3
    || result.lapTimes.some((t) => !Number.isFinite(t) || t <= 0)) return { rows, saved: false };
  const date = new Date().toISOString();
  const row = { id: crypto.randomUUID(), date, time: result.simTime, lapTimes: result.lapTimes.slice(), config: structuredClone(config), label };
  rows.push(row);
  rows.sort((a, b) => a.time - b.time);
  rows.splice(LIMIT);
  try {
    storage.setItem(RESULTS_KEY, JSON.stringify(rows));
    return { rows, saved: true };
  } catch {
    return { rows, saved: false };
  }
}
