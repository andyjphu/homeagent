import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ExternalLink,
  Search,
  Send,
  Copy,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResearchTrigger } from "@/components/buyers/research-trigger";
import { SendToBuyerToggle } from "@/components/buyers/send-to-buyer-toggle";
import { EmailSummaryButton } from "@/components/buyers/email-summary-button";

export default async function BuyerDetailPage({
  params,
}: {
  params: Promise<{ buyerId: string }>;
}) {
  const { buyerId } = await params;
  const supabase = await createClient() as any;

  const { data: buyerData } = await supabase
    .from("buyers")
    .select("*")
    .eq("id", buyerId)
    .single();

  if (!buyerData) notFound();

  const buyer = buyerData as any;

  // Fetch related data
  const { data: scores } = await supabase
    .from("buyer_property_scores")
    .select("*, properties(*)")
    .eq("buyer_id", buyerId)
    .order("match_score", { ascending: false });

  const { data: deals } = await supabase
    .from("deals")
    .select("*, properties(*)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  const { data: communications } = await supabase
    .from("communications")
    .select("*")
    .eq("buyer_id", buyerId as string)
    .order("occurred_at", { ascending: false })
    .limit(20) as { data: any[] | null };

  const { data: tasks } = await supabase
    .from("agent_tasks")
    .select("*")
    .eq("buyer_id", buyerId as string)
    .order("created_at", { ascending: false })
    .limit(10) as { data: any[] | null };

  const intent = (buyer.intent_profile || {}) as any;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const dashboardUrl = `${appUrl}/buyer/${buyer.dashboard_token}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/buyers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{buyer.full_name}</h1>
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
          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
            {buyer.email && <span>{buyer.email}</span>}
            {buyer.phone && <span>{buyer.phone}</span>}
            <span>via {buyer.source}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <EmailSummaryButton buyerId={buyer.id} />
          <ResearchTrigger buyerId={buyer.id} agentId={buyer.agent_id} intentProfile={intent} />
          <Button variant="outline" size="sm" asChild>
            <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Dashboard
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="properties">
            Properties ({scores?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="deals">Deals ({deals?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="communications">
            Comms ({communications?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Buyer Intent Profile</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <ProfileField label="Budget" value={
                intent.budget_max
                  ? `$${intent.budget_min?.toLocaleString() ?? "?"} - $${intent.budget_max?.toLocaleString()}`
                  : null
              } />
              <ProfileField label="Beds" value={intent.beds_min ? `${intent.beds_min}+` : null} />
              <ProfileField label="Baths" value={intent.baths_min ? `${intent.baths_min}+` : null} />
              <ProfileField label="Min Sqft" value={intent.sqft_min?.toLocaleString()} />
              <ProfileField label="Areas" value={intent.preferred_areas?.join(", ")} />
              <ProfileField label="Timeline" value={intent.timeline} />
              <ProfileField label="Household Size" value={intent.household_size} />
              <ProfileField label="School Rating Min" value={intent.school_rating_min} />
              <ProfileField label="Max Commute" value={intent.max_commute_minutes ? `${intent.max_commute_minutes} min` : null} />
              <ProfileField label="HOA Tolerance" value={intent.hoa_tolerance} />
              {intent.must_have_amenities?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Must-Have Amenities</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {intent.must_have_amenities.map((a: string) => (
                      <Badge key={a} variant="secondary">{a}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {intent.priorities_ranked?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Priorities</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {intent.priorities_ranked.map((p: string, i: number) => (
                      <Badge key={p} variant="outline">
                        {i + 1}. {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {intent.concerns?.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Concerns</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {intent.concerns.map((c: string) => (
                      <Badge key={c} variant="destructive">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dashboard Link</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {dashboardUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {}}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Share this link with {buyer.full_name} so they can view properties and provide feedback.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Properties tab */}
        <TabsContent value="properties" className="space-y-3 mt-4">
          {(!scores || scores.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No properties scored yet. Run research to find matches.
                </p>
              </CardContent>
            </Card>
          ) : (
            scores.map((score: any) => (
              <Card key={score.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {score.properties?.address}
                        </h3>
                        {score.is_favorited && (
                          <Badge variant="destructive">Favorited</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        ${score.properties?.listing_price?.toLocaleString()} &middot;{" "}
                        {score.properties?.beds} bed / {score.properties?.baths} bath &middot;{" "}
                        {score.properties?.sqft?.toLocaleString()} sqft
                      </p>
                      {score.score_reasoning && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {score.score_reasoning}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="text-2xl font-bold text-primary">
                        {score.match_score}
                      </div>
                      <p className="text-xs text-muted-foreground">match score</p>
                      <SendToBuyerToggle scoreId={score.id} initialSent={score.is_sent_to_buyer} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Deals tab */}
        <TabsContent value="deals" className="space-y-3 mt-4">
          {(!deals || deals.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No deals yet.</p>
              </CardContent>
            </Card>
          ) : (
            deals.map((deal: any) => (
              <Link key={deal.id} href={`/deals/${deal.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {deal.properties?.address}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ${deal.properties?.listing_price?.toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {deal.stage.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </TabsContent>

        {/* Communications tab */}
        <TabsContent value="communications" className="space-y-3 mt-4">
          {(!communications || communications.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No communications yet.</p>
              </CardContent>
            </Card>
          ) : (
            communications.map((comm) => (
              <Card key={comm.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{comm.type}</Badge>
                        <Badge variant="secondary">{comm.direction}</Badge>
                        {comm.classification && (
                          <Badge>{comm.classification}</Badge>
                        )}
                      </div>
                      {comm.subject && (
                        <p className="font-medium mt-1">{comm.subject}</p>
                      )}
                      {comm.raw_content && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {comm.raw_content}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(comm.occurred_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Research tab */}
        <TabsContent value="research" className="space-y-3 mt-4">
          {(!tasks || tasks.length === 0) ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No research tasks yet. Click &quot;Run Research&quot; to start.
                </p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {task.task_type.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(task.created_at).toLocaleString()}
                        {task.completed_at &&
                          ` · Completed: ${new Date(
                            task.completed_at
                          ).toLocaleString()}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        task.status === "completed"
                          ? "default"
                          : task.status === "running"
                          ? "secondary"
                          : task.status === "failed"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {task.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}
