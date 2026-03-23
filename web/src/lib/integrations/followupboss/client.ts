/**
 * Follow Up Boss REST API client.
 * Auth: Basic auth with API key as username, blank password.
 * Docs: https://docs.followupboss.com/reference
 */

const FUB_BASE_URL = "https://api.followupboss.com/v1";

interface FUBRequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

export interface FUBPerson {
  id: number;
  firstName: string;
  lastName: string;
  emails: { value: string; type: string }[];
  phones: { value: string; type: string }[];
  stage: string;
  source: string;
  created: string;
  updated: string;
  tags: string[];
  assignedTo: string | null;
  [key: string]: unknown;
}

export interface FUBNote {
  id: number;
  personId: number;
  subject: string;
  body: string;
  created: string;
}

export interface FUBEvent {
  id: number;
  personId: number;
  type: string;
  description: string;
  created: string;
}

export interface FUBListResponse<T> {
  _metadata: { total: number; limit: number; offset: number };
  [key: string]: T[] | unknown;
}

export class FollowUpBossClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get authHeader(): string {
    return "Basic " + Buffer.from(`${this.apiKey}:`).toString("base64");
  }

  private async request<T>(path: string, options: FUBRequestOptions = {}): Promise<T> {
    const { method = "GET", body, params } = options;
    const url = new URL(`${FUB_BASE_URL}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`FUB API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json();
  }

  /** List contacts (paginated). */
  async getPeople(
    limit = 100,
    offset = 0
  ): Promise<{ people: FUBPerson[]; total: number }> {
    const data = await this.request<any>("/people", {
      params: { limit: String(limit), offset: String(offset) },
    });
    return { people: data.people ?? [], total: data._metadata?.total ?? 0 };
  }

  /** Find person by email. */
  async findPersonByEmail(email: string): Promise<FUBPerson | null> {
    try {
      const data = await this.request<any>("/people", {
        params: { email },
      });
      const people = data.people ?? [];
      return people.length > 0 ? people[0] : null;
    } catch {
      return null;
    }
  }

  /** Create a new person (contact). */
  async createPerson(person: {
    firstName: string;
    lastName: string;
    emails?: { value: string; type?: string }[];
    phones?: { value: string; type?: string }[];
    source?: string;
    tags?: string[];
  }): Promise<FUBPerson> {
    return this.request<FUBPerson>("/people", {
      method: "POST",
      body: person as Record<string, unknown>,
    });
  }

  /** Add a note to a person's timeline. */
  async createNote(personId: number, subject: string, body: string): Promise<FUBNote> {
    return this.request<FUBNote>("/notes", {
      method: "POST",
      body: { personId, subject, body },
    });
  }

  /** Log an event/activity on a person's timeline. */
  async createEvent(
    personId: number,
    type: string,
    description: string
  ): Promise<FUBEvent> {
    return this.request<FUBEvent>("/events", {
      method: "POST",
      body: { personId, type, description },
    });
  }

  /** Verify the API key is valid by fetching the account info. */
  async verifyKey(): Promise<boolean> {
    try {
      await this.request("/me");
      return true;
    } catch {
      return false;
    }
  }
}
