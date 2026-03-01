import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { IntakeForm } from "@/components/dashboard/intake-form";

export default async function IntakeFormPage({
  params,
}: {
  params: Promise<{ dashboardToken: string }>;
}) {
  const { dashboardToken } = await params;
  const supabase = createAdminClient() as any;

  const { data: buyer } = await supabase
    .from("buyers")
    .select("*, agents(full_name)")
    .eq("dashboard_token", dashboardToken)
    .single();

  if (!buyer) notFound();

  const intent = (buyer.intent_profile || {}) as any;
  const agentName = (buyer.agents as any)?.full_name;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
        <div className="relative max-w-2xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">HomeAgent</p>
                <p className="text-xs text-muted-foreground">
                  Home Search Questionnaire
                  {agentName && (
                    <>
                      {" "}
                      &middot; with{" "}
                      <span className="text-foreground">{agentName}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium">Hi, {buyer.full_name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <IntakeForm
          buyerName={buyer.full_name}
          agentName={agentName}
          dashboardToken={dashboardToken}
          existingProfile={intent}
        />
      </main>
    </div>
  );
}
