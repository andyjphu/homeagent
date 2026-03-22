/**
 * Dotloop REST API client.
 * Auth: OAuth2
 * Base URL: https://api-gateway.dotloop.com/public/v2
 * Docs: https://dotloop.github.io/public-api/
 */

const DOTLOOP_BASE_URL = "https://api-gateway.dotloop.com/public/v2";
const DOTLOOP_AUTH_URL = "https://auth.dotloop.com/oauth/authorize";
const DOTLOOP_TOKEN_URL = "https://auth.dotloop.com/oauth/token";

export interface DotloopProfile {
  id: number;
  name: string;
  email: string;
}

export interface DotloopLoop {
  id: number;
  name: string;
  status: string;
  transactionType: string;
  totalPrice: number | null;
  loopUrl: string;
  created: string;
  updated: string;
  details?: Record<string, unknown>;
}

export interface DotloopParticipant {
  id: number;
  fullName: string;
  email: string;
  role: string;
}

export interface DotloopDocument {
  id: number;
  name: string;
  created: string;
}

export function getDotloopAuthUrl(state: string): string {
  const clientId = process.env.DOTLOOP_CLIENT_ID!;
  const redirectUri = process.env.DOTLOOP_REDIRECT_URI!;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
  });
  return `${DOTLOOP_AUTH_URL}?${params.toString()}`;
}

export async function exchangeDotloopCode(
  code: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(DOTLOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.DOTLOOP_CLIENT_ID!,
      client_secret: process.env.DOTLOOP_CLIENT_SECRET!,
      redirect_uri: process.env.DOTLOOP_REDIRECT_URI!,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Dotloop token exchange failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function refreshDotloopToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(DOTLOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.DOTLOOP_CLIENT_ID!,
      client_secret: process.env.DOTLOOP_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error(`Dotloop token refresh failed (${res.status})`);
  }

  return res.json();
}

export class DotloopClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const res = await fetch(`${DOTLOOP_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Dotloop API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json();
  }

  async getProfile(): Promise<DotloopProfile> {
    const data = await this.request<any>("/profile");
    return data.data ?? data;
  }

  async getLoops(profileId: number): Promise<DotloopLoop[]> {
    const data = await this.request<any>(`/profile/${profileId}/loop`);
    return data.data ?? [];
  }

  async getLoop(profileId: number, loopId: number): Promise<DotloopLoop> {
    const data = await this.request<any>(`/profile/${profileId}/loop/${loopId}`);
    return data.data ?? data;
  }

  async getLoopParticipants(
    profileId: number,
    loopId: number
  ): Promise<DotloopParticipant[]> {
    const data = await this.request<any>(
      `/profile/${profileId}/loop/${loopId}/participant`
    );
    return data.data ?? [];
  }

  async getLoopDocuments(
    profileId: number,
    loopId: number
  ): Promise<DotloopDocument[]> {
    const data = await this.request<any>(
      `/profile/${profileId}/loop/${loopId}/document`
    );
    return data.data ?? [];
  }

  async updateLoopStatus(
    profileId: number,
    loopId: number,
    status: string
  ): Promise<void> {
    await this.request(`/profile/${profileId}/loop/${loopId}`, "PATCH", {
      status,
    });
  }
}
