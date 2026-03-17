"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Upload,
  FileAudio,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

interface Buyer {
  id: string;
  full_name: string;
}

interface UploadResult {
  id: string;
  status: "transcribing" | "analyzing" | "done";
  recording_url: string | null;
}

interface ProcessingState {
  phase: "uploading" | "transcribing" | "analyzing" | "done" | "error";
  message: string;
  result?: {
    id: string;
    lead_id?: string;
    summary?: string;
  };
}

export function CallUploadDialog({
  agentId,
  buyers,
}: {
  agentId: string;
  buyers: Buyer[];
}) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [buyerId, setBuyerId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const resetForm = useCallback(() => {
    setProcessing(null);
    setSelectedFile(null);
    setBuyerId("");
    setDragOver(false);
  }, []);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        resetForm();
      }
    },
    [resetForm]
  );

  // Poll for processing status
  const pollStatus = useCallback(
    async (commId: string) => {
      const maxAttempts = 60; // 5 minutes max
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 5000));

        try {
          const res = await fetch(`/api/calls/${commId}/status`);
          if (!res.ok) continue;
          const data = await res.json();

          if (data.status === "complete") {
            setProcessing({
              phase: "done",
              message: "Call processed successfully",
              result: {
                id: commId,
                lead_id: data.lead_id,
                summary: data.analysis?.summary || data.analysis?.extraction?.summary,
              },
            });
            router.refresh();
            return;
          }
          if (data.status === "failed") {
            setProcessing({
              phase: "error",
              message: "Processing failed. You can try again or add details manually.",
            });
            return;
          }

          // Update phase based on has_transcript
          if (data.has_transcript) {
            setProcessing((prev) =>
              prev?.phase === "transcribing"
                ? { ...prev, phase: "analyzing", message: "Analyzing call content..." }
                : prev
            );
          }
        } catch {
          // Continue polling
        }
      }

      // Timeout
      setProcessing({
        phase: "done",
        message: "Processing is taking longer than expected. Check back in a moment.",
        result: { id: commId },
      });
    },
    [router]
  );

  // Handle audio upload submission
  async function handleAudioSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const hasTranscript = !!(formData.get("transcript_text") as string)?.trim();

    if (!selectedFile && !hasTranscript) {
      return; // Nothing to submit
    }

    if (selectedFile) {
      formData.set("audio", selectedFile);
    }

    if (buyerId && buyerId !== "none") {
      formData.set("buyer_id", buyerId);
    }

    setProcessing({
      phase: "uploading",
      message: selectedFile ? "Uploading recording..." : "Processing transcript...",
    });

    try {
      const res = await fetch("/api/calls/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setProcessing({
          phase: "error",
          message: err.error || "Upload failed",
        });
        return;
      }

      const data: UploadResult = await res.json();

      if (data.status === "done") {
        setProcessing({
          phase: "done",
          message: "Call logged successfully",
          result: { id: data.id },
        });
        router.refresh();
        return;
      }

      // Start polling for transcription/analysis
      setProcessing({
        phase: data.status === "transcribing" ? "transcribing" : "analyzing",
        message:
          data.status === "transcribing"
            ? "Transcribing audio..."
            : "Analyzing call content...",
      });

      pollStatus(data.id);
    } catch {
      setProcessing({
        phase: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  // Handle quick log submission
  async function handleQuickLogSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const summaryText = formData.get("summary_text") as string;

    if (!summaryText?.trim()) {
      return;
    }

    if (buyerId && buyerId !== "none") {
      formData.set("buyer_id", buyerId);
    }

    setProcessing({
      phase: "uploading",
      message: "Logging call...",
    });

    try {
      const res = await fetch("/api/calls/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setProcessing({
          phase: "error",
          message: err.error || "Failed to log call",
        });
        return;
      }

      const data: UploadResult = await res.json();

      setProcessing({
        phase: "analyzing",
        message: "Analyzing call notes...",
      });

      pollStatus(data.id);
    } catch {
      setProcessing({
        phase: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  // File handling
  function handleFileSelect(file: File) {
    const validExts = [".m4a", ".mp3", ".wav", ".webm", ".ogg", ".aac"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      alert(`Unsupported file type: ${ext}. Use .m4a, .mp3, .wav, .webm, .ogg, or .aac`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      alert("File too large. Maximum size is 25MB.");
      return;
    }
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  // Processing overlay
  if (processing) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogTrigger asChild>
          <Button>
            <Phone className="h-4 w-4 mr-2" />
            Log a Call
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-8 space-y-4">
            {processing.phase === "done" ? (
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            ) : processing.phase === "error" ? (
              <AlertCircle className="h-12 w-12 text-red-500" />
            ) : (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
            <p className="text-sm font-medium text-center">{processing.message}</p>

            {processing.result?.summary && (
              <Card className="w-full">
                <CardContent className="p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                  <p className="text-sm">{processing.result.summary}</p>
                </CardContent>
              </Card>
            )}

            {processing.result?.lead_id && (
              <Badge variant="secondary">Lead created</Badge>
            )}

            {(processing.phase === "done" || processing.phase === "error") && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleClose(false)}>
                  Close
                </Button>
                {processing.phase === "error" && (
                  <Button onClick={resetForm}>Try Again</Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button>
          <Phone className="h-4 w-4 mr-2" />
          Log a Call
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log a Call</DialogTitle>
          <DialogDescription>
            Upload a recording or quickly log call notes
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="audio" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="audio">Upload Recording</TabsTrigger>
            <TabsTrigger value="quick">Quick Log</TabsTrigger>
          </TabsList>

          {/* Mode A: Audio Upload */}
          <TabsContent value="audio">
            <form onSubmit={handleAudioSubmit} className="space-y-4">
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : selectedFile
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".m4a,.mp3,.wav,.webm,.ogg,.aac,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileAudio className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / (1024 * 1024)).toFixed(1)}MB)
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="ml-1 p-1 rounded hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      Drop a recording here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tap the record button during any call — recordings are saved to Notes
                      (iPhone) or Phone app (Android).
                    </p>
                  </>
                )}
              </div>

              {/* Optional transcript paste */}
              <div className="space-y-2">
                <Label htmlFor="transcript_text">
                  Transcript{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="transcript_text"
                  name="transcript_text"
                  placeholder="Already have a transcript? Paste it here to skip transcription and get faster results."
                  rows={3}
                />
              </div>

              {/* Shared fields */}
              <SharedFields buyers={buyers} buyerId={buyerId} setBuyerId={setBuyerId} />

              <Button type="submit" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Upload & Analyze
              </Button>
            </form>
          </TabsContent>

          {/* Mode B: Quick Log */}
          <TabsContent value="quick">
            <form onSubmit={handleQuickLogSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="summary_text">Call Summary</Label>
                <Textarea
                  id="summary_text"
                  name="summary_text"
                  placeholder="Spoke with Sarah Chen about 3-bed homes in North Dallas. Budget $400-600k. Needs good schools. Pre-approved with Wells Fargo. Wants to move by August."
                  rows={5}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Describe the call — we&apos;ll extract lead details automatically.
                </p>
              </div>

              {/* Shared fields */}
              <SharedFields buyers={buyers} buyerId={buyerId} setBuyerId={setBuyerId} />

              <Button type="submit" className="w-full">
                <Phone className="h-4 w-4 mr-2" />
                Log Call
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground text-center mt-2">
          Ensure you comply with local call recording consent laws. Most states
          require one-party consent; some require all-party consent.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function SharedFields({
  buyers,
  buyerId,
  setBuyerId,
}: {
  buyers: Buyer[];
  buyerId: string;
  setBuyerId: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="caller_name">Caller Name</Label>
          <Input
            id="caller_name"
            name="caller_name"
            placeholder="Sarah Chen"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="caller_phone">Phone</Label>
          <Input
            id="caller_phone"
            name="caller_phone"
            type="tel"
            placeholder="(214) 555-0123"
          />
        </div>
      </div>

      {buyers.length > 0 && (
        <div className="space-y-2">
          <Label>Link to Buyer</Label>
          <Select value={buyerId} onValueChange={setBuyerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a buyer (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No buyer — new lead</SelectItem>
              {buyers.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input id="notes" name="notes" placeholder="Follow up about financing options" />
      </div>
    </>
  );
}
