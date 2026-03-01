import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone } from "lucide-react";

export default async function CallsPage() {
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

  const { data: calls } = await supabase
    .from("communications")
    .select("*, buyers(full_name)")
    .eq("agent_id", agent.id)
    .eq("type", "call")
    .order("occurred_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Call Log</h1>
          <p className="text-muted-foreground">
            Track calls with buyers and leads
          </p>
        </div>
        {/* TODO: Upload Recording button — re-enable when call recording is implemented */}
      </div>

      <div className="space-y-3">
        {(!calls || calls.length === 0) ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No calls logged yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          calls.map((call: any) => {
            const analysis = (call.ai_analysis || {}) as any;
            return (
              <Card key={call.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{call.direction}</Badge>
                        {analysis.buyer_temperature && (
                          <Badge
                            variant={
                              analysis.buyer_temperature === "hot"
                                ? "destructive"
                                : analysis.buyer_temperature === "warm"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {analysis.buyer_temperature}
                          </Badge>
                        )}
                        {call.buyers?.full_name && (
                          <span className="text-sm font-medium">
                            {call.buyers.full_name}
                          </span>
                        )}
                      </div>
                      {call.duration_seconds && (
                        <p className="text-sm text-muted-foreground">
                          Duration: {Math.floor(call.duration_seconds / 60)}m{" "}
                          {call.duration_seconds % 60}s
                        </p>
                      )}
                      {analysis.summary && (
                        <p className="text-sm bg-muted p-2 rounded mt-2">
                          {analysis.summary}
                        </p>
                      )}
                      {analysis.action_items?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium">Action Items:</p>
                          <ul className="text-sm text-muted-foreground list-disc pl-4">
                            {analysis.action_items.map(
                              (item: any, i: number) => (
                                <li key={i}>{item.action}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(call.occurred_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
