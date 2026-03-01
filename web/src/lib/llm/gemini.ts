import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function geminiComplete(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 4096,
      temperature: options?.temperature ?? 0.3,
    },
  });

  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

export async function geminiJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number }
): Promise<T> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt + "\n\nRespond with valid JSON only.",
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 4096,
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  return JSON.parse(text) as T;
}
