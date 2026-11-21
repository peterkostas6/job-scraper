// Server side of the free period (see lib/alert-trial-days.js): { endsAt (ISO), over }.
export { ALERT_TRIAL_DAYS, trialFor } from "@/lib/alert-trial-days";
import { trialFor } from "@/lib/alert-trial-days";

export function alertTrial(createdAt) {
  const t = trialFor(createdAt);
  return { endsAt: new Date(t.endsAt).toISOString(), over: t.over };
}
