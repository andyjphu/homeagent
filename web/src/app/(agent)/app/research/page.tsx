import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FileSearch, ExternalLink, Mail, Calendar, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResearchFilters } from "./research-filters";

const TRIGGER_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  calendar: Calendar,
  manual: Pencil,
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  researching: { label: "Researching", color: "bg-yellow-100 text-yellow-700" },
  draft_created: { label: "Draft Created", color: "bg-blue-100 text-blue-700" },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-700" },
};

const CONFIDENCE_STYLES: Record<string, { label: string; dot: string }> = {
  high: { label: "High", dot: "bg-green-500" },
  medium: { label: "Medium", dot: "bg-yellow-500" },
  low: { label: "Low", dot: "bg-red-500" },
};

interface SearchParams {
  trigger?: string;
  from?: string;
  to?: string;
}

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const supabase = await createClient() as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient() as any;
  const { data: agent } = await admin
    .from("agents")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!agent) redirect("/login");

  // Build query
  let query = admin
    .from("research_briefs")
    .select(`
      id,
      public_token,
      trigger_type,
      confidence_level,
      data_sources,
      gmail_draft_id,
      delivered_via,
      delivered_at,
      viewed_at,
      created_at,
      property:properties (address, city, state),
      buyer:buyers (full_name)
    `)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (sp.trigger && sp.trigger !== "all") {
    query = query.eq("trigger_type", sp.trigger);
  }
  if (sp.from) {
    query = query.gte("created_at", sp.from);
  }
  if (sp.to) {
    query = query.lte("created_at", sp.to + "T23:59:59Z");
  }

  const { data: briefs } = await query;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Research</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-generated property research briefs for your buyers.
        </p>
      </div>

      <ResearchFilters currentTrigger={sp.trigger} />

      {!briefs || briefs.length === 0 ? (
        <div className="border rounded-lg py-16 text-center">
          <FileSearch className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No research briefs yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            When FoyerFind detects property addresses in your emails, it automatically
            researches them and creates briefs linked to your buyers.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {briefs.map((brief: any) => {
            const TriggerIcon = TRIGGER_ICONS[brief.trigger_type] || FileSearch;
            const status = brief.gmail_draft_id
              ? brief.delivered_at ? "delivered" : "draft_created"
              : "researching";
            const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.researching;
            const confStyle = CONFIDENCE_STYLES[brief.confidence_level] || CONFIDENCE_STYLES.medium;
            const address = brief.property?.address || "Unknown address";
            const location = [brief.property?.city, brief.property?.state].filter(Boolean).join(", ");

            return (
              <div key={brief.id} className="border rounded-lg bg-white p-4 hover:border-foreground/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 p-1.5 rounded bg-gray-100">
                      <TriggerIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{address}</p>
                      {location && (
                        <p className="text-xs text-muted-foreground">{location}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className={`h-1.5 w-1.5 rounded-full ${confStyle.dot}`} />
                          {confStyle.label}
                        </span>
                        {brief.buyer?.full_name && (
                          <span className="text-[10px] text-muted-foreground">
                            · {brief.buyer.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(brief.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <Link
                      href={`/r/${brief.public_token}`}
                      target="_blank"
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
