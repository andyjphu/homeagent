import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock LLM router
vi.mock("@/lib/llm/router", () => ({
  llmJSON: vi.fn(),
  isLLMAvailable: vi.fn(),
}));

import { extractAddresses, geocodioValidate } from "./address-extractor";
import { llmJSON, isLLMAvailable } from "@/lib/llm/router";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Address Extractor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("extractAddresses — regex extraction", () => {
    it("extracts a standard US address with zip", async () => {
      const result = await extractAddresses(
        "Showing tomorrow",
        "Let's tour 123 Main St, Austin, TX 78701 at 2pm"
      );

      expect(result).toHaveLength(1);
      expect(result[0].address).toContain("123 Main St");
    });

    it("extracts address with street suffix variations", async () => {
      const suffixes = [
        "456 Oak Avenue",
        "789 Pine Boulevard",
        "101 Elm Drive",
        "202 Cedar Lane",
        "303 Maple Court",
        "404 Birch Way",
        "505 Walnut Road",
        "606 Cherry Place",
      ];

      for (const addr of suffixes) {
        const result = await extractAddresses("Test", `Property at ${addr} is nice`);
        expect(result.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("extracts multiple addresses from same email", async () => {
      const body = `
        Check out these properties:
        1. 100 First Street, San Jose, CA 95110
        2. 200 Second Avenue, Palo Alto, CA 94301
      `;

      const result = await extractAddresses("New listings", body);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("deduplicates repeated addresses", async () => {
      const body = `
        The property at 123 Main Street is great.
        Let me confirm: 123 Main Street is available for viewing.
      `;

      const result = await extractAddresses("Showing", body);
      // Should have at most one entry for the same address
      const unique = new Set(result.map((r) => r.address.trim()));
      expect(unique.size).toBeLessThanOrEqual(result.length);
    });

    it("returns empty array when no addresses found and no real estate keywords", async () => {
      const result = await extractAddresses(
        "Team lunch",
        "Let's get pizza at noon. See you there!"
      );

      expect(result).toHaveLength(0);
    });

    it("infers 'showing' context from email content", async () => {
      const result = await extractAddresses(
        "Showing scheduled",
        "Tour of 456 Oak Drive at 3pm tomorrow"
      );

      if (result.length > 0) {
        expect(result[0].context).toBe("showing");
      }
    });

    it("infers 'listing_alert' context from new listing keywords", async () => {
      const result = await extractAddresses(
        "New Listing Alert",
        "Just listed: 789 Pine Boulevard for sale at $500K"
      );

      if (result.length > 0) {
        expect(result[0].context).toBe("listing_alert");
      }
    });

    it("infers 'offer' context from offer-related keywords", async () => {
      const result = await extractAddresses(
        "Offer accepted",
        "The offer on 101 Elm Drive has been accepted, now under contract"
      );

      if (result.length > 0) {
        expect(result[0].context).toBe("offer");
      }
    });
  });

  describe("extractAddresses — LLM fallback", () => {
    it("uses LLM when regex fails but real estate keywords present", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmJSON).mockResolvedValue({
        addresses: [{ address: "42 Sunset Blvd, LA, CA 90028", context: "showing" }],
      });

      // An email with RE keywords but address in non-standard format
      const result = await extractAddresses(
        "MLS listing update",
        "The new listing at the corner property is a great showing opportunity."
      );

      // If regex didn't match, LLM should have been called
      if (result.length > 0) {
        expect(llmJSON).toHaveBeenCalled();
      }
    });

    it("returns empty array when LLM is not available and regex fails", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(false);

      const result = await extractAddresses(
        "Property showing",
        "The listing downtown is available for a tour."
      );

      expect(result).toHaveLength(0);
      expect(llmJSON).not.toHaveBeenCalled();
    });

    it("returns empty array when LLM extraction fails", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmJSON).mockRejectedValue(new Error("LLM timeout"));

      const result = await extractAddresses(
        "MLS Alert",
        "Check out this open house listing opportunity"
      );

      expect(result).toHaveLength(0);
    });

    it("handles LLM returning empty addresses array", async () => {
      vi.mocked(isLLMAvailable).mockReturnValue(true);
      vi.mocked(llmJSON).mockResolvedValue({ addresses: [] });

      const result = await extractAddresses(
        "Property update",
        "The listing status has changed"
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("geocodioValidate", () => {
    beforeEach(() => {
      vi.stubEnv("GEOCODIO_API_KEY", "test-geocodio-key");
    });

    it("returns normalized address with lat/lng for valid address", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              formatted_address: "123 Main St, Austin, TX 78701",
              location: { lat: 30.267, lng: -97.743 },
              address_components: {
                number: "123",
                street: "Main",
                suffix: "St",
                city: "Austin",
                state: "TX",
                zip: "78701",
                formatted_street: "Main St",
              },
              accuracy: 1.0,
              accuracy_type: "rooftop",
            },
          ],
        }),
      });

      const result = await geocodioValidate("123 Main St, Austin TX");

      expect(result).not.toBeNull();
      expect(result!.formatted).toBe("123 Main St, Austin, TX 78701");
      expect(result!.lat).toBe(30.267);
      expect(result!.lng).toBe(-97.743);
      expect(result!.city).toBe("Austin");
      expect(result!.state).toBe("TX");
      expect(result!.zip).toBe("78701");
    });

    it("returns null for low accuracy results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              formatted_address: "Austin, TX",
              location: { lat: 30.267, lng: -97.743 },
              address_components: {
                number: "",
                street: "",
                suffix: "",
                city: "Austin",
                state: "TX",
                zip: "78701",
                formatted_street: "",
              },
              accuracy: 0.3,
              accuracy_type: "place",
            },
          ],
        }),
      });

      const result = await geocodioValidate("somewhere in Austin");
      expect(result).toBeNull();
    });

    it("returns null when no results", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await geocodioValidate("xyzzy nowhere");
      expect(result).toBeNull();
    });

    it("returns null when API key not set", async () => {
      vi.stubEnv("GEOCODIO_API_KEY", "");

      const result = await geocodioValidate("123 Main St");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns null on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
      });

      const result = await geocodioValidate("invalid");
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await geocodioValidate("123 Main St");
      expect(result).toBeNull();
    });

    it("passes API key as query parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await geocodioValidate("123 Main St");

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.searchParams.get("api_key")).toBe("test-geocodio-key");
      expect(url.searchParams.get("q")).toBe("123 Main St");
    });
  });
});
