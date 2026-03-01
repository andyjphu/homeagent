const BU_BASE_URL = "https://api.browser-use.com/api/v1";

function getApiKey(): string {
  const key = process.env.BROWSER_USE_API_KEY;
  if (!key) throw new Error("BROWSER_USE_API_KEY is not set");
  return key;
}

export interface BURunTaskResponse {
  id: string;
  status: string;
  live_url: string;
  created_at?: string;
}

export interface BUTaskStatus {
  id: string;
  status: "created" | "running" | "paused" | "finished" | "failed" | "stopped";
  output: string | null;
  live_url: string;
  created_at: string;
  finished_at: string | null;
  steps: BUStep[] | null;
}

export interface BUStep {
  step_number: number;
  description: string;
  timestamp: string;
}

/**
 * Start a Browser Use Cloud task.
 * Returns the task ID and live preview URL.
 */
export async function runTask(task: string): Promise<BURunTaskResponse> {
  const res = await fetch(`${BU_BASE_URL}/run-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ task }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use run-task failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Check the status of a Browser Use Cloud task.
 */
export async function getTaskStatus(taskId: string): Promise<BUTaskStatus> {
  const res = await fetch(`${BU_BASE_URL}/task/${taskId}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use task-status failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Stop a running Browser Use Cloud task.
 */
export async function stopTask(taskId: string): Promise<void> {
  const res = await fetch(`${BU_BASE_URL}/stop-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({ task_id: taskId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use stop-task failed (${res.status}): ${text}`);
  }
}

/**
 * Extract JSON from browser-use output.
 * Handles markdown fences, escaped quotes, and JSON embedded in text.
 */
export function parseJSON(raw: string | null | undefined): unknown {
  if (!raw) return null;

  let text = String(raw);

  // Strip markdown code fences
  text = text.replace(/```json\s*/g, "");
  text = text.replace(/```\s*/g, "");

  // Unescape \" -> " (browser-use done action escaping)
  if (text.includes('\\"')) {
    text = text.replace(/\\"/g, '"');
  }

  text = text.trim();

  // Direct parse if starts with [ or {
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      // fall through
    }
  }

  // Extract JSON array from surrounding text
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]") + 1;
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      return JSON.parse(text.slice(arrStart, arrEnd));
    } catch {
      // fall through
    }
  }

  // Extract JSON object from surrounding text
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}") + 1;
  if (objStart >= 0 && objEnd > objStart) {
    try {
      return JSON.parse(text.slice(objStart, objEnd));
    } catch {
      // fall through
    }
  }

  return null;
}
