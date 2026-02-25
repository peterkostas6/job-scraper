import { auth, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

// GET — fetch current notification preferences
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const notifications = user.unsafeMetadata?.notifications || {
      enabled: false,
      banks: [],
      categories: [],
      jobType: "all",
    };

    return Response.json({ notifications });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return Response.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

// POST — save notification preferences
export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, banks, categories, jobType, smsEnabled, phoneNumber } = body;

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const oldPhone = user.unsafeMetadata?.notifications?.phoneNumber || "";

    await client.users.updateUser(userId, {
      unsafeMetadata: {
        ...user.unsafeMetadata,
        notifications: {
          enabled: Boolean(enabled),
          banks: Array.isArray(banks) ? banks : [],
          categories: Array.isArray(categories) ? categories : [],
          jobType: jobType || "all",
          smsEnabled: Boolean(smsEnabled),
          phoneNumber: phoneNumber || "",
        },
      },
    });

    // Send welcome SMS if a new phone number was just added
    const newPhone = phoneNumber?.trim();
    if (smsEnabled && newPhone && newPhone !== oldPhone) {
      const twilioSid = process.env.TWILIO_ACCOUNT_SID;
      const twilioToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;

      if (twilioSid && twilioToken && twilioFrom) {
        const firstName = user.firstName ? ` ${user.firstName}` : "";
        const welcomeMsg = `Hey${firstName}! This is Pete from Pete's Postings. I'll send you a text based on your preferences when new jobs get posted. Good luck!`;

        const encoded = new URLSearchParams({ To: newPhone, From: twilioFrom, Body: welcomeMsg });
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
          },
          body: encoded.toString(),
        }).catch((e) => console.error("Welcome SMS failed:", e));
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Notifications POST error:", err);
    return Response.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
