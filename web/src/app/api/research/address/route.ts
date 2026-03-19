import { NextResponse } from "next/server";
import { processAddress } from "@/lib/research/pipeline";

/**
 * POST /api/research/address
 *
 * Fire-and-forget endpoint for the research pipeline.
 * Called internally by email scan when addresses are detected.
 * Does NOT require user auth — uses agentId from body (internal use only).
 */
export async function POST(request: Request) {
  // Simple internal auth check — require a shared secret or validate origin
  const body = await request.json();
  const { agentId, addresses, triggerType, triggerSourceId, buyerEmail, buyerId } = body;

  if (!agentId || !addresses || !Array.isArray(addresses)) {
    return NextResponse.json({ error: "agentId and addresses[] required" }, { status: 400 });
  }

  // Process each address — don't await, fire-and-forget
  const results: string[] = [];
  for (const addr of addresses) {
    try {
      const briefId = await processAddress({
        agentId,
        address: addr,
        triggerType: triggerType || "email",
        triggerSourceId,
        buyerEmail,
        buyerId,
      });
      if (briefId) results.push(briefId);
    } catch (err) {
      console.error(`[research/address] Failed for "${addr.address}":`, err);
    }
  }

  return NextResponse.json({ processed: results.length, briefIds: results });
}
