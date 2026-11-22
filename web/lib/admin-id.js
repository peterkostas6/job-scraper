// Who can open /admin (client-safe; the server check is in lib/admin.js).
// Matches Pete's original account ID or any verified email of his.
export const ADMIN_USER_ID = "user_39bPOyYQAsr7t2Cki8GNEql1mY1";
const ADMIN_EMAILS = ["pete@petespostings.com", "peterkostas6@gmail.com"];

// user: a Clerk user object (from useUser on the client, or clerkClient on the server).
export function isAdminUser(user) {
  if (!user) return false;
  if (user.id === ADMIN_USER_ID) return true;
  return (user.emailAddresses || []).some((e) =>
    ADMIN_EMAILS.includes((e.emailAddress || "").toLowerCase()) && e.verification?.status === "verified");
}
