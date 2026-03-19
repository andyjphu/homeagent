import { cerebrasComplete, cerebrasJSON } from "./cerebras";
import { geminiComplete, geminiJSON } from "./gemini";
import { groqComplete, groqJSON } from "./groq";

export type LLMTask =
  | "lead_classification"
  | "email_classification"
  | "intent_signal_extraction"
  | "significance_check"
  | "temperature_assessment"
  | "property_scoring"
  | "email_composition"
  | "email_analysis"
  | "call_debrief"
  | "offer_strategy"
  | "counter_analysis"
  | "inspection_analysis"
  | "appraisal_scenarios"
  | "seller_motivation"
  | "address_extraction"
  | "brief_generation"
  | "brief_simplification";

type Provider = "groq" | "cerebras" | "gemini";

const FAST_TASKS: LLMTask[] = [
  "lead_classification",
  "email_classification",
  "intent_signal_extraction",
  "significance_check",
  "temperature_assessment",
  "address_extraction",
  "brief_generation",
  "brief_simplification",
];

function hasGroqKey(): boolean {
  return !!process.env.GROQ_API_KEY;
}

function hasCerebrasKey(): boolean {
  return !!process.env.CEREBRAS_API_KEY;
}

function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Check if any LLM provider is available for a given task.
 */
export function isLLMAvailable(task?: LLMTask): boolean {
  return hasGroqKey() || hasCerebrasKey() || hasGeminiKey();
}

/**
 * Get ordered provider chain for a task.
 * Fast tasks: Groq → Cerebras → Gemini
 * Complex tasks: Gemini → Cerebras → Groq
 */
function getProviderChain(task: LLMTask): Provider[] {
  const isFast = FAST_TASKS.includes(task);
  const chain: Provider[] = [];

  if (isFast) {
    if (hasGroqKey()) chain.push("groq");
    if (hasCerebrasKey()) chain.push("cerebras");
    if (hasGeminiKey()) chain.push("gemini");
  } else {
    if (hasGeminiKey()) chain.push("gemini");
    if (hasCerebrasKey()) chain.push("cerebras");
    if (hasGroqKey()) chain.push("groq");
  }

  return chain;
}

async function completeWithProvider(
  provider: Provider,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  switch (provider) {
    case "groq":
      return groqComplete(systemPrompt, userPrompt, options);
    case "cerebras":
      return cerebrasComplete(systemPrompt, userPrompt, options);
    case "gemini":
      return geminiComplete(systemPrompt, userPrompt, options);
  }
}

async function jsonWithProvider<T>(
  provider: Provider,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<T> {
  switch (provider) {
    case "groq":
      return groqJSON<T>(systemPrompt, userPrompt, options);
    case "cerebras":
      return cerebrasJSON<T>(systemPrompt, userPrompt, options);
    case "gemini":
      return geminiJSON<T>(systemPrompt, userPrompt, options);
  }
}

export async function llmComplete(
  task: LLMTask,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const chain = getProviderChain(task);
  if (chain.length === 0) {
    throw new Error("No LLM API keys configured. Set GROQ_API_KEY, CEREBRAS_API_KEY, or GEMINI_API_KEY.");
  }

  for (let i = 0; i < chain.length; i++) {
    try {
      return await completeWithProvider(chain[i], systemPrompt, userPrompt, options);
    } catch (err: any) {
      const isLast = i === chain.length - 1;
      if (isLast) throw err;
      // Only fall through on rate limit or transient errors
      if (err.status === 429 || err.message?.includes("429")) {
        console.warn(`[llm] ${chain[i]} failed (${err.status ?? "error"}), falling back to ${chain[i + 1]}`);
        continue;
      }
      throw err;
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error("No LLM provider succeeded");
}

export async function llmJSON<T>(
  task: LLMTask,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<T> {
  const chain = getProviderChain(task);
  if (chain.length === 0) {
    throw new Error("No LLM API keys configured. Set GROQ_API_KEY, CEREBRAS_API_KEY, or GEMINI_API_KEY.");
  }

  for (let i = 0; i < chain.length; i++) {
    try {
      return await jsonWithProvider<T>(chain[i], systemPrompt, userPrompt, options);
    } catch (err: any) {
      const isLast = i === chain.length - 1;
      if (isLast) throw err;
      if (err.status === 429 || err.message?.includes("429")) {
        console.warn(`[llm] ${chain[i]} failed (${err.status ?? "error"}), falling back to ${chain[i + 1]}`);
        continue;
      }
      throw err;
    }
  }

  throw new Error("No LLM provider succeeded");
}
