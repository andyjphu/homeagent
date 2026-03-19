import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock OpenAI as a class constructor
const mockCreate = vi.fn();
let lastConstructorOpts: any = null;

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: mockCreate } };
      constructor(opts: any) {
        lastConstructorOpts = opts;
      }
    },
  };
});

import { groqComplete, groqJSON } from "./groq";

describe("Groq LLM Provider", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
    mockCreate.mockReset();
    lastConstructorOpts = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("groqComplete", () => {
    it("returns text response from Groq", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Hello, this is Groq response." } }],
      });

      const result = await groqComplete("You are a helper.", "Say hello.");

      expect(result).toBe("Hello, this is Groq response.");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: "You are a helper." },
            { role: "user", content: "Say hello." },
          ],
        })
      );
    });

    it("uses default maxTokens and temperature", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "ok" } }],
      });

      await groqComplete("sys", "user");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 1024,
          temperature: 0.1,
        })
      );
    });

    it("respects custom options", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "ok" } }],
      });

      await groqComplete("sys", "user", { maxTokens: 512, temperature: 0.5 });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 512,
          temperature: 0.5,
        })
      );
    });

    it("returns empty string when no content", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      const result = await groqComplete("sys", "user");
      expect(result).toBe("");
    });

    it("creates client with correct base URL and API key", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "ok" } }],
      });

      await groqComplete("sys", "user");

      expect(lastConstructorOpts).toEqual({
        apiKey: "test-groq-key",
        baseURL: "https://api.groq.com/openai/v1",
      });
    });
  });

  describe("groqJSON", () => {
    it("returns parsed JSON from Groq", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                addresses: [{ address: "123 Main St", context: "showing" }],
              }),
            },
          },
        ],
      });

      const result = await groqJSON<{ addresses: any[] }>("sys", "user");

      expect(result.addresses).toHaveLength(1);
      expect(result.addresses[0].address).toBe("123 Main St");
    });

    it("uses json_object response format", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "{}" } }],
      });

      await groqJSON("sys", "user");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: "json_object" },
        })
      );
    });

    it("appends JSON instruction to system prompt", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "{}" } }],
      });

      await groqJSON("Base prompt", "user");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: "Base prompt\n\nRespond with valid JSON only.",
            }),
          ]),
        })
      );
    });

    it("returns empty object when content is null", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      const result = await groqJSON("sys", "user");
      expect(result).toEqual({});
    });
  });
});
