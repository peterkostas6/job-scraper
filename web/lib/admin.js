// Pete's own Clerk account: the only one that can open /admin and the admin API routes
// without the CRON_SECRET key.
import { auth } from "@clerk/nextjs/server";
import { ADMIN_USER_ID } from "@/lib/admin-id";

export { ADMIN_USER_ID };

export async function isAdmin() {
  try {
    const { userId } = await auth();
    return userId === ADMIN_USER_ID;
  } catch {
    return false;
  }
}
