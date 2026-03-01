"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

export function CopyButton({
  text,
  size = "sm",
  variant = "outline",
}: {
  text: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "outline" | "ghost" | "default";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant={variant} size={size} onClick={handleCopy}>
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}
