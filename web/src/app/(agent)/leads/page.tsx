import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Plus } from "lucide-react";
import Link from "next/link";
import { LeadForm } from "@/components/leads/lead-form";

export default async function LeadsPage() {
  const supabase = await createClient() as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  if (!agent) return null;

  const { data: leads } = await supabase
    .from("leads")
    .select("*")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });

  const draftLeads = leads?.filter((l) => l.status === "draft") ?? [];
  const confirmedLeads = leads?.filter((l) => l.status === "confirmed") ?? [];
  const dismissedLeads = leads?.filter((l) => l.status === "dismissed") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-muted-foreground">
            Manage incoming leads from email, calls, and manual entry
          </p>
        </div>
        <LeadForm agentId={agent.id} />
      </div>

      <Tabs defaultValue="draft">
        <TabsList>
          <TabsTrigger value="draft" className="gap-2">
            Draft
            {draftLeads.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {draftLeads.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmed ({confirmedLeads.length})
          </TabsTrigger>
          <TabsTrigger value="dismissed">
            Dismissed ({dismissedLeads.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draft" className="space-y-3 mt-4">
          {draftLeads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No pending leads. Add one manually or connect Gmail to auto-detect.
                </p>
              </CardContent>
            </Card>
          ) : (
            draftLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))
          )}
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-3 mt-4">
          {confirmedLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </TabsContent>

        <TabsContent value="dismissed" className="space-y-3 mt-4">
          {dismissedLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadCard({ lead }: { lead: any }) {
  const extractedInfo = (lead.extracted_info || {}) as any;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{lead.name || "Unknown Contact"}</h3>
              <Badge
                variant={
                  lead.confidence === "high"
                    ? "default"
                    : lead.confidence === "medium"
                    ? "secondary"
                    : "outline"
                }
              >
                {lead.confidence}
              </Badge>
              <Badge variant="outline">{lead.source}</Badge>
            </div>
            <div className="flex gap-4 text-sm text-muted-foreground">
              {lead.email && <span>{lead.email}</span>}
              {lead.phone && <span>{lead.phone}</span>}
            </div>
            {extractedInfo.budget_max && (
              <p className="text-sm text-muted-foreground">
                Budget: ${extractedInfo.budget_min?.toLocaleString() ?? "?"} -{" "}
                ${extractedInfo.budget_max?.toLocaleString()}
                {extractedInfo.beds && ` · ${extractedInfo.beds}+ beds`}
                {extractedInfo.areas?.length > 0 &&
                  ` · ${extractedInfo.areas.join(", ")}`}
              </p>
            )}
            {lead.raw_source_content && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {lead.raw_source_content}
              </p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            {lead.status === "draft" && (
              <>
                <Link href={`/leads/${lead.id}`}>
                  <Button size="sm">Review & Confirm</Button>
                </Link>
              </>
            )}
            {lead.status === "confirmed" && lead.merged_into_buyer_id && (
              <Link href={`/buyers/${lead.merged_into_buyer_id}`}>
                <Button size="sm" variant="outline">
                  View Buyer
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
