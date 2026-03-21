/**
 * Auto-follow-up draft generation.
 *
 * Detects triggers (post-showing, inactive buyer, similar favorites)
 * and generates personalized follow-up emails as Gmail drafts.
 */

import { llmComplete, isLLMAvailable } from "@/lib/llm/router";

export type FollowUpTriggerType =
  | "post_showing"
  | "inactive_buyer"
  | "similar_favorites";

export interface FollowUpTrigger {
  type: FollowUpTriggerType;
  /** Property address for post_showing */
  propertyAddress?: string;
  /** Area name for inactive_buyer or similar_favorites */
  area?: string;
  /** Number of similar listings found */
  newListingCount?: number;
  /** Days since last activity for inactive_buyer */
  daysSinceActivity?: number;
}

interface FollowUpResult {
  subject: string;
  body: string;
}

interface Buyer {
  full_name: string;
  email?: string | null;
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional:
    "Write in a professional, confident tone. Be helpful and informative.",
  casual:
    "Write in a warm, approachable tone. Keep it conversational.",
  luxury:
    "Write in a refined, upscale tone. Be concise but elegant.",
  first_time_buyer:
    "Write in an encouraging, educational tone. Be patient and supportive.",
};

/**
 * Generate a follow-up email draft based on a trigger event.
 * Uses LLM if available, otherwise returns a template-based fallback.
 */
export async function generateFollowUp(
  buyer: Buyer,
  trigger: FollowUpTrigger,
  agentTone: string
): Promise<FollowUpResult> {
  const firstName = buyer.full_name.split(" ")[0];

  // Fallback templates if no LLM available
  if (!isLLMAvailable("follow_up_generation")) {
    return buildFallbackFollowUp(firstName, trigger);
  }

  const toneInstruction =
    TONE_INSTRUCTIONS[agentTone] || TONE_INSTRUCTIONS.professional;

  const systemPrompt = `You are a real estate agent's assistant writing a follow-up email to a buyer client.
${toneInstruction}

Rules:
- Address the buyer by first name
- Keep the email under 150 words
- Be genuine, not salesy
- Include a clear call-to-action (reply, schedule a call, etc.)
- Do NOT include a signature — the agent's email client handles that
- Output ONLY the email body, no subject line

The agent will review and edit this draft before sending.`;

  const userPrompt = buildTriggerPrompt(firstName, trigger);

  try {
    const body = await llmComplete(
      "follow_up_generation",
      systemPrompt,
      userPrompt,
      { maxTokens: 512, temperature: 0.7 }
    );

    const subject = buildSubject(firstName, trigger);

    return {
      subject,
      body: body.trim() + "\n\n---\nPowered by FoyerFind",
    };
  } catch (err) {
    console.error("[follow-ups] LLM generation failed:", err);
    return buildFallbackFollowUp(firstName, trigger);
  }
}

function buildTriggerPrompt(
  firstName: string,
  trigger: FollowUpTrigger
): string {
  switch (trigger.type) {
    case "post_showing":
      return `Write a follow-up email to ${firstName} after they just toured ${trigger.propertyAddress || "a property"}. Ask for their thoughts on the property, remind them of key details, and offer to answer any questions or schedule another showing.`;

    case "inactive_buyer":
      return `Write a check-in email to ${firstName} who hasn't been active in ${trigger.daysSinceActivity || 5}+ days. ${trigger.area ? `They were looking at homes around ${trigger.area}.` : ""} Gently ask if they're still searching, mention you have new options, and invite them to reconnect.`;

    case "similar_favorites":
      return `Write an email to ${firstName} who has favorited several properties in ${trigger.area || "the same neighborhood"}. Let them know you noticed their interest and found ${trigger.newListingCount || "a few"} more listings in that area. Encourage them to check the new options on their dashboard.`;
  }
}

function buildSubject(
  firstName: string,
  trigger: FollowUpTrigger
): string {
  switch (trigger.type) {
    case "post_showing":
      return `How did you like ${trigger.propertyAddress || "the showing"}?`;
    case "inactive_buyer":
      return `Checking in, ${firstName}`;
    case "similar_favorites":
      return `More listings in ${trigger.area || "your favorite area"}`;
  }
}

function buildFallbackFollowUp(
  firstName: string,
  trigger: FollowUpTrigger
): FollowUpResult {
  switch (trigger.type) {
    case "post_showing":
      return {
        subject: `How did you like ${trigger.propertyAddress || "the showing"}?`,
        body: `Hi ${firstName},\n\nThank you for touring ${trigger.propertyAddress || "the property"} today! I'd love to hear your thoughts.\n\nDid anything stand out to you? Any concerns or questions I can help with?\n\nIf you'd like to schedule another visit or see similar properties, just let me know.\n\nLooking forward to hearing from you!\n\n---\nPowered by FoyerFind`,
      };

    case "inactive_buyer":
      return {
        subject: `Checking in, ${firstName}`,
        body: `Hey ${firstName},\n\nJust wanted to check in — I noticed it's been a few days since we last connected. ${trigger.area ? `Still interested in homes around ${trigger.area}?` : "Are you still looking?"}\n\nI have some new listings that might be a great fit. Let me know if you'd like to take a look!\n\n---\nPowered by FoyerFind`,
      };

    case "similar_favorites":
      return {
        subject: `More listings in ${trigger.area || "your favorite area"}`,
        body: `Hi ${firstName},\n\nI noticed you've been interested in properties in ${trigger.area || "a particular neighborhood"}. Great news — I found ${trigger.newListingCount || "a few"} more listings in that area that just came on the market!\n\nCheck your dashboard for the latest options. Let me know if any catch your eye and we can schedule showings.\n\n---\nPowered by FoyerFind`,
      };
  }
}
