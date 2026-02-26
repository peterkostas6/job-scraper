// Shared helpers used by both cron routes

export function isInternship(title) {
  const t = title.toLowerCase();
  return /\bintern\b/.test(t) || t.includes("internship") || t.includes("summer") || t.includes("co-op") || t.includes("coop");
}

export function isGraduateProgram(title) {
  const t = title.toLowerCase();
  return /\bgraduate\b/.test(t) || /\bgrad\s+program/.test(t) || /\bgrad\s+programme/.test(t);
}

export function buildEmailHtml(newJobs, userName) {
  const grouped = {};
  for (const job of newJobs) {
    const bank = job.bank || "Other";
    if (!grouped[bank]) grouped[bank] = [];
    grouped[bank].push(job);
  }

  let jobRows = "";
  for (const [bank, jobs] of Object.entries(grouped)) {
    jobRows += `<tr><td colspan="3" style="padding:16px 0 8px;font-size:16px;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0;">${bank}</td></tr>`;
    for (const job of jobs) {
      const type = isInternship(job.title) ? "Internship" : "Analyst";
      const typeColor = type === "Internship" ? "#d97706" : "#2563eb";
      jobRows += `
        <tr>
          <td style="padding:10px 0;font-size:14px;">
            <a href="${job.link}" style="color:#1e293b;text-decoration:none;font-weight:500;">${job.title}</a>
          </td>
          <td style="padding:10px 8px;font-size:12px;color:#64748b;">${job.location || ""}</td>
          <td style="padding:10px 0;font-size:11px;font-weight:600;color:${typeColor};text-transform:uppercase;">${type}</td>
        </tr>`;
    }
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#faf8f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:18px;font-weight:800;color:#1e293b;">Pete's Postings</span>
    </div>
    <p style="font-size:15px;color:#334155;margin:0 0 8px;">Hey${userName ? " " + userName : ""},</p>
    <p style="font-size:15px;color:#334155;margin:0 0 24px;">${newJobs.length} new ${newJobs.length === 1 ? "posting" : "postings"} matching your preferences just went live:</p>
    <table style="width:100%;border-collapse:collapse;">
      ${jobRows}
    </table>
    <div style="margin-top:32px;text-align:center;">
      <a href="https://petespostings.com" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Browse All Jobs</a>
    </div>
    <p style="margin-top:32px;font-size:12px;color:#94a3b8;text-align:center;">
      You're receiving this because you enabled job notifications on Pete's Postings.<br>
      To unsubscribe, turn off notifications in your dashboard settings.
    </p>
  </div>
</body>
</html>`;
}
