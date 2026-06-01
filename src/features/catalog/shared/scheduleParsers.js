/**
 * Helpers for parsing date/time inputs used by Slot Availabilities and Booking
 * Setup Workbench. Output of all builders is a deduplicated array of ISO
 * datetime strings (UTC), capped at MAX_SLOTS to protect bulk endpoints.
 */

export const MAX_SLOTS = 1000;
export const MAX_TIMES_PER_DAY = 48;

const DAY_MAP = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

/** Convert a value from <input type="datetime-local"> (or ISO) to ISO. Empty if invalid. */
export function parseInputToIso(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Lines → ISO strings. Accepts ISO, "YYYY-MM-DD HH:mm", "YYYY-MM-DDTHH:mm". */
export function parseDatetimesText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of lines) {
    const d = new Date(line.replace(' ', 'T'));
    if (!Number.isNaN(d.getTime())) {
      out.push(d.toISOString());
      if (out.length >= MAX_SLOTS) break;
    }
  }
  return Array.from(new Set(out));
}

/** Backwards-compatible alias for callers that used `parseSlotDatetimesText`. */
export const parseSlotDatetimesText = parseDatetimesText;
/** Backwards-compatible alias for callers that used `buildFromList`. */
export const buildFromList = parseDatetimesText;

/** Lines → [{ hh, mm, label }]. Supports "H:mm" and "HH:mm". Deduplicated by label. */
export function parseTimesText(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  for (const line of lines) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(line);
    if (!m) continue;
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) continue;
    out.push({ hh, mm, label: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` });
    if (out.length >= MAX_TIMES_PER_DAY) break;
  }

  const seen = new Set();
  return out.filter((t) => {
    if (seen.has(t.label)) return false;
    seen.add(t.label);
    return true;
  });
}

/**
 * Build ISO datetimes from a schedule (startDate..endDate, week-day map, list of {hh, mm}).
 * If `times` is omitted but `timesText` is provided, parses it.
 */
export function buildFromSchedule({ startDate, endDate, days, times, timesText }) {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() < start.getTime()) return [];

  const timeList = Array.isArray(times) && times.length ? times : parseTimesText(timesText);
  if (!timeList.length) return [];

  const out = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    if (!days?.[DAY_MAP[d.getDay()]]) continue;
    for (const t of timeList) {
      const dt = new Date(d);
      dt.setHours(t.hh, t.mm, 0, 0);
      out.push(dt.toISOString());
      if (out.length >= MAX_SLOTS) return Array.from(new Set(out));
    }
  }
  return Array.from(new Set(out));
}

/** Backwards-compatible alias for `buildSlotDatetimesFromSchedule`. */
export const buildSlotDatetimesFromSchedule = buildFromSchedule;

/** Build ISO datetimes from a [startIso, endIso] range with a fixed step in minutes. */
export function buildFromInterval({ startIso, endIso, stepMinutes }) {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;
  const step = Number(stepMinutes || 0);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (!Number.isFinite(step) || step <= 0) return [];

  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += step * 60_000) {
    out.push(new Date(t).toISOString());
    if (out.length >= MAX_SLOTS) break;
  }
  return out;
}

/** Format ISO datetime for compact slot display ("DD.MM.YY HH:mm" in ru-RU). */
export function formatSlot(iso) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
