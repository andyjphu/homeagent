"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PenSquare } from "lucide-react";
import { ComposeModal } from "./compose-modal";

export function ComposeButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PenSquare className="h-4 w-4 mr-1" />
        Compose
      </Button>
      <ComposeModal open={open} onOpenChange={setOpen} />
    </>
  );
}
