import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all providers
vi.mock("./groq", () => ({
  groqComplete: vi.fn(),
  groqJSON: vi.fn(),
}));
vi.mock("./cerebras", () => ({
  cerebrasComplete: vi.fn(),
  cerebrasJSON: vi.fn(),
}));
vi.mock("./gemini", () => ({
  geminiComplete: vi.fn(),
  geminiJSON: vi.fn(),
}));

import { llmComplete, llmJSON, isLLMAvailable, type LLMTask } from "./router";
import { groqComplete, groqJSON } from "./groq";
import { cerebrasComplete, cerebrasJSON } from "./cerebras";
import { geminiComplete, geminiJSON } from "./gemini";

describe("LLM Router", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isLLMAvailable", () => {
    it("returns false when no keys set", () => {
      vi.stubEnv("GROQ_API_KEY", "");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");
      expect(isLLMAvailable()).toBe(false);
    });

    it("returns true when only Groq key set", () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");
      expect(isLLMAvailable()).toBe(true);
    });

    it("returns true when only Cerebras key set", () => {
      vi.stubEnv("GROQ_API_KEY", "");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "");
      expect(isLLMAvailable()).toBe(true);
    });

    it("returns true when only Gemini key set", () => {
      vi.stubEnv("GROQ_API_KEY", "");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "key");
      expect(isLLMAvailable()).toBe(true);
    });
  });

  describe("provider chain — fast tasks", () => {
    const FAST_TASKS: LLMTask[] = [
      "lead_classification",
      "email_classification",
      "address_extraction",
      "brief_generation",
      "brief_simplification",
    ];

    it("routes fast tasks to Groq first", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "key");

      vi.mocked(groqComplete).mockResolvedValue("groq response");

      for (const task of FAST_TASKS) {
        const result = await llmComplete(task, "sys", "user");
        expect(result).toBe("groq response");
      }

      expect(groqComplete).toHaveBeenCalledTimes(FAST_TASKS.length);
      expect(cerebrasComplete).not.toHaveBeenCalled();
      expect(geminiComplete).not.toHaveBeenCalled();
    });

    it("falls back to Cerebras when Groq rate-limits (429)", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "");

      const rateLimitError = new Error("Rate limited");
      (rateLimitError as any).status = 429;
      vi.mocked(groqComplete).mockRejectedValue(rateLimitError);
      vi.mocked(cerebrasComplete).mockResolvedValue("cerebras fallback");

      const result = await llmComplete("address_extraction", "sys", "user");
      expect(result).toBe("cerebras fallback");
    });

    it("falls back through full chain: Groq → Cerebras → Gemini", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "key");

      const rateLimitError = new Error("429");
      (rateLimitError as any).status = 429;
      vi.mocked(groqComplete).mockRejectedValue(rateLimitError);
      vi.mocked(cerebrasComplete).mockRejectedValue(rateLimitError);
      vi.mocked(geminiComplete).mockResolvedValue("gemini last resort");

      const result = await llmComplete("brief_generation", "sys", "user");
      expect(result).toBe("gemini last resort");
    });
  });

  describe("provider chain — complex tasks", () => {
    it("routes complex tasks to Gemini first", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "key");

      vi.mocked(geminiComplete).mockResolvedValue("gemini response");

      const result = await llmComplete("offer_strategy", "sys", "user");
      expect(result).toBe("gemini response");
      expect(geminiComplete).toHaveBeenCalledTimes(1);
      expect(groqComplete).not.toHaveBeenCalled();
      expect(cerebrasComplete).not.toHaveBeenCalled();
    });

    it("falls back from Gemini to Cerebras on 429", async () => {
      vi.stubEnv("GROQ_API_KEY", "");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "key");

      const rateLimitError = new Error("429");
      (rateLimitError as any).status = 429;
      vi.mocked(geminiComplete).mockRejectedValue(rateLimitError);
      vi.mocked(cerebrasComplete).mockResolvedValue("cerebras fallback");

      const result = await llmComplete("property_scoring", "sys", "user");
      expect(result).toBe("cerebras fallback");
    });
  });

  describe("llmJSON", () => {
    it("routes JSON fast tasks to Groq first", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");

      vi.mocked(groqJSON).mockResolvedValue({ result: "ok" });

      const result = await llmJSON("address_extraction", "sys", "user");
      expect(result).toEqual({ result: "ok" });
      expect(groqJSON).toHaveBeenCalledTimes(1);
    });

    it("falls back on rate limit for JSON", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "");

      const rateLimitError = new Error("429");
      (rateLimitError as any).status = 429;
      vi.mocked(groqJSON).mockRejectedValue(rateLimitError);
      vi.mocked(cerebrasJSON).mockResolvedValue({ fallback: true });

      const result = await llmJSON("email_classification", "sys", "user");
      expect(result).toEqual({ fallback: true });
    });
  });

  describe("error handling", () => {
    it("throws when no API keys configured", async () => {
      vi.stubEnv("GROQ_API_KEY", "");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");

      await expect(
        llmComplete("address_extraction", "sys", "user")
      ).rejects.toThrow("No LLM API keys configured");
    });

    it("throws non-429 errors without fallback", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "");

      const authError = new Error("Invalid API key");
      (authError as any).status = 401;
      vi.mocked(groqComplete).mockRejectedValue(authError);

      await expect(
        llmComplete("address_extraction", "sys", "user")
      ).rejects.toThrow("Invalid API key");

      // Should NOT have tried cerebras
      expect(cerebrasComplete).not.toHaveBeenCalled();
    });

    it("throws when all providers fail on 429", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "key");
      vi.stubEnv("GEMINI_API_KEY", "key");

      const rateLimitError = new Error("429");
      (rateLimitError as any).status = 429;
      vi.mocked(groqComplete).mockRejectedValue(rateLimitError);
      vi.mocked(cerebrasComplete).mockRejectedValue(rateLimitError);
      vi.mocked(geminiComplete).mockRejectedValue(rateLimitError);

      await expect(
        llmComplete("brief_generation", "sys", "user")
      ).rejects.toThrow("429");
    });
  });

  describe("new task types", () => {
    it("address_extraction is a recognized fast task", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");

      vi.mocked(groqComplete).mockResolvedValue("ok");

      await llmComplete("address_extraction", "sys", "user");
      expect(groqComplete).toHaveBeenCalled();
    });

    it("brief_generation is a recognized fast task", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");

      vi.mocked(groqComplete).mockResolvedValue("ok");

      await llmComplete("brief_generation", "sys", "user");
      expect(groqComplete).toHaveBeenCalled();
    });

    it("brief_simplification is a recognized fast task", async () => {
      vi.stubEnv("GROQ_API_KEY", "key");
      vi.stubEnv("CEREBRAS_API_KEY", "");
      vi.stubEnv("GEMINI_API_KEY", "");

      vi.mocked(groqComplete).mockResolvedValue("ok");

      await llmComplete("brief_simplification", "sys", "user");
      expect(groqComplete).toHaveBeenCalled();
    });
  });
});
