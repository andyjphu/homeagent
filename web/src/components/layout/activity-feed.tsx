"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  ClipboardList,
  Building2,
  Send,
  FileText,
  Loader2,
  Activity,
} from "lucide-react";
import type { Database } from "@/types/database";

type ActivityItem = Database["public"]["Tables"]["activity_feed"]["Row"];

const eventIcons: Record<string, typeof UserPlus> = {
  lead_detected: UserPlus,
  lead_confirmed: UserPlus,
  lead_dismissed: UserPlus,
  buyer_created: UserPlus,
  buyer_updated: ClipboardList,
  buyer_criteria_changed: ClipboardList,
  research_started: Search,
  research_completed: Search,
  properties_sent: Send,
  property_price_change: TrendingDown,
  property_status_change: Building2,
  email_received: Mail,
  email_sent: Mail,
  email_drafted: FileText,
  call_completed: Phone,
  call_analyzed: Phone,
  deal_created: Handshake,
  deal_stage_changed: Handshake,
  offer_submitted: FileText,
  counter_received: FileText,
  deal_accepted: Handshake,
  dashboard_viewed: Activity,
  property_favorited: Heart,
  comment_added: MessageSquare,
  inspection_analyzed: Search,
  appraisal_received: FileText,
  deadline_approaching: AlertCircle,
  deal_closed: Handshake,
};

const PAGE_SIZE = 30;

export function ActivityFeed({ agentId }: { agentId: string }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const supabase = createClient() as any;

    // Fetch initial items
    supabase
      .from("activity_feed")
      .select("*")
      .eq("agent_id", agentId)
      .order("occurred_at", { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }: { data: any }) => {
        if (data) {
          setItems(data);
          setHasMore(data.length === PAGE_SIZE);
        }
        setLoading(false);
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
          setItems((prev: ActivityItem[]) => [
            payload.new as ActivityItem,
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || items.length === 0) return;
    setLoadingMore(true);

    const supabase = createClient() as any;
    const lastItem = items[items.length - 1];

    const { data } = await supabase
      .from("activity_feed")
      .select("*")
      .eq("agent_id", agentId)
      .lt("occurred_at", lastItem.occurred_at)
      .order("occurred_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      setItems((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [agentId, items, loadingMore, hasMore]);

  const unreadCount = items.filter((i) => !i.is_read).length;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Activity Feed</h3>
        {unreadCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {unreadCount} new
          </Badge>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {loading && (
            <div className="space-y-3 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-4 w-4 mt-0.5 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-12 px-4">
              <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Actions across your deals will appear here in real time
              </p>
            </div>
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
                  <Badge
                    variant="destructive"
                    className="text-[10px] shrink-0"
                  >
                    Action
                  </Badge>
                )}
              </div>
            );
          })}

          {hasMore && items.length > 0 && (
            <div className="py-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
