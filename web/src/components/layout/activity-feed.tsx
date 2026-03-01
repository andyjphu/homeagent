"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import {
  UserPlus,
  Search,
  Mail,
  Phone,
  Heart,
  MessageSquare,
  TrendingDown,
  Handshake,
  AlertCircle,
} from "lucide-react";
import type { Database } from "@/types/database";

type ActivityItem = Database["public"]["Tables"]["activity_feed"]["Row"];

const eventIcons: Record<string, typeof UserPlus> = {
  lead_detected: UserPlus,
  lead_confirmed: UserPlus,
  research_started: Search,
  research_completed: Search,
  email_received: Mail,
  email_sent: Mail,
  call_completed: Phone,
  property_favorited: Heart,
  comment_added: MessageSquare,
  property_price_change: TrendingDown,
  deal_stage_changed: Handshake,
  deadline_approaching: AlertCircle,
};

export function ActivityFeed({ agentId }: { agentId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    const supabase = createClient() as any;

    // Fetch initial items
    supabase
      .from("activity_feed")
      .select("*")
      .eq("agent_id", agentId)
      .order("occurred_at", { ascending: false })
      .limit(50)
      .then(({ data }: { data: any }) => {
        if (data) setItems(data);
      });

    // Subscribe to realtime
    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload: any) => {
          setItems((prev: ActivityItem[]) => [payload.new as ActivityItem, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Activity Feed</h3>
        <Badge variant="secondary" className="text-xs">
          {items.filter((i) => !i.is_read).length} new
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No activity yet
            </p>
          )}
          {items.map((item) => {
            const Icon = eventIcons[item.event_type] || AlertCircle;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-accent",
                  !item.is_read && "bg-accent/50"
                )}
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {item.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(item.occurred_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {item.is_action_required && (
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    Action
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
