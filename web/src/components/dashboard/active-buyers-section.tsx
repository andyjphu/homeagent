"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { Database } from "@/types/database";

type Buyer = Database["public"]["Tables"]["buyers"]["Row"];
type DealStage = Database["public"]["Tables"]["deals"]["Row"]["stage"];

interface BuyerWithCounts extends Buyer {
  property_count: number;
  deal_stage: DealStage | null;
}

const stageLabels: Record<string, string> = {
  prospecting: "Prospecting",
  touring: "Touring",
  pre_offer: "Pre-Offer",
  negotiating: "Negotiating",
  under_contract: "Under Contract",
  inspection: "Inspection",
  appraisal: "Appraisal",
  closing: "Closing",
};

const stageColors: Record<string, string> = {
  prospecting: "bg-blue-500/10 text-blue-700 border-blue-200",
  touring: "bg-purple-500/10 text-purple-700 border-purple-200",
  pre_offer: "bg-orange-500/10 text-orange-700 border-orange-200",
  negotiating: "bg-amber-500/10 text-amber-700 border-amber-200",
  under_contract: "bg-green-500/10 text-green-700 border-green-200",
  inspection: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  appraisal: "bg-teal-500/10 text-teal-700 border-teal-200",
  closing: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
};

const temperatureConfig = {
  hot: { color: "bg-red-500", badge: "destructive" as const, label: "Hot" },
  warm: { color: "bg-orange-500", badge: "secondary" as const, label: "Warm" },
  cool: { color: "bg-blue-500", badge: "outline" as const, label: "Cool" },
  cold: { color: "bg-gray-400", badge: "outline" as const, label: "Cold" },
};

interface ActiveBuyersSectionProps {
  buyers: BuyerWithCounts[];
}

export function ActiveBuyersSection({ buyers }: ActiveBuyersSectionProps) {
  const temperatureCounts = {
    hot: buyers.filter((b) => b.temperature === "hot").length,
    warm: buyers.filter((b) => b.temperature === "warm").length,
    cool: buyers.filter((b) => b.temperature === "cool" || b.temperature === "cold").length,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client Portfolio
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs">
              {temperatureCounts.hot > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  {temperatureCounts.hot} hot
                </span>
              )}
              {temperatureCounts.warm > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  {temperatureCounts.warm} warm
                </span>
              )}
              {temperatureCounts.cool > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  {temperatureCounts.cool} cool
                </span>
              )}
            </div>
            <Link href="/buyers">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {buyers.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm mb-1">
              Add your first client
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Confirm a lead to create a buyer profile and start curating
              properties.
            </p>
            <Link href="/leads">
              <Button variant="outline" size="sm" className="mt-4">
                <UserPlus className="h-4 w-4 mr-1" />
                Go to Leads
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {buyers.map((buyer) => (
              <BuyerCard key={buyer.id} buyer={buyer} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BuyerCard({ buyer }: { buyer: BuyerWithCounts }) {
  const config = temperatureConfig[buyer.temperature] || temperatureConfig.cool;

  return (
    <Link
      href={`/buyers/${buyer.id}`}
      className="group flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm">{buyer.full_name}</p>
          <Badge variant={config.badge} className="text-xs">
            {config.label}
          </Badge>
          {buyer.deal_stage && stageLabels[buyer.deal_stage] && (
            <Badge
              variant="outline"
              className={`text-xs ${stageColors[buyer.deal_stage] || ""}`}
            >
              {stageLabels[buyer.deal_stage]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {buyer.property_count > 0 && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {buyer.property_count} properties
            </span>
          )}
          {buyer.last_activity_at && (
            <span>
              Active{" "}
              {formatDistanceToNow(new Date(buyer.last_activity_at), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
    </Link>
  );
}
