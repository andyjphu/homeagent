import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase SSR
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}));

// We can't easily test the middleware function directly due to Next.js types,
// so we test the routing logic by simulating URL matching.

describe("Middleware Public Routes", () => {
  const PUBLIC_ROUTES = [
    "/login",
    "/signup",
    "/start",
    "/api/auth/callback",
    "/api/email/callback",
    "/api/calendar/callback",
    "/api/calendar/availability/check",
    "/buyer/register",
    "/p/abc123",
    "/p/some-long-token/details",
    "/d/abc123",
    "/d/some-long-token/details",
    "/api/dashboard/token123/search",
    "/api/calls/inbound",
    "/api/calls/process",
    "/api/calls/voice-agent/webhook",
    "/api/properties/search/status",
    "/api/properties/test-enrich",
    "/api/notifications/check-deadlines",
    "/api/notifications/flush-queue",
    // NEW public routes from this PR
    "/r/abc123def456",
    "/r/some-brief-token",
    "/api/research/address",
  ];

  const PROTECTED_ROUTES = [
    "/app",
    "/app/research",
    "/app/inbox",
    "/app/clients",
    "/app/connections",
    "/app/settings",
    "/api/email/scan",
    "/api/email/send",
    "/api/research/wow",
    "/api/research/process",
    "/api/properties",
    "/settings",
    "/deals",
  ];

  // Simulate the isPublicRoute logic from middleware.ts
  function isPublicRoute(pathname: string): boolean {
    return (
      pathname.startsWith("/login") ||
      pathname.startsWith("/signup") ||
      pathname.startsWith("/start") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/email/callback") ||
      pathname.startsWith("/api/calendar/callback") ||
      pathname.startsWith("/api/calendar/availability") ||
      pathname.startsWith("/buyer") ||
      pathname.startsWith("/p/") ||
      pathname.startsWith("/d/") ||
      pathname.startsWith("/api/dashboard") ||
      pathname.startsWith("/api/calls/inbound") ||
      pathname.startsWith("/api/calls/process") ||
      pathname.startsWith("/api/calls/voice-agent/webhook") ||
      pathname.startsWith("/api/properties/search/status") ||
      pathname.startsWith("/api/properties/test-enrich") ||
      pathname.startsWith("/api/notifications/check-deadlines") ||
      pathname.startsWith("/api/notifications/flush-queue") ||
      pathname.startsWith("/r/") ||
      pathname.startsWith("/api/research/address")
    );
  }

  describe("public routes are accessible without auth", () => {
    for (const route of PUBLIC_ROUTES) {
      it(`${route} is public`, () => {
        expect(isPublicRoute(route)).toBe(true);
      });
    }
  });

  describe("protected routes require auth", () => {
    for (const route of PROTECTED_ROUTES) {
      it(`${route} is protected`, () => {
        expect(isPublicRoute(route)).toBe(false);
      });
    }
  });

  describe("critical: research brief page is public", () => {
    it("/r/[any-token] is publicly accessible", () => {
      expect(isPublicRoute("/r/abc123")).toBe(true);
      expect(isPublicRoute("/r/a1b2c3d4e5f6g7h8")).toBe(true);
      expect(isPublicRoute("/r/very-long-hex-token-string")).toBe(true);
    });
  });

  describe("critical: research address endpoint is public", () => {
    it("/api/research/address is publicly accessible (internal fire-and-forget)", () => {
      expect(isPublicRoute("/api/research/address")).toBe(true);
    });
  });

  describe("critical: WOW endpoint requires auth", () => {
    it("/api/research/wow is protected", () => {
      expect(isPublicRoute("/api/research/wow")).toBe(false);
    });
  });
});
