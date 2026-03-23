import type { Json } from "@/types/database";

/** Document requirements by deal stage for compliance tracking */
export const STAGE_DOCUMENT_REQUIREMENTS: Record<string, string[]> = {
  touring: ["buyer-broker agreement"],
  pre_offer: ["pre-approval letter"],
  negotiating: ["offer letter"],
  under_contract: ["purchase agreement", "earnest money receipt"],
  inspection: ["inspection report"],
  closing: ["closing disclosure", "title insurance"],
};

/** All required document names across all stages */
export const ALL_REQUIRED_DOCUMENTS = Object.values(STAGE_DOCUMENT_REQUIREMENTS).flat();

/**
 * Get effective brand settings for an agent.
 * Cascade: agent.brand_settings > brokerage.brand_colors > empty
 */
export function getEffectiveBranding(
  agentBrandSettings: Json | null | undefined,
  brokerageBrandColors: Json | null | undefined
): { primaryColor?: string; accentColor?: string; logoUrl?: string } {
  const agentBrand = (agentBrandSettings ?? {}) as Record<string, unknown>;
  const brokerageBrand = (brokerageBrandColors ?? {}) as Record<string, unknown>;

  // Agent settings take priority if they have any values set
  const hasAgentBrand = Object.keys(agentBrand).length > 0 &&
    (agentBrand.primaryColor || agentBrand.accentColor || agentBrand.logoUrl);

  if (hasAgentBrand) {
    return {
      primaryColor: agentBrand.primaryColor as string | undefined,
      accentColor: agentBrand.accentColor as string | undefined,
      logoUrl: agentBrand.logoUrl as string | undefined,
    };
  }

  return {
    primaryColor: brokerageBrand.primaryColor as string | undefined,
    accentColor: brokerageBrand.accentColor as string | undefined,
    logoUrl: brokerageBrand.logoUrl as string | undefined,
  };
}

/**
 * Calculate expected commission amount from deal price.
 */
export function calculateCommission(
  commissionType: "percentage" | "flat_fee",
  commissionValue: number,
  agreedPrice: number | null
): number | null {
  if (commissionType === "flat_fee") {
    return commissionValue;
  }
  if (commissionType === "percentage" && agreedPrice != null) {
    return agreedPrice * (commissionValue / 100);
  }
  return null;
}

/**
 * Get documents required up to and including the current deal stage.
 */
export function getRequiredDocumentsForStage(stage: string): string[] {
  const stageOrder = [
    "prospecting",
    "touring",
    "pre_offer",
    "negotiating",
    "under_contract",
    "inspection",
    "appraisal",
    "closing",
    "closed",
  ];

  const currentIndex = stageOrder.indexOf(stage);
  if (currentIndex === -1) return [];

  const docs: string[] = [];
  for (let i = 0; i <= currentIndex; i++) {
    const stageDocs = STAGE_DOCUMENT_REQUIREMENTS[stageOrder[i]];
    if (stageDocs) docs.push(...stageDocs);
  }
  return docs;
}
