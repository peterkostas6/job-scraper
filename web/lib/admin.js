// Server check for Pete's admin routes: the signed-in account must pass isAdminUser.
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ADMIN_USER_ID, isAdminUser } from "@/lib/admin-id";

export async function isAdmin() {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    if (userId === ADMIN_USER_ID) return true;
    const client = await clerkClient();
    return isAdminUser(await client.users.getUser(userId));
  } catch {
    return false;
  }
}
