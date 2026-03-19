import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDraftsCreate = vi.fn();

vi.mock("googleapis", () => {
  return {
    google: {
      gmail: () => ({
        users: {
          drafts: {
            create: mockDraftsCreate,
          },
        },
      }),
    },
  };
});

import { createGmailDraft } from "./drafts";

describe("Gmail Drafts", () => {
  const mockAuth = {} as any;

  beforeEach(() => {
    mockDraftsCreate.mockReset();
  });

  it("creates a draft with correct parameters", async () => {
    mockDraftsCreate.mockResolvedValueOnce({
      data: { id: "draft-123" },
    });

    const draftId = await createGmailDraft(mockAuth, {
      to: "buyer@example.com",
      subject: "Research Brief: 123 Main St",
      htmlBody: "<h1>Research Brief</h1><p>Details...</p>",
    });

    expect(draftId).toBe("draft-123");
    expect(mockDraftsCreate).toHaveBeenCalledWith({
      userId: "me",
      requestBody: {
        message: {
          raw: expect.any(String),
        },
      },
    });
  });

  it("includes To and Subject in RFC 2822 message", async () => {
    mockDraftsCreate.mockResolvedValueOnce({
      data: { id: "draft-456" },
    });

    await createGmailDraft(mockAuth, {
      to: "test@example.com",
      subject: "Test Subject",
      htmlBody: "<p>Body</p>",
    });

    const rawMessage = mockDraftsCreate.mock.calls[0][0].requestBody.message.raw;
    const decoded = Buffer.from(rawMessage, "base64url").toString("utf-8");

    expect(decoded).toContain("To: test@example.com");
    expect(decoded).toContain("Subject: Test Subject");
    expect(decoded).toContain("MIME-Version: 1.0");
    expect(decoded).toContain("text/html");
    expect(decoded).toContain("<p>Body</p>");
  });

  it("includes From header when provided", async () => {
    mockDraftsCreate.mockResolvedValueOnce({
      data: { id: "draft-789" },
    });

    await createGmailDraft(mockAuth, {
      to: "buyer@example.com",
      subject: "Brief",
      htmlBody: "<p>Content</p>",
      from: "agent@realty.com",
    });

    const rawMessage = mockDraftsCreate.mock.calls[0][0].requestBody.message.raw;
    const decoded = Buffer.from(rawMessage, "base64url").toString("utf-8");

    expect(decoded).toContain("From: agent@realty.com");
  });

  it("omits From header when not provided", async () => {
    mockDraftsCreate.mockResolvedValueOnce({
      data: { id: "draft-000" },
    });

    await createGmailDraft(mockAuth, {
      to: "buyer@example.com",
      subject: "Brief",
      htmlBody: "<p>Content</p>",
    });

    const rawMessage = mockDraftsCreate.mock.calls[0][0].requestBody.message.raw;
    const decoded = Buffer.from(rawMessage, "base64url").toString("utf-8");

    expect(decoded).not.toContain("From:");
  });

  it("returns empty string when API returns no id", async () => {
    mockDraftsCreate.mockResolvedValueOnce({
      data: {},
    });

    const draftId = await createGmailDraft(mockAuth, {
      to: "buyer@example.com",
      subject: "Brief",
      htmlBody: "<p>Content</p>",
    });

    expect(draftId).toBe("");
  });

  it("propagates API errors", async () => {
    mockDraftsCreate.mockRejectedValueOnce(new Error("Gmail API error"));

    await expect(
      createGmailDraft(mockAuth, {
        to: "buyer@example.com",
        subject: "Brief",
        htmlBody: "<p>Content</p>",
      })
    ).rejects.toThrow("Gmail API error");
  });

  it("uses base64url encoding (URL-safe)", async () => {
    mockDraftsCreate.mockResolvedValueOnce({
      data: { id: "draft-enc" },
    });

    await createGmailDraft(mockAuth, {
      to: "buyer@example.com",
      subject: "Research Brief: Tëst Ünïcödé",
      htmlBody: "<p>Special chars: é à ü ö</p>",
    });

    const rawMessage = mockDraftsCreate.mock.calls[0][0].requestBody.message.raw;

    // base64url should NOT contain + or /
    expect(rawMessage).not.toMatch(/[+/]/);
  });
});
