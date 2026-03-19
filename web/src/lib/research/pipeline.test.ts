import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies
const mockFrom = vi.fn();
const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockSupabase,
}));

vi.mock("@/lib/gmail/tokens", () => ({
  getAuthedClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/gmail/drafts", () => ({
  createGmailDraft: vi.fn().mockResolvedValue("draft-id-123"),
}));

vi.mock("@/lib/rentcast/client", () => ({
  getPropertyByAddress: vi.fn(),
  getValueEstimate: vi.fn(),
}));

vi.mock("@/lib/enrichment/service", () => ({
  enrichProperty: vi.fn(),
}));

vi.mock("./brief-generator", () => ({
  generateBrief: vi.fn(),
}));

vi.mock("./address-extractor", () => ({
  geocodioValidate: vi.fn(),
}));

vi.mock("@/lib/supabase/activity", () => ({
  createActivityEntry: vi.fn().mockResolvedValue("activity-1"),
}));

import { processAddress } from "./pipeline";
import { getPropertyByAddress, getValueEstimate } from "@/lib/rentcast/client";
import { enrichProperty } from "@/lib/enrichment/service";
import { generateBrief } from "./brief-generator";
import { geocodioValidate } from "./address-extractor";
import { createGmailDraft } from "@/lib/gmail/drafts";
import { createActivityEntry } from "@/lib/supabase/activity";

describe("Research Pipeline", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Default mock chain for supabase operations
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          ilike: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
          single: vi.fn().mockResolvedValue({
            data: { voice_tone: "professional", email: "agent@test.com" },
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "prop-new-1" },
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    // Default geocodio response
    vi.mocked(geocodioValidate).mockResolvedValue({
      formatted: "123 Main St, Austin, TX 78701",
      lat: 30.267,
      lng: -97.743,
      city: "Austin",
      state: "TX",
      zip: "78701",
    });

    // Default RentCast responses
    vi.mocked(getPropertyByAddress).mockResolvedValue({
      id: "rc-1",
      formattedAddress: "123 Main St, Austin, TX 78701",
      addressLine1: "123 Main St",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      county: "Travis",
      latitude: 30.267,
      longitude: -97.743,
      propertyType: "Single Family",
      bedrooms: 3,
      bathrooms: 2,
      squareFootage: 1800,
      lotSize: 5000,
      yearBuilt: 2005,
      lastSaleDate: null,
      lastSalePrice: null,
      ownerOccupied: null,
      taxAssessedValue: null,
      legalDescription: null,
      features: {},
    });

    vi.mocked(getValueEstimate).mockResolvedValue({
      price: 440000,
      priceRangeLow: 410000,
      priceRangeHigh: 470000,
      confidenceScore: 88,
      comparables: [],
      address: "123 Main St, Austin, TX 78701",
    });

    // Default enrichment
    vi.mocked(enrichProperty).mockResolvedValue({
      enrichment: { enriched_at: new Date().toISOString() },
      providerResults: { succeeded: ["walkscore"], failed: [], cached: [] },
    });

    // Default brief generation
    vi.mocked(generateBrief).mockResolvedValue({
      content: "Research brief content",
      simplified_content: "Simple version",
      confidence: "high",
      data_sources: ["RentCast AVM", "Walk Score"],
      comp_count: 3,
    });

    // Mock brief insert to return id and token
    const briefInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "brief-1", public_token: "abc123token" },
        }),
      }),
    });

    // We need to handle different table calls differently
    mockFrom.mockImplementation((table: string) => {
      if (table === "research_briefs") {
        return {
          insert: briefInsert,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "agents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { voice_tone: "professional", email: "agent@test.com" },
              }),
            }),
          }),
        };
      }
      if (table === "properties") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "prop-new-1" },
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("runs the full pipeline: geocodio → rentcast → enrich → brief → save", async () => {
    const result = await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St, Austin TX", context: "showing" },
      triggerType: "email",
    });

    // Pipeline should complete
    expect(geocodioValidate).toHaveBeenCalledWith("123 Main St, Austin TX");
    expect(getPropertyByAddress).toHaveBeenCalled();
    expect(getValueEstimate).toHaveBeenCalled();
    expect(enrichProperty).toHaveBeenCalledWith(30.267, -97.743, "123 Main St, Austin, TX 78701");
    expect(generateBrief).toHaveBeenCalled();
    expect(createActivityEntry).toHaveBeenCalled();
  });

  it("calls RentCast in parallel for property data and valuation", async () => {
    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St", context: "general" },
      triggerType: "manual",
    });

    // Both should be called
    expect(getPropertyByAddress).toHaveBeenCalledTimes(1);
    expect(getValueEstimate).toHaveBeenCalledTimes(1);
  });

  it("creates Gmail draft when buyer email provided", async () => {
    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St", context: "showing" },
      triggerType: "email",
      buyerEmail: "buyer@test.com",
      buyerId: "buyer-1",
    });

    expect(createGmailDraft).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(createGmailDraft).mock.calls[0];
    expect(callArgs[1].to).toBe("buyer@test.com");
    expect(callArgs[1].subject).toContain("Research Brief");
  });

  it("does not create Gmail draft when no buyer email", async () => {
    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St", context: "showing" },
      triggerType: "email",
    });

    expect(createGmailDraft).not.toHaveBeenCalled();
  });

  it("continues when geocodio fails (uses raw address)", async () => {
    vi.mocked(geocodioValidate).mockResolvedValue(null);

    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St, Austin TX", context: "general" },
      triggerType: "manual",
    });

    // Should still call RentCast with the raw address
    expect(getPropertyByAddress).toHaveBeenCalledWith("123 Main St, Austin TX");
    expect(generateBrief).toHaveBeenCalled();
  });

  it("continues when RentCast fails", async () => {
    vi.mocked(getPropertyByAddress).mockResolvedValue(null);
    vi.mocked(getValueEstimate).mockResolvedValue(null);

    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St", context: "general" },
      triggerType: "manual",
    });

    // Should still generate a brief (with less data)
    expect(generateBrief).toHaveBeenCalled();
  });

  it("continues when enrichment fails", async () => {
    vi.mocked(enrichProperty).mockRejectedValue(new Error("Enrichment failed"));

    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St", context: "general" },
      triggerType: "manual",
    });

    // Should still generate a brief
    expect(generateBrief).toHaveBeenCalled();
  });

  it("logs activity entry after completion", async () => {
    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St", context: "showing" },
      triggerType: "email",
      triggerSourceId: "msg-123",
    });

    expect(createActivityEntry).toHaveBeenCalledWith(
      "agent-1",
      "research_completed",
      expect.stringContaining("Research brief"),
      expect.any(String),
      expect.objectContaining({
        trigger_type: "email",
        confidence: "high",
      }),
      expect.any(Object)
    );
  });

  it("passes agent voice tone to brief generator", async () => {
    await processAddress({
      agentId: "agent-1",
      address: { address: "123 Main St", context: "general" },
      triggerType: "manual",
    });

    expect(generateBrief).toHaveBeenCalledWith(
      expect.any(Object),      // property
      expect.anything(),        // enrichment
      expect.anything(),        // rentcast valuation
      expect.anything(),        // rentcast property
      "professional"            // voice tone from mock agent
    );
  });
});
