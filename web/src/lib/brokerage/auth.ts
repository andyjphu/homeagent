import { createClient } from "@/lib/supabase/server";

interface BrokerageContext {
  agent: {
    id: string;
    full_name: string;
    email: string;
    brokerage_id: string | null;
    brand_settings: Record<string, unknown>;
  };
  brokerage: {
    id: string;
    name: string;
    logo_url: string | null;
    brand_colors: Record<string, unknown>;
    custom_domain: string | null;
    settings: Record<string, unknown>;
    plan: string;
  } | null;
  role: "admin" | "agent" | null;
  isAdmin: boolean;
}

/**
 * Get brokerage context for the current authenticated agent.
 * Returns null if not authenticated.
 */
export async function getBrokerageContext(): Promise<BrokerageContext | null> {
  const supabase = (await createClient()) as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: agent } = await supabase
    .from("agents")
    .select("id, full_name, email, brokerage_id, brand_settings")
    .eq("user_id", user.id)
    .single();
  if (!agent) return null;

  let brokerage = null;
  let role: "admin" | "agent" | null = null;

  if (agent.brokerage_id) {
    const [{ data: brokerageData }, { data: membership }] = await Promise.all([
      supabase
        .from("brokerages")
        .select("*")
        .eq("id", agent.brokerage_id)
        .single(),
      supabase
        .from("brokerage_agents")
        .select("role")
        .eq("brokerage_id", agent.brokerage_id)
        .eq("agent_id", agent.id)
        .single(),
    ]);

    brokerage = brokerageData ?? null;
    role = membership?.role ?? null;
  }

  return {
    agent: {
      id: agent.id,
      full_name: agent.full_name,
      email: agent.email,
      brokerage_id: agent.brokerage_id,
      brand_settings: (agent.brand_settings ?? {}) as Record<string, unknown>,
    },
    brokerage,
    role,
    isAdmin: role === "admin",
  };
}
