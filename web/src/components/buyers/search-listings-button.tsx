"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { SearchListingsModal } from "./search-listings-modal";

interface SearchListingsButtonProps {
  buyerId: string;
  intentProfile?: {
    budget_min?: number;
    budget_max?: number;
    beds_min?: number;
    baths_min?: number;
    preferred_areas?: string[];
  };
}

export function SearchListingsButton({
  buyerId,
  intentProfile,
}: SearchListingsButtonProps) {
  const [open, setOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Check if search is available (RAPIDAPI_KEY configured)
  useEffect(() => {
    fetch("/api/properties/search/status")
      .then((res) => res.json())
      .then((data) => setHasApiKey(data.available === true))
      .catch(() => setHasApiKey(false));
  }, []);

  const isDisabled = hasApiKey === false;
  const isLoading = hasApiKey === null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isDisabled || isLoading}
        title={isDisabled ? "Configure RAPIDAPI_KEY in Settings to enable listing search" : "Search MLS listings"}
      >
        <Search className="h-4 w-4 mr-1" />
        Search Listings
      </Button>
      {hasApiKey && (
        <SearchListingsModal
          open={open}
          onOpenChange={setOpen}
          buyerId={buyerId}
          intentProfile={intentProfile}
        />
      )}
    </>
  );
}
