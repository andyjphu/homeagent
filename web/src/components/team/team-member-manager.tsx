"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TeamMemberManagerProps {
  members: Member[];
  currentAgentId: string;
}

export function TeamMemberManager({ members, currentAgentId }: TeamMemberManagerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between border-b pb-3 last:border-0"
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{m.name}</p>
                  <Badge variant={m.role === "admin" ? "default" : "outline"} className="text-xs">
                    {m.role}
                  </Badge>
                  {m.id === currentAgentId && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
