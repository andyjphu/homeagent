"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddPropertyModal } from "./add-property-modal";

export function AddPropertyButton({ buyerId }: { buyerId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Add Property
      </Button>
      <AddPropertyModal open={open} onOpenChange={setOpen} buyerId={buyerId} />
    </>
  );
}
