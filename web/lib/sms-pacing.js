// Text pacing: at most SMS_DAILY_LIMIT alert texts per phone number in any 24 hours, and
// at least SMS_MIN_GAP_MINUTES between two of them. Jobs that match while a number is
// waiting are held in sms_hold and go out together in the next text, so nothing is
// dropped, it is just grouped. Emails are not paced.
import { sql } from "@vercel/postgres";
import { ensureJobStatusTable } from "@/lib/job-status";

export const SMS_DAILY_LIMIT = 15;
export const SMS_MIN_GAP_MINUTES = 60;

let ready = null;
export function ensureSmsHoldTable() {
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS sms_hold (
        user_id TEXT NOT NULL,
        job_link TEXT NOT NULL,
        job_title TEXT NOT NULL,
        job_bank TEXT NOT NULL,
        job_location TEXT DEFAULT '',
        job_category TEXT DEFAULT '',
        held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, job_link)
      )
    `.catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Counted by phone number (from the send log), so two accounts on one number share the limit.
// Returns { allowed, sentToday, nextAt }. On a database error it allows the send: a broken
// count must not silence alerts.
export async function smsSlot(phone) {
  try {
    const { rows } = await sql`
      SELECT COUNT(*)::int AS n, MAX(created_at) AS last, MIN(created_at) AS first
      FROM notification_log
      WHERE channel = 'sms' AND status = 'sent' AND recipient = ${phone}
        AND created_at > NOW() - INTERVAL '24 hours'
    `;
    const { n, last, first } = rows[0] || {};
    const gapEnds = last ? new Date(last).getTime() + SMS_MIN_GAP_MINUTES * 60_000 : 0;
    const dayEnds = n >= SMS_DAILY_LIMIT && first ? new Date(first).getTime() + 24 * 3600_000 : 0;
    const nextAt = Math.max(gapEnds, dayEnds);
    return { allowed: nextAt <= Date.now(), sentToday: n || 0, nextAt: nextAt ? new Date(nextAt) : null };
  } catch (err) {
    console.error("sms slot check failed:", err?.message || err);
    return { allowed: true, sentToday: 0, nextAt: null };
  }
}

export async function holdJobs(userId, jobs) {
  await ensureSmsHoldTable();
  for (const j of jobs) {
    await sql`
      INSERT INTO sms_hold (user_id, job_link, job_title, job_bank, job_location, job_category)
      VALUES (${userId}, ${j.link}, ${j.title}, ${j.bank}, ${j.location || ""}, ${j.category || ""})
      ON CONFLICT (user_id, job_link) DO NOTHING
    `;
  }
}

// Held jobs for this user that are still worth texting: still live, link not dead, and
// found in the last 48 hours (the same rule as the retry sweep), and not already texted
// (an email retry can hold a job whose text went out). Oldest first.
export async function heldJobs(userId) {
  try {
    await Promise.all([ensureSmsHoldTable(), ensureJobStatusTable()]);
    const { rows } = await sql`
      SELECT h.job_link, h.job_title, h.job_bank, h.job_location, h.job_category
      FROM sms_hold h JOIN jobs j ON j.link = h.job_link
      WHERE h.user_id = ${userId} AND j.is_live AND NOT j.link_dead
        AND j.detected_at > NOW() - INTERVAL '48 hours'
        AND NOT EXISTS (
          SELECT 1 FROM user_job_status s
          WHERE s.user_id = h.user_id AND s.link = h.job_link AND s.alerted_via = 'sms'
        )
      ORDER BY h.held_at ASC
    `;
    return rows.map((r) => ({ link: r.job_link, title: r.job_title, bank: r.job_bank, location: r.job_location, category: r.job_category }));
  } catch (err) {
    console.error("held sms jobs read failed:", err?.message || err);
    return [];
  }
}

export async function clearHeld(userId) {
  try {
    await ensureSmsHoldTable();
    await sql`DELETE FROM sms_hold WHERE user_id = ${userId}`;
  } catch (err) {
    console.error("sms_hold clear failed:", err?.message || err);
  }
}

// User ids with held jobs. Rows older than 48 hours can never be sent, so drop them here.
export async function usersWithHeldJobs() {
  await ensureSmsHoldTable();
  await sql`DELETE FROM sms_hold WHERE held_at < NOW() - INTERVAL '48 hours'`;
  const { rows } = await sql`SELECT DISTINCT user_id FROM sms_hold`;
  return rows.map((r) => r.user_id);
}
