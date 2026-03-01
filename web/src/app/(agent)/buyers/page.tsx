import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";

export default async function BuyersPage() {
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

  const { data: buyers } = await supabase
    .from("buyers")
    .select("*")
    .eq("agent_id", agent.id)
    .order("last_activity_at", { ascending: false, nullsFirst: false });

  const activeBuyers = buyers?.filter((b: any) => b.is_active) ?? [];
  const inactiveBuyers = buyers?.filter((b: any) => !b.is_active) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Client Portfolio</h1>
        <p className="text-muted-foreground">
          {activeBuyers.length} active buyers
        </p>
      </div>

      {activeBuyers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No active buyers yet.{" "}
              <Link href="/leads" className="text-primary hover:underline">
                Confirm a lead
              </Link>{" "}
              to create your first buyer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeBuyers.map((buyer) => {
            const intent = (buyer.intent_profile || {}) as any;
            return (
              <Link key={buyer.id} href={`/buyers/${buyer.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{buyer.full_name}</h3>
                        <p className="text-xs text-muted-foreground">
                          via {buyer.source}
                          {buyer.referral_source &&
                            ` (ref: ${buyer.referral_source})`}
                        </p>
                      </div>
                      <Badge
                        variant={
                          buyer.temperature === "hot"
                            ? "destructive"
                            : buyer.temperature === "warm"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {buyer.temperature}
                      </Badge>
                    </div>

                    {(intent.budget_max || intent.beds_min || intent.preferred_areas?.length > 0) && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        {intent.budget_max && (
                          <p>
                            Budget: ${intent.budget_min?.toLocaleString() ?? "?"} -{" "}
                            ${intent.budget_max?.toLocaleString()}
                          </p>
                        )}
                        {intent.beds_min && <p>{intent.beds_min}+ beds</p>}
                        {intent.preferred_areas?.length > 0 && (
                          <p>{intent.preferred_areas.join(", ")}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Dashboard views: {buyer.dashboard_visit_count}
                      </span>
                      {buyer.last_activity_at && (
                        <span>
                          Last active:{" "}
                          {new Date(buyer.last_activity_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
