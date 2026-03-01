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

function getProvider(task: LLMTask): "cerebras" | "gemini" {
  return FAST_TASKS.includes(task) ? "cerebras" : "gemini";
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
