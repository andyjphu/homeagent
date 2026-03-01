/**
 * Browser Use Cloud API v2 client.
 * Docs: https://docs.cloud.browser-use.com/api-v2
 */

const BU_BASE_URL = "https://api.browser-use.com/api/v2";

function getApiKey(): string {
  const key = process.env.BROWSER_USE_API_KEY;
  if (!key) throw new Error("BROWSER_USE_API_KEY is not set");
  return key;
}

function headers(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Browser-Use-API-Key": getApiKey(),
  };
}

// ---------- Types ----------

export interface BUCreateTaskResponse {
  id: string;
  sessionId: string;
}

export interface BUTaskStatus {
  id: string;
  status: "created" | "started" | "finished" | "stopped";
  output: string | null;
  finishedAt: string | null;
  isSuccess: boolean | null;
  cost: string | null;
}

export interface BUTaskFull {
  id: string;
  sessionId: string;
  status: "created" | "started" | "finished" | "stopped";
  output: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  steps: BUStep[] | null;
  isSuccess: boolean | null;
  cost: string | null;
}

export interface BUStep {
  stepNumber: number;
  url: string | null;
}

export interface BUSession {
  id: string;
  status: "active" | "stopped";
  liveUrl: string | null;
  publicShareUrl: string | null;
  startedAt: string;
  finishedAt: string | null;
}

// ---------- API calls ----------

/**
 * Create and start a new Browser Use Cloud task.
 * Returns the task ID and session ID. Fetch the session to get the live URL.
 */
export async function createTask(task: string): Promise<BUCreateTaskResponse> {
  const res = await fetch(`${BU_BASE_URL}/tasks`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ task }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use create-task failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Lightweight status poll (no steps or files).
 */
export async function getTaskStatus(taskId: string): Promise<BUTaskStatus> {
  const res = await fetch(`${BU_BASE_URL}/tasks/${taskId}/status`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use task-status failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get full task details including steps and output.
 */
export async function getTaskFull(taskId: string): Promise<BUTaskFull> {
  const res = await fetch(`${BU_BASE_URL}/tasks/${taskId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use get-task failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Get session info including the live preview URL.
 */
export async function getSession(sessionId: string): Promise<BUSession> {
  const res = await fetch(`${BU_BASE_URL}/sessions/${sessionId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use get-session failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Stop a running task.
 */
export async function stopTask(taskId: string): Promise<void> {
  const res = await fetch(`${BU_BASE_URL}/tasks/${taskId}/stop`, {
    method: "PUT",
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use stop-task failed (${res.status}): ${text}`);
  }
}

// ---------- Helpers ----------

/**
 * Create a task and immediately fetch the session's live URL.
 * Convenience wrapper for the common pattern.
 */
export async function runTask(
  task: string
): Promise<{ taskId: string; sessionId: string; liveUrl: string | null }> {
  const created = await createTask(task);

  let liveUrl: string | null = null;
  try {
    const session = await getSession(created.sessionId);
    liveUrl = session.liveUrl;
  } catch {
    // Non-critical — live preview is optional
  }

  return {
    taskId: created.id,
    sessionId: created.sessionId,
    liveUrl,
  };
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
