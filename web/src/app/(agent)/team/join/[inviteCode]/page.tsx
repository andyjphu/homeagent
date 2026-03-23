"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function JoinBrokeragePage() {
  const params = useParams();
  const router = useRouter();
  const inviteCode = params.inviteCode as string;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/team/join/${inviteCode}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to join brokerage");
        return;
      }

      router.push("/team");
    } catch {
      setError("Failed to join brokerage");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Join Brokerage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join a brokerage team. Click below to accept
            the invitation and join the team.
          </p>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button onClick={handleJoin} disabled={loading} className="w-full">
            {loading ? "Joining..." : "Accept & Join Team"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
