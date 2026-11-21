// The free period, shared by server and browser. Every account gets ALERT_TRIAL_DAYS of full
// access (alert links open, last-48-hour roles show) from sign-up; accounts made before
// TRIAL_LAUNCH count from TRIAL_LAUNCH. After that, Premium.
export const ALERT_TRIAL_DAYS = 3;
export const TRIAL_LAUNCH = Date.parse("2026-11-20T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

// createdAt: Date, ISO string or ms. Returns { endsAt (ms), over }.
export function trialFor(createdAt, now = Date.now()) {
  const created = createdAt instanceof Date ? createdAt.getTime() : typeof createdAt === "string" ? Date.parse(createdAt) : Number(createdAt) || 0;
  const endsAt = Math.max(created, TRIAL_LAUNCH) + ALERT_TRIAL_DAYS * DAY;
  return { endsAt, over: now >= endsAt };
}
