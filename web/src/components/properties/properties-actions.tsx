"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Sparkles, Loader2, AlertTriangle, Info } from "lucide-react";
import { SearchListingsModal } from "@/components/buyers/search-listings-modal";

interface Buyer {
  id: string;
  full_name: string;
  intent_profile: Record<string, unknown> | null;
}

export function PropertiesActions({
  agentId,
  buyers,
}: {
  agentId: string;
  buyers: Buyer[];
}) {
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>(
    buyers[0]?.id ?? ""
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchInfo, setResearchInfo] = useState<string | null>(null);
  const router = useRouter();

  const selectedBuyer = buyers.find((b) => b.id === selectedBuyerId);
  const intentProfile = (selectedBuyer?.intent_profile as Record<string, unknown>) ?? {};

  useEffect(() => {
    fetch("/api/properties/search/status")
      .then((res) => res.json())
      .then((data) => setHasApiKey(data.available === true))
      .catch(() => setHasApiKey(false));
  }, []);

  async function handleResearch() {
    if (!selectedBuyerId) return;
    setResearching(true);
    setResearchError(null);
    setResearchInfo(null);
    try {
      const response = await fetch("/api/research/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId: selectedBuyerId,
          agentId,
          intentProfile,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setResearchError(data.error ?? "Failed to start research");
      } else {
        setResearchInfo(`Researching ${data.propertyCount ?? ""} properties for ${selectedBuyer?.full_name}...`);
      }
      router.refresh();
    } catch {
      setResearchError("Failed to start research");
    }
    setResearching(false);
  }

  if (buyers.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* Buyer selector */}
        <Select value={selectedBuyerId} onValueChange={setSelectedBuyerId}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Select buyer" />
          </SelectTrigger>
          <SelectContent>
            {buyers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.full_name || "Unnamed buyer"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search Listings */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSearchOpen(true)}
          disabled={hasApiKey === false || hasApiKey === null}
          title={hasApiKey === false ? "Configure RAPIDAPI_KEY in Settings to enable listing search" : "Search MLS listings"}
        >
          <Search className="h-4 w-4 mr-1" />
          Search Listings
        </Button>

        {/* AI Research (Enrich & Score) */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleResearch}
          disabled={researching || !selectedBuyerId}
          title="Search listings, enrich with neighborhood data, and run AI scoring"
        >
          {researching ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          {researching ? "Researching..." : "AI Research"}
        </Button>
      </div>

      {/* Status messages */}
      {researchError && (
        <span className="text-xs text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {researchError}
        </span>
      )}
      {researchInfo && !researchError && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3 shrink-0" />
          {researchInfo}
        </span>
      )}

      {/* Search Modal */}
      <SearchListingsModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        buyerId={selectedBuyerId}
        intentProfile={intentProfile}
      />
    </div>
  );
}
