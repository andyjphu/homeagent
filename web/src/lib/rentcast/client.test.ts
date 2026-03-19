import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPropertyByAddress,
  getValueEstimate,
  getMarketStats,
} from "./client";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("RentCast Client", () => {
  beforeEach(() => {
    vi.stubEnv("RENTCAST_API_KEY", "test-key-123");
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getPropertyByAddress", () => {
    it("returns property data for a valid address", async () => {
      const mockProperty = {
        id: "prop-1",
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
        lastSaleDate: "2020-06-15",
        lastSalePrice: 350000,
        ownerOccupied: true,
        taxAssessedValue: 320000,
        legalDescription: null,
        features: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [mockProperty],
      });

      const result = await getPropertyByAddress("123 Main St, Austin, TX 78701");

      expect(result).not.toBeNull();
      expect(result!.formattedAddress).toBe("123 Main St, Austin, TX 78701");
      expect(result!.bedrooms).toBe(3);
      expect(result!.bathrooms).toBe(2);
      expect(result!.squareFootage).toBe(1800);
      expect(result!.yearBuilt).toBe(2005);

      // Verify correct API call
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toBe("/v1/properties");
      expect(url.searchParams.get("address")).toBe("123 Main St, Austin, TX 78701");

      // Verify headers
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["X-Api-Key"]).toBe("test-key-123");
    });

    it("returns null when API returns empty array", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const result = await getPropertyByAddress("999 Nonexistent St");
      expect(result).toBeNull();
    });

    it("returns null on 429 rate limit", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const result = await getPropertyByAddress("123 Main St");
      expect(result).toBeNull();
    });

    it("returns null on 500 server error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await getPropertyByAddress("123 Main St");
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await getPropertyByAddress("123 Main St");
      expect(result).toBeNull();
    });

    it("returns null when RENTCAST_API_KEY is not set", async () => {
      vi.stubEnv("RENTCAST_API_KEY", "");

      const result = await getPropertyByAddress("123 Main St");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("getValueEstimate", () => {
    it("returns valuation data for a valid address", async () => {
      const mockValuation = {
        price: 425000,
        priceRangeLow: 395000,
        priceRangeHigh: 455000,
        confidenceScore: 85,
        comparables: [
          {
            formattedAddress: "125 Main St",
            price: 420000,
            squareFootage: 1750,
            bedrooms: 3,
            bathrooms: 2,
            distance: 0.1,
            daysOld: 30,
          },
          {
            formattedAddress: "130 Elm St",
            price: 430000,
            squareFootage: 1900,
            bedrooms: 3,
            bathrooms: 2,
            distance: 0.3,
            daysOld: 45,
          },
        ],
        address: "123 Main St, Austin, TX 78701",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockValuation,
      });

      const result = await getValueEstimate("123 Main St, Austin, TX 78701");

      expect(result).not.toBeNull();
      expect(result!.price).toBe(425000);
      expect(result!.priceRangeLow).toBe(395000);
      expect(result!.priceRangeHigh).toBe(455000);
      expect(result!.confidenceScore).toBe(85);
      expect(result!.comparables).toHaveLength(2);

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toBe("/v1/avm/value");
      expect(url.searchParams.get("address")).toBe("123 Main St, Austin, TX 78701");
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: "Not Found" });

      const result = await getValueEstimate("nonexistent address");
      expect(result).toBeNull();
    });
  });

  describe("getMarketStats", () => {
    it("returns market data for a valid zip code", async () => {
      const mockMarket = {
        zipCode: "78701",
        medianPrice: 550000,
        medianRent: 2200,
        averageDaysOnMarket: 28,
        totalListings: 145,
        medianPricePerSqft: 305,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMarket,
      });

      const result = await getMarketStats("78701");

      expect(result).not.toBeNull();
      expect(result!.zipCode).toBe("78701");
      expect(result!.medianPrice).toBe(550000);
      expect(result!.medianRent).toBe(2200);
      expect(result!.averageDaysOnMarket).toBe(28);
      expect(result!.totalListings).toBe(145);

      const url = new URL(mockFetch.mock.calls[0][0]);
      expect(url.pathname).toBe("/v1/markets");
      expect(url.searchParams.get("zipCode")).toBe("78701");
    });

    it("returns null when API key not set", async () => {
      vi.stubEnv("RENTCAST_API_KEY", "");
      const result = await getMarketStats("78701");
      expect(result).toBeNull();
    });
  });
});
