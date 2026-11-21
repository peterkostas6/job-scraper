// Alerts are free for every account. The first ALERT_TRIAL_DAYS after an account's first
// alert, its alert links open the job; after that they open the Premium page until the
// account pays. The clock starts at the first alert sent on or after TRIAL_LAUNCH, so
// accounts that got alerts under the old rules start fresh.
import { sql } from "@vercel/postgres";

export { ALERT_TRIAL_DAYS } from "@/lib/alert-trial-days";
import { ALERT_TRIAL_DAYS } from "@/lib/alert-trial-days";
const TRIAL_LAUNCH = "2026-11-20T00:00:00Z";
const DAY = 24 * 60 * 60 * 1000;

// { startedAt, endsAt, over } with ISO dates; startedAt is null before the first alert.
// A failed lookup returns null so callers can let the click through.
export async function alertTrial(userId) {
  try {
    const { rows } = await sql`
      SELECT MIN(created_at) AS started FROM notification_log
      WHERE user_id = ${userId} AND channel IN ('sms', 'email') AND status = 'sent'
        AND created_at >= ${TRIAL_LAUNCH}::timestamptz
    `;
    const started = rows[0]?.started ? new Date(rows[0].started) : null;
    if (!started) return { startedAt: null, endsAt: null, over: false };
    const ends = new Date(started.getTime() + ALERT_TRIAL_DAYS * DAY);
    return { startedAt: started.toISOString(), endsAt: ends.toISOString(), over: Date.now() >= ends.getTime() };
  } catch (err) {
    console.error("alert trial lookup failed:", err?.message || err);
    return null;
  }
}
