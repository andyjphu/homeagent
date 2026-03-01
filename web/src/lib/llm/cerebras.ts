import OpenAI from "openai";

function getClient() {
  return new OpenAI({
    apiKey: process.env.CEREBRAS_API_KEY || "",
    baseURL: "https://api.cerebras.ai/v1",
  });
}

export async function cerebrasComplete(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const response = await getClient().chat.completions.create({
    model: "llama3.1-8b",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.1,
  });

  return response.choices[0]?.message?.content ?? "";
}

export async function cerebrasJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<T> {
  const response = await getClient().chat.completions.create({
    model: "llama3.1-8b",
    messages: [
      {
        role: "system",
        content: systemPrompt + "\n\nRespond with valid JSON only.",
      },
      { role: "user", content: userPrompt },
    ],
    max_tokens: options?.maxTokens ?? 1024,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as T;
}
