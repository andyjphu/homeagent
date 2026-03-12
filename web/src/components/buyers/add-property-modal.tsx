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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Check, X } from "lucide-react";

interface AddPropertyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyerId: string;
}

const PROPERTY_TYPES = [
  "Single Family",
  "Condo",
  "Townhouse",
  "Multi-Family",
  "Land",
  "Other",
];

export function AddPropertyModal({
  open,
  onOpenChange,
  buyerId,
}: AddPropertyModalProps) {
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [hoaMonthly, setHoaMonthly] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [listingDescription, setListingDescription] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [agentNotes, setAgentNotes] = useState("");
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAddress("");
      setCity("");
      setState("");
      setZip("");
      setListingPrice("");
      setBeds("");
      setBaths("");
      setSqft("");
      setYearBuilt("");
      setHoaMonthly("");
      setPropertyType("");
      setListingDescription("");
      setListingUrl("");
      setPhotoUrl("");
      setPhotos([]);
      setAgentNotes("");
      setAutoEnrich(true);
      setSaved(false);
      setError(null);
    }
  }, [open]);

  const addPhoto = () => {
    const url = photoUrl.trim();
    if (url && !photos.includes(url)) {
      setPhotos([...photos, url]);
      setPhotoUrl("");
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!address.trim()) {
      setError("Address is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerIds: [buyerId],
          address: address.trim(),
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zip: zip.trim() || undefined,
          listingPrice: listingPrice ? Number(listingPrice) : undefined,
          beds: beds ? Number(beds) : undefined,
          baths: baths ? Number(baths) : undefined,
          sqft: sqft ? Number(sqft) : undefined,
          yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
          hoaMonthly: hoaMonthly ? Number(hoaMonthly) : undefined,
          propertyType: propertyType || undefined,
          listingDescription: listingDescription.trim() || undefined,
          listingUrl: listingUrl.trim() || undefined,
          photos: photos.length > 0 ? photos : undefined,
          agentNotes: agentNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add property");
        setSaving(false);
        return;
      }

      setSaved(true);

      // Auto-enrich if checked
      if (autoEnrich && data.property?.id) {
        fetch(`/api/properties/${data.property.id}/enrich`, {
          method: "POST",
        }).catch(() => {});
      }

      setTimeout(() => {
        onOpenChange(false);
        window.dispatchEvent(new Event("properties-updated"));
      }, 800);
    } catch {
      setError("Failed to add property");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] flex flex-col overflow-hidden"
        style={{ maxWidth: "min(600px, calc(100% - 2rem))" }}
      >
        <DialogHeader>
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
          {/* Address section */}
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Street Address *</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="CA"
                  maxLength={2}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zip</Label>
                <Input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="90210"
                />
              </div>
            </div>
          </div>

          {/* Property details */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Listing Price ($)</Label>
              <Input
                type="number"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Property Type</Label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select...</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Beds</Label>
              <Input
                type="number"
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                placeholder="3"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Baths</Label>
              <Input
                type="number"
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                placeholder="2"
                step="0.5"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sqft</Label>
              <Input
                type="number"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                placeholder="1800"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Year Built</Label>
              <Input
                type="number"
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                placeholder="2005"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">HOA ($/month)</Label>
              <Input
                type="number"
                value={hoaMonthly}
                onChange={(e) => setHoaMonthly(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Listing URL</Label>
              <Input
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-1">
            <Label className="text-xs">Photo URLs</Label>
            <div className="flex gap-2">
              <Input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPhoto();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhoto}
                disabled={!photoUrl.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {photos.map((url, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded max-w-[200px]"
                  >
                    <span className="truncate">{url.split("/").pop()}</span>
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="shrink-0 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={listingDescription}
              onChange={(e) => setListingDescription(e.target.value)}
              placeholder="Property description..."
              className="text-sm min-h-[60px] resize-y"
            />
          </div>

          {/* Agent notes */}
          <div className="space-y-1">
            <Label className="text-xs">Agent Notes (visible to buyer)</Label>
            <Textarea
              value={agentNotes}
              onChange={(e) => setAgentNotes(e.target.value)}
              placeholder="Why you picked this property for the buyer..."
              className="text-sm min-h-[60px] resize-y"
            />
          </div>

          {/* Auto-enrich checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-enrich"
              checked={autoEnrich}
              onChange={(e) => setAutoEnrich(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="auto-enrich" className="text-xs cursor-pointer">
              Auto-enrich with neighborhood data
            </Label>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || saved}>
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : saved ? (
              <Check className="h-3 w-3 mr-1" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            {saved ? "Added" : "Add Property"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
