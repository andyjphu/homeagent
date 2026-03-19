import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/llm/router", () => ({
  llmComplete: vi.fn(),
  isLLMAvailable: vi.fn(),
}));

import { generateBrief } from "./brief-generator";
import { llmComplete, isLLMAvailable } from "@/lib/llm/router";
import type { PropertyEnrichment } from "@/lib/enrichment/types";
import type { RentCastValuation, RentCastProperty } from "@/lib/rentcast/client";

const baseProperty = {
  address: "123 Main St, Austin, TX 78701",
  beds: 3,
  baths: 2,
  sqft: 1800,
  year_built: 2005,
  lot_sqft: 5000,
  listing_price: 450000,
  property_type: "Single Family",
};

const mockEnrichment: PropertyEnrichment = {
  enriched_at: "2026-01-01T00:00:00Z",
  walkability: {
    walk_score: 78,
    transit_score: 55,
    bike_score: 65,
    description: "Very Walkable",
    ws_link: "https://walkscore.com/...",
  },
  flood: {
    zone: "X",
    risk_level: "low",
    insurance_required: false,
  },
  schools: {
    nearby: [
      { name: "Austin Elementary", type: "public", grades: "K-5", distance_miles: 0.3 },
      { name: "Travis Middle", type: "public", grades: "6-8", distance_miles: 0.8 },
    ],
    source: "nces",
  },
  crime: {
    safety_score: 72,
    violent_crime_rate: 3.2,
    property_crime_rate: 15.6,
    source: "fbi_ucr",
  },
  air_quality: { aqi: 42, category: "Good" },
  broadband: { fiber_available: true, max_download_mbps: 1000, isp_count: 5, providers: ["AT&T", "Spectrum"] },
  demographics: { median_income: 75000, median_home_value: 480000, population: 12500, owner_occupied_pct: 62, median_age: 34 },
  amenities: { grocery_count: 8, restaurant_count: 45, park_count: 6, hospital_count: 2, nearest_grocery_miles: 0.4 },
};

const mockValuation: RentCastValuation = {
  price: 440000,
  priceRangeLow: 410000,
  priceRangeHigh: 470000,
  confidenceScore: 88,
  comparables: [
    { formattedAddress: "125 Main St", price: 435000, squareFootage: 1750, bedrooms: 3, bathrooms: 2, distance: 0.1, daysOld: 20 },
    { formattedAddress: "130 Elm St", price: 450000, squareFootage: 1900, bedrooms: 3, bathrooms: 2, distance: 0.3, daysOld: 35 },
    { formattedAddress: "200 Oak Ave", price: 425000, squareFootage: 1650, bedrooms: 3, bathrooms: 2, distance: 0.5, daysOld: 50 },
  ],
  address: "123 Main St, Austin, TX 78701",
};

const mockRentcastProperty: RentCastProperty = {
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
};

