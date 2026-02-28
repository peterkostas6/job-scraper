// POST /api/webhook/telnyx — receives Telnyx delivery status callbacks
// We don't process them, just acknowledge receipt.

export async function POST() {
  return Response.json({ received: true }, { status: 200 });
}
