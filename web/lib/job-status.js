// Per-user job tracking for the Alerts page, kept in Postgres (user_job_status):
//   alerted_at / alerted_via  we texted or emailed them this job
//   viewed_at                 they opened it (from an alert link or from the site)
//   applied_at                they marked it applied
// One row per user + job link. Writes never throw: tracking must not block a send or a click.
import { sql } from "@vercel/postgres";

let ready = null;
export function ensureJobStatusTable() {
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS user_job_status (
        user_id TEXT NOT NULL,
        link TEXT NOT NULL,
        alerted_at TIMESTAMPTZ,
        alerted_via TEXT,
        viewed_at TIMESTAMPTZ,
        applied_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, link)
      )
    `.catch((err) => { ready = null; throw err; });
  }
  return ready;
}

const isUser = (id) => typeof id === "string" && id.startsWith("user_");

export async function markAlerted(userId, links, via) {
  if (!isUser(userId) || !links?.length) return;
  try {
    await ensureJobStatusTable();
    await sql`
      INSERT INTO user_job_status (user_id, link, alerted_at, alerted_via)
      SELECT ${userId}, l, NOW(), ${via} FROM unnest(${links}::text[]) AS l
      ON CONFLICT (user_id, link) DO UPDATE SET
        alerted_at = COALESCE(user_job_status.alerted_at, EXCLUDED.alerted_at),
        -- a text beats an email: "Texted you" is the label people care about
        alerted_via = CASE WHEN user_job_status.alerted_via = 'sms' THEN 'sms' ELSE EXCLUDED.alerted_via END,
        updated_at = NOW()
    `;
  } catch (err) {
    console.error("markAlerted failed:", err?.message || err);
  }
}

export async function markViewed(userId, link) {
  if (!isUser(userId) || !link) return;
  try {
    await ensureJobStatusTable();
    await sql`
      INSERT INTO user_job_status (user_id, link, viewed_at) VALUES (${userId}, ${link}, NOW())
      ON CONFLICT (user_id, link) DO UPDATE SET viewed_at = COALESCE(user_job_status.viewed_at, NOW()), updated_at = NOW()
    `;
  } catch (err) {
    console.error("markViewed failed:", err?.message || err);
  }
}

export async function markApplied(userId, link, applied) {
  await ensureJobStatusTable();
  await sql`
    INSERT INTO user_job_status (user_id, link, applied_at) VALUES (${userId}, ${link}, ${applied ? new Date().toISOString() : null})
    ON CONFLICT (user_id, link) DO UPDATE SET applied_at = ${applied ? new Date().toISOString() : null}, updated_at = NOW()
  `;
}

// { [link]: { alertedAt, alertedVia, viewedAt, appliedAt } }. Also folds in history from before
// this table existed: alerts from notification_log and clicks from short_links.
export async function jobStatuses(userId) {
  await ensureJobStatusTable();
  const out = {};
  const get = (link) => (out[link] ||= { alertedAt: null, alertedVia: null, viewedAt: null, appliedAt: null });
  const [log, clicks, rows] = await Promise.all([
    sql`
      SELECT l AS link, channel, MIN(created_at) AS at FROM notification_log, unnest(job_links) AS l
      WHERE user_id = ${userId} AND channel IN ('sms', 'email') AND status = 'sent' AND created_at > NOW() - INTERVAL '60 days'
      GROUP BY l, channel
    `.catch(() => ({ rows: [] })),
    sql`SELECT link, MIN(first_clicked_at) AS at FROM short_links WHERE user_id = ${userId} AND clicks > 0 GROUP BY link`.catch(() => ({ rows: [] })),
    sql`SELECT link, alerted_at, alerted_via, viewed_at, applied_at FROM user_job_status WHERE user_id = ${userId}`,
  ]);
  for (const r of log.rows) {
    const s = get(r.link);
    if (!s.alertedAt || r.at < s.alertedAt) s.alertedAt = r.at;
    if (r.channel === "sms" || !s.alertedVia) s.alertedVia = r.channel;
  }
  for (const r of clicks.rows) { const s = get(r.link); s.viewedAt ||= r.at; }
  for (const r of rows.rows) {
    const s = get(r.link);
    if (r.alerted_at) { s.alertedAt = s.alertedAt && s.alertedAt < r.alerted_at ? s.alertedAt : r.alerted_at; if (r.alerted_via === "sms" || !s.alertedVia) s.alertedVia = r.alerted_via; }
    if (r.viewed_at) s.viewedAt = s.viewedAt && s.viewedAt < r.viewed_at ? s.viewedAt : r.viewed_at;
    s.appliedAt = r.applied_at || null;
  }
  return out;
}
