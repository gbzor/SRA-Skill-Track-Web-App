// Daily streak = number of consecutive calendar days, counting back from the
// most recent activity, on which the user logged at least one report. The
// streak is only "alive" if the latest report was today or yesterday; a gap of
// a full day breaks it and returns 0. Days are bucketed in UTC so the count is
// stable regardless of which server region handles the request.
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayNumber(date) {
  return Math.floor(new Date(date).getTime() / DAY_MS);
}

export function computeStreak(dates, now = new Date()) {
  if (!Array.isArray(dates) || dates.length === 0) return 0;

  const days = new Set(dates.map(utcDayNumber));
  const today = utcDayNumber(now);

  // Anchor on today if there's activity today, else yesterday; otherwise the
  // streak has lapsed.
  let cursor;
  if (days.has(today)) cursor = today;
  else if (days.has(today - 1)) cursor = today - 1;
  else return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}
