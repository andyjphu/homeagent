import { cerebrasComplete, cerebrasJSON } from "./cerebras";
import { geminiComplete, geminiJSON } from "./gemini";

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
  | "seller_motivation";

const FAST_TASKS: LLMTask[] = [
  "lead_classification",
  "email_classification",
  "intent_signal_extraction",
  "significance_check",
  "temperature_assessment",
];

function hasCerebrasKey(): boolean {
  return !!process.env.CEREBRAS_API_KEY;
}

function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Check if any LLM provider is available for a given task.
 * Fast tasks prefer Cerebras, complex tasks prefer Gemini — but either can fall back to the other.
 */
export function isLLMAvailable(task?: LLMTask): boolean {
  if (!task) return hasCerebrasKey() || hasGeminiKey();
  if (FAST_TASKS.includes(task)) return hasCerebrasKey() || hasGeminiKey();
  return hasGeminiKey() || hasCerebrasKey();
}

function getProvider(task: LLMTask): "cerebras" | "gemini" {
  const preferCerebras = FAST_TASKS.includes(task);
  if (preferCerebras) {
    if (hasCerebrasKey()) return "cerebras";
    if (hasGeminiKey()) return "gemini";
  } else {
    if (hasGeminiKey()) return "gemini";
    if (hasCerebrasKey()) return "cerebras";
  }
  throw new Error("No LLM API keys configured. Set CEREBRAS_API_KEY or GEMINI_API_KEY.");
}

export async function llmComplete(
  task: LLMTask,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const provider = getProvider(task);
  if (provider === "cerebras") {
    return cerebrasComplete(systemPrompt, userPrompt, options);
  }
  return geminiComplete(systemPrompt, userPrompt, options);
}

export async function llmJSON<T>(
  task: LLMTask,
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<T> {
  const provider = getProvider(task);
  if (provider === "cerebras") {
    return cerebrasJSON<T>(systemPrompt, userPrompt, options);
  }
  return geminiJSON<T>(systemPrompt, userPrompt, options);
}
