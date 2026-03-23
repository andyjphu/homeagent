import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { getRequiredDocumentsForStage, STAGE_DOCUMENT_REQUIREMENTS } from "@/lib/brokerage/helpers";

export default async function TeamCompliancePage() {
  const supabase = (await createClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient() as any;

  const { data: agent } = await admin
    .from("agents")
    .select("id, brokerage_id")
    .eq("user_id", user.id)
    .single();
  if (!agent?.brokerage_id) redirect("/app/clients");

  const { data: membership } = await admin
    .from("brokerage_agents")
    .select("role")
    .eq("brokerage_id", agent.brokerage_id)
    .eq("agent_id", agent.id)
    .single();
  if (membership?.role !== "admin") redirect("/app/clients");

  // Get all team agent IDs
  const { data: teamMembers } = await admin
    .from("brokerage_agents")
    .select("agent_id")
    .eq("brokerage_id", agent.brokerage_id);
  const agentIds = (teamMembers || []).map((m: any) => m.agent_id);

  // Get all active deals with agent and property info
  const { data: deals } = await admin
    .from("deals")
    .select("*, agents(full_name), buyers(full_name), properties(address)")
    .in("agent_id", agentIds)
    .not("stage", "in", '("closed","dead")')
    .order("created_at", { ascending: false });

  // For each deal, determine document requirements and status
  // MVP: we track which documents are "required" but have no upload system yet,
  // so all required docs show as missing. This is the compliance gap view.
  const dealCompliance = (deals || []).map((deal: any) => {
    const requiredDocs = getRequiredDocumentsForStage(deal.stage);
    // In a real system, we'd check if documents are uploaded.
    // For MVP, assume no documents are uploaded — show all as missing.
    const missingDocs = requiredDocs;
    const hasMissing = missingDocs.length > 0;

    return {
      id: deal.id,
      agentName: deal.agents?.full_name || "Unknown",
      buyerName: deal.buyers?.full_name || "Unknown",
      address: deal.properties?.address || "Unknown",
      stage: deal.stage,
      requiredDocs,
      missingDocs,
      hasMissing,
    };
  });

  const totalMissing = dealCompliance.filter((d: any) => d.hasMissing).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/team">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Compliance Tracker</h1>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{dealCompliance.length}</p>
            <p className="text-sm text-muted-foreground">Active Deals</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{totalMissing}</p>
            <p className="text-sm text-muted-foreground">With Missing Docs</p>
          </CardContent>
        </Card>
      </div>

      {/* Document requirements reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document Requirements by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3 text-sm">
            {Object.entries(STAGE_DOCUMENT_REQUIREMENTS).map(([stage, docs]) => (
              <div key={stage} className="border rounded-lg p-3">
                <p className="font-medium capitalize mb-1">
                  {stage.replace(/_/g, " ")}
                </p>
                <ul className="text-muted-foreground space-y-0.5">
                  {docs.map((doc) => (
                    <li key={doc} className="capitalize">
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-deal compliance */}
      {dealCompliance.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No active deals to track compliance for.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dealCompliance.map((deal: any) => (
            <Card key={deal.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link
                      href={`/deals/${deal.id}`}
                      className="font-semibold hover:underline"
                    >
                      {deal.address}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {deal.agentName} · {deal.buyerName}
                    </p>
                  </div>
                  <Badge
                    variant={deal.hasMissing ? "destructive" : "default"}
                  >
                    {deal.stage.replace(/_/g, " ")}
                  </Badge>
                </div>

                {deal.requiredDocs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {deal.requiredDocs.map((doc: string) => {
                      const isMissing = deal.missingDocs.includes(doc);
                      return (
                        <div
                          key={doc}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                            isMissing
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-green-50 text-green-700 border border-green-200"
                          }`}
                        >
                          {isMissing ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          <span className="capitalize">{doc}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {deal.requiredDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No documents required at this stage.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
