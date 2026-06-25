// Timezone-aware local-time helpers. Zero-dependency: uses Intl.DateTimeFormat.

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Return { weekday, hour, minute, dateKey } for `date` rendered in `tz`.
// dateKey = YYYY-MM-DD in that tz (used for per-day caps / idempotency).
export function localParts(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  // en-CA gives 24h; hour "24" can appear at midnight in some engines — normalize.
  let hour = parseInt(parts.hour, 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(parts.minute, 10);
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  // weekday short from formatToParts is locale text ("Mon"); normalize via Date math fallback.
  let weekday = parts.weekday;
  if (!WEEKDAY.includes(weekday)) {
    // Fallback: compute weekday index from the tz-local date string.
    const d = new Date(`${dateKey}T00:00:00`);
    weekday = WEEKDAY[d.getUTCDay()];
  }
  return { weekday, hour, minute, dateKey, minutesOfDay: hour * 60 + minute };
}

// Parse "HH:MM" → minutes of day.
export function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

// Is the local time inside quiet hours? Window wraps midnight (22:00 → 08:00).
export function inQuietHours(hour, startHour, endHour) {
  if (startHour > endHour) {
    // wraps midnight: quiet when hour >= start OR hour < end
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

// Is `minutesOfDay` inside [slotStart, slotEnd)? (slot times are "HH:MM" strings)
export function inSlotWindow(minutesOfDay, slot) {
  const start = hhmmToMinutes(slot.start);
  const end = hhmmToMinutes(slot.end);
  return minutesOfDay >= start && minutesOfDay < end;
}

// Resolve "now": NOW_OVERRIDE env (ISO UTC) for testing, else real time.
export function now() {
  const override = process.env.NOW_OVERRIDE;
  if (override && override.trim()) {
    const d = new Date(override.trim());
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}
