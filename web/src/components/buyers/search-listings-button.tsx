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

  // Don't render the button if API key is not configured
  if (hasApiKey === false) return null;
  // Show nothing while loading the check
  if (hasApiKey === null) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4 mr-1" />
        Search Listings
      </Button>
      <SearchListingsModal
        open={open}
        onOpenChange={setOpen}
        buyerId={buyerId}
        intentProfile={intentProfile}
      />
    </>
  );
}
