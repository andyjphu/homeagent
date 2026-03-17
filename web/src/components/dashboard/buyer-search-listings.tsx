"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Send,
  Check,
  AlertTriangle,
  ImageOff,
  MapPin,
  Bed,
  Bath,
  Ruler,
} from "lucide-react";

interface IntentProfile {
  budget_min?: number;
  budget_max?: number;
  beds_min?: number;
  baths_min?: number;
  preferred_areas?: string[];
}

interface NormalizedListing {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_sqft: number | null;
  year_built: number | null;
  property_type: string | null;
  photos: string[];
  listing_url: string | null;
  lat: number | null;
  lng: number | null;
  days_on_market: number | null;
  description: string | null;
  source: string;
  source_id: string | null;
}

interface BuyerSearchListingsProps {
  dashboardToken: string;
  intentProfile?: IntentProfile;
  searchAvailable: boolean;
}

export function BuyerSearchListings({
  dashboardToken,
  intentProfile,
  searchAvailable,
}: BuyerSearchListingsProps) {
  const [open, setOpen] = useState(false);

  // Search form state
  const [location, setLocation] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [bedsMin, setBedsMin] = useState("");
  const [bathsMin, setBathsMin] = useState("");

  // Results state
  const [listings, setListings] = useState<NormalizedListing[]>([]);
  const [total, setTotal] = useState(0);
  const [cached, setCached] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggest state
  const [suggesting, setSuggesting] = useState<Set<string>>(new Set());
  const [suggested, setSuggested] = useState<Set<string>>(new Set());
  const [suggestErrors, setSuggestErrors] = useState<Map<string, string>>(
    new Map()
  );

  if (!searchAvailable) return null;

  // Pre-fill from intent profile when modal opens
  useEffect(() => {
    if (open && intentProfile) {
      if (intentProfile.preferred_areas?.length) {
        setLocation(intentProfile.preferred_areas[0]);
      }
      if (intentProfile.budget_min) {
        setPriceMin(String(intentProfile.budget_min));
      }
      if (intentProfile.budget_max) {
        setPriceMax(String(intentProfile.budget_max));
      }
      if (intentProfile.beds_min) {
        setBedsMin(String(intentProfile.beds_min));
      }
      if (intentProfile.baths_min) {
        setBathsMin(String(intentProfile.baths_min));
      }
    }
    if (open) {
      setListings([]);
      setSearched(false);
      setError(null);
      setSuggesting(new Set());
      setSuggested(new Set());
      setSuggestErrors(new Map());
    }
  }, [open, intentProfile]);

  const handleSearch = async () => {
    if (!location.trim()) {
      setError("Location is required");
      return;
    }

    setSearching(true);
    setError(null);
    setSuggested(new Set());
    setSuggestErrors(new Map());

    try {
      const res = await fetch(`/api/dashboard/${dashboardToken}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: location.trim(),
          price_min: priceMin ? Number(priceMin) : undefined,
          price_max: priceMax ? Number(priceMax) : undefined,
          beds_min: bedsMin ? Number(bedsMin) : undefined,
          baths_min: bathsMin ? Number(bathsMin) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        setSearching(false);
        setSearched(true);
        return;
      }

      setListings(data.listings || []);
      setTotal(data.total || 0);
      setCached(data.cached || false);
      setSearched(true);
    } catch {
      setError("Search failed — please try again later.");
      setSearched(true);
    }
    setSearching(false);
  };

  const handleSuggest = async (listing: NormalizedListing) => {
    const key = listing.source_id || listing.address;
    setSuggesting((prev) => new Set(prev).add(key));
    setSuggestErrors((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

    try {
      const res = await fetch(`/api/dashboard/${dashboardToken}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: listing.address,
          city: listing.city || undefined,
          state: listing.state || undefined,
          zip: listing.zip || undefined,
          listingPrice: listing.price || undefined,
          beds: listing.beds || undefined,
          baths: listing.baths || undefined,
          sqft: listing.sqft || undefined,
          lotSqft: listing.lot_sqft || undefined,
          yearBuilt: listing.year_built || undefined,
          propertyType: listing.property_type || undefined,
          listingDescription: listing.description || undefined,
          listingUrl: listing.listing_url || undefined,
          photos: listing.photos || [],
          latitude: listing.lat || undefined,
          longitude: listing.lng || undefined,
          daysOnMarket: listing.days_on_market || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSuggestErrors((prev) =>
          new Map(prev).set(key, data.error || "Failed to suggest")
        );
      } else {
        setSuggested((prev) => new Set(prev).add(key));
      }
    } catch {
      setSuggestErrors((prev) =>
        new Map(prev).set(key, "Failed to suggest")
      );
    }

    setSuggesting((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const getListingKey = (listing: NormalizedListing) =>
    listing.source_id || listing.address;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4 mr-1" />
        Search Listings
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90vh] flex flex-col overflow-hidden"
          style={{ maxWidth: "min(800px, calc(100% - 2rem))" }}
        >
          <DialogHeader>
            <DialogTitle>Search Listings</DialogTitle>
          </DialogHeader>

          {/* Search Form */}
          <div className="space-y-3 shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Location *</Label>
              <div className="flex gap-2">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, ZIP code, or address"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                />
                <Button
                  size="sm"
                  onClick={handleSearch}
                  disabled={searching}
                  className="shrink-0"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-1">Search</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Min Price</Label>
                <Input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="200000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Price</Label>
                <Input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="500000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Beds</Label>
                <Input
                  type="number"
                  value={bedsMin}
                  onChange={(e) => setBedsMin(e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min Baths</Label>
                <Input
                  type="number"
                  value={bathsMin}
                  onChange={(e) => setBathsMin(e.target.value)}
                  placeholder="2"
                  step="0.5"
                />
              </div>
            </div>

            {cached && searched && (
              <p className="text-xs text-muted-foreground">
                Showing cached results
              </p>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 min-h-0 mt-2 overflow-y-auto">
            <div className="space-y-2 pr-1">
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded px-3 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {searched && !error && listings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No listings found. Try a different location or adjust filters.
                </div>
              )}

              {searched && listings.length > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  {total} listing{total !== 1 ? "s" : ""} found — showing{" "}
                  {listings.length}
                </p>
              )}

              {listings.map((listing) => {
                const key = getListingKey(listing);
                const isSuggesting = suggesting.has(key);
                const isSuggested = suggested.has(key);
                const suggestError = suggestErrors.get(key);

                return (
                  <div
                    key={key}
                    className="flex gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    {/* Photo */}
                    <div className="w-24 h-20 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                      {listing.photos.length > 0 ? (
                        <img
                          src={listing.photos[0]}
                          alt={listing.address}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                            (
                              e.target as HTMLImageElement
                            ).parentElement!.innerHTML =
                              '<div class="flex items-center justify-center w-full h-full"><svg class="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                          }}
                        />
                      ) : (
                        <ImageOff className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm truncate">
                        {listing.address}
                      </p>
                      {(listing.city || listing.state) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[listing.city, listing.state, listing.zip]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {listing.price && (
                          <span className="font-semibold text-sm text-foreground">
                            ${listing.price.toLocaleString()}
                          </span>
                        )}
                        {listing.beds != null && (
                          <span className="flex items-center gap-0.5">
                            <Bed className="h-3 w-3" />
                            {listing.beds}
                          </span>
                        )}
                        {listing.baths != null && (
                          <span className="flex items-center gap-0.5">
                            <Bath className="h-3 w-3" />
                            {listing.baths}
                          </span>
                        )}
                        {listing.sqft != null && (
                          <span className="flex items-center gap-0.5">
                            <Ruler className="h-3 w-3" />
                            {listing.sqft.toLocaleString()} sqft
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {listing.property_type && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {listing.property_type}
                          </Badge>
                        )}
                        {listing.year_built && (
                          <span className="text-[10px] text-muted-foreground">
                            Built {listing.year_built}
                          </span>
                        )}
                        {listing.days_on_market != null && (
                          <span className="text-[10px] text-muted-foreground">
                            {listing.days_on_market}d on market
                          </span>
                        )}
                      </div>
                      {suggestError && (
                        <p className="text-xs text-destructive">
                          {suggestError}
                        </p>
                      )}
                    </div>

                    {/* Suggest button */}
                    <div className="shrink-0 flex items-center">
                      <Button
                        variant={isSuggested ? "ghost" : "outline"}
                        size="sm"
                        onClick={() => handleSuggest(listing)}
                        disabled={isSuggesting || isSuggested}
                      >
                        {isSuggesting ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : isSuggested ? (
                          <Check className="h-3 w-3 mr-1 text-green-600" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        {isSuggested ? "Sent" : "Suggest"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