describe("Brief Generator", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("with LLM available", () => {
    it("generates a brief using LLM with all data sources", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmComplete)
        .mockResolvedValueOnce("This is the detailed research brief for 123 Main St...")
        .mockResolvedValueOnce("This is the simplified version...");

      const result = await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "professional");

      expect(result.content).toBe("This is the detailed research brief for 123 Main St...");
      expect(result.simplified_content).toBe("This is the simplified version...");
      expect(result.confidence).toBe("high"); // 10 data sources
      expect(result.comp_count).toBe(3);
      expect(result.data_sources).toContain("RentCast AVM");
      expect(result.data_sources).toContain("Walk Score");
      expect(result.data_sources).toContain("FEMA Flood Maps");
      expect(result.data_sources).toContain("NCES Schools");
      expect(result.data_sources).toContain("FBI Crime Data");
      expect(result.data_sources).toContain("AirNow");
      expect(result.data_sources).toContain("FCC Broadband");
      expect(result.data_sources).toContain("US Census");
      expect(result.data_sources).toContain("Google Maps");
    });

    it("calls LLM twice: once for brief, once for simplification", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmComplete)
        .mockResolvedValueOnce("detailed brief")
        .mockResolvedValueOnce("simplified brief");

      await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "professional");

      expect(llmComplete).toHaveBeenCalledTimes(2);
      // First call: brief_generation
      expect(llmComplete).toHaveBeenNthCalledWith(
        1,
        "brief_generation",
        expect.any(String),
        expect.stringContaining("123 Main St"),
        expect.any(Object)
      );
      // Second call: brief_simplification
      expect(llmComplete).toHaveBeenNthCalledWith(
        2,
        "brief_simplification",
        expect.stringContaining("plain language"),
        "detailed brief",
        expect.any(Object)
      );
    });

    it("uses original content when simplification fails", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmComplete)
        .mockResolvedValueOnce("detailed brief content")
        .mockRejectedValueOnce(new Error("simplification failed"));

      const result = await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "professional");

      expect(result.content).toBe("detailed brief content");
      expect(result.simplified_content).toBe("detailed brief content");
    });

    it("injects agent voice tone into system prompt", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmComplete).mockResolvedValue("brief");

      await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "luxury");

      const systemPrompt = vi.mocked(llmComplete).mock.calls[0][1];
      expect(systemPrompt).toContain("refined, upscale tone");
    });

    it("uses first_time_buyer tone correctly", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmComplete).mockResolvedValue("brief");

      await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "first_time_buyer");

      const systemPrompt = vi.mocked(llmComplete).mock.calls[0][1];
      expect(systemPrompt).toContain("encouraging, educational tone");
    });

    it("uses casual tone correctly", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmComplete).mockResolvedValue("brief");

      await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "casual");

      const systemPrompt = vi.mocked(llmComplete).mock.calls[0][1];
      expect(systemPrompt).toContain("warm, approachable tone");
    });
  });

  describe("confidence level", () => {
    it("returns high confidence when 6+ data sources", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "professional");
      expect(result.confidence).toBe("high");
    });

    it("returns medium confidence when 3-5 data sources", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const partialEnrichment: PropertyEnrichment = {
        enriched_at: "2026-01-01T00:00:00Z",
        walkability: mockEnrichment.walkability,
        // Only walkability — plus RentCast AVM + Property = 3 sources
      };

      const result = await generateBrief(baseProperty, partialEnrichment, mockValuation, mockRentcastProperty, "professional");
      expect(result.confidence).toBe("medium");
    });

    it("returns low confidence when <3 data sources", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, null, null, null, "professional");
      expect(result.confidence).toBe("low");
    });
  });

  describe("fallback (no LLM)", () => {
    it("generates structured fallback brief", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "professional");

      expect(result.content).toContain("123 Main St");
      expect(result.content).toContain("3 bed");
      expect(result.content).toContain("$440,000");
      expect(result.content).toContain("Walk Score: 78");
      expect(result.simplified_content).toBe(result.content); // same for fallback
    });

    it("handles missing enrichment and RentCast data", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, null, null, null, "professional");

      expect(result.content).toContain("123 Main St");
      expect(result.content).toContain("$450,000"); // listing price
      expect(result.data_sources).toHaveLength(0);
      expect(result.comp_count).toBe(0);
    });

    it("falls back to structured brief when LLM generation fails", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmComplete).mockRejectedValue(new Error("LLM error"));

      const result = await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "professional");

      // Should get fallback content, not throw
      expect(result.content).toContain("123 Main St");
      expect(result.confidence).toBe("high");
    });
  });

  describe("data source tracking", () => {
    it("lists all data sources when everything available", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, mockEnrichment, mockValuation, mockRentcastProperty, "professional");

      expect(result.data_sources).toEqual(expect.arrayContaining([
        "RentCast AVM",
        "RentCast Property Data",
        "Walk Score",
        "FEMA Flood Maps",
        "NCES Schools",
        "FBI Crime Data",
        "AirNow",
        "FCC Broadband",
        "US Census",
        "Google Maps",
      ]));
    });

    it("excludes missing data sources", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, null, null, null, "professional");

      expect(result.data_sources).not.toContain("RentCast AVM");
      expect(result.data_sources).not.toContain("Walk Score");
    });

    it("tracks comp count from valuation", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, null, mockValuation, null, "professional");
      expect(result.comp_count).toBe(3);
    });

    it("comp count is 0 when no valuation", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await generateBrief(baseProperty, null, null, null, "professional");
      expect(result.comp_count).toBe(0);
    });
  });
});
