// App-only members: people who subscribed in the iPhone app and never made an account. The app
// creates a behind-the-scenes account for them when they pay (app/api/app/session), so their
// preferences, saved roles and notifications work like everyone else's. They have no email or
// password and never see a sign-in screen; the purchase on their Apple ID is what identifies them.
export const isAppOnly = (user) => Boolean(user?.publicMetadata?.appOnly ?? user?.public_metadata?.appOnly);

// Clerk may insist on an email for every account. If it does, app-only accounts get an address on
// this domain, which nothing ever sends to (see contactEmail).
export const APP_ONLY_EMAIL_DOMAIN = "app.petespostings.com";

// The email we may write to, or null for an app-only member.
export function contactEmail(user) {
  if (isAppOnly(user)) return null;
  const e = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;
  return e && !e.endsWith(`@${APP_ONLY_EMAIL_DOMAIN}`) ? e : null;
}
