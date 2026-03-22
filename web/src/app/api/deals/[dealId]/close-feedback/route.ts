import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedClient } from "@/lib/gmail/tokens";
import { createGmailDraft } from "@/lib/gmail/drafts";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const supabase = createAdminClient() as any;

    // Fetch deal with buyer and property info
    const { data: deal, error } = await supabase
      .from("deals")
      .select(
        "id, agent_id, stage, buyer_id, buyers(full_name, email, dashboard_token), properties(address), agents(email, full_name, gmail_connected)"
      )
      .eq("id", dealId)
      .single();

    if (error || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (deal.stage !== "closed") {
      return NextResponse.json(
        { error: "Deal is not closed" },
        { status: 400 }
      );
    }

    const buyer = deal.buyers as any;
    const agent = deal.agents as any;
    const property = deal.properties as any;

    if (!buyer?.email) {
      return NextResponse.json(
        { error: "Buyer has no email address" },
        { status: 400 }
      );
    }

    // Build feedback link
    const feedbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/p/${buyer.dashboard_token}/feedback-close/${dealId}`;

    // Create Gmail draft
    if (agent?.gmail_connected) {
      try {
        const auth = await getAuthedClient(deal.agent_id);
        await createGmailDraft(auth, {
          to: buyer.email,
          subject: `Congratulations on closing! How was your experience?`,
          htmlBody: `
            <p>Hi ${buyer.full_name},</p>
            <p>Congratulations on closing on <strong>${property?.address ?? "your new home"}</strong>!</p>
            <p>I'd love to hear about your experience working together. Your feedback helps me serve future clients even better.</p>
            <p>It takes less than a minute:</p>
            <p><a href="${feedbackUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">Share Your Feedback</a></p>
            <p>Thank you for trusting me with this journey!</p>
            <p>Best,<br>${agent.full_name}</p>
          `,
        });
      } catch (err) {
        console.error(
          `[close-feedback] Gmail draft failed for deal ${dealId}:`,
          err
        );
        return NextResponse.json(
          { error: "Failed to create Gmail draft" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, feedbackUrl });
  } catch (err) {
    console.error("[close-feedback] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
