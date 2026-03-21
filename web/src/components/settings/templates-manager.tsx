"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash2, Mail, MessageSquare, Loader2 } from "lucide-react";

interface Template {
  id: string;
  agent_id: string | null;
  name: string;
  category: string;
  channel: string;
  subject: string | null;
  body: string;
  is_system: boolean;
  created_at: string;
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
};

const CATEGORIES = ["listing", "showing", "offer", "closing", "general"];
const CHANNELS = ["email", "sms"];

export function TemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "general",
    channel: "email",
    subject: "",
    body: "",
  });

  const supabase = createClient() as any;

  async function fetchTemplates() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!agent) return;

    // Get system templates + agent's custom templates
    const { data } = await supabase
      .from("communication_templates")
      .select("*")
      .or(`agent_id.is.null,agent_id.eq.${agent.id}`)
      .order("is_system", { ascending: false })
      .order("name");

    setTemplates(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  function startEdit(template: Template) {
    setEditingId(template.id);
    setEditBody(template.body);
    setEditSubject(template.subject || "");
  }

  async function saveEdit(templateId: string) {
    setSaving(true);
    await supabase
      .from("communication_templates")
      .update({ body: editBody, subject: editSubject || null })
      .eq("id", templateId);

    setEditingId(null);
    setSaving(false);
    fetchTemplates();
  }

  async function createTemplate() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    if (agent) {
      await supabase.from("communication_templates").insert({
        agent_id: agent.id,
        name: newTemplate.name,
        category: newTemplate.category,
        channel: newTemplate.channel,
        subject: newTemplate.subject || null,
        body: newTemplate.body,
        is_system: false,
      });
    }

    setSaving(false);
    setShowNew(false);
    setNewTemplate({ name: "", category: "general", channel: "email", subject: "", body: "" });
    fetchTemplates();
  }

  async function deleteTemplate(id: string) {
    await supabase.from("communication_templates").delete().eq("id", id);
    fetchTemplates();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} templates
        </p>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-3 w-3 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={newTemplate.name}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, name: e.target.value })
                  }
                  placeholder="e.g., Price reduction alert"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select
                    value={newTemplate.category}
                    onValueChange={(v) =>
                      setNewTemplate({ ...newTemplate, category: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Channel</Label>
                  <Select
                    value={newTemplate.channel}
                    onValueChange={(v) =>
                      setNewTemplate({ ...newTemplate, channel: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {newTemplate.channel === "email" && (
                <div>
                  <Label>Subject</Label>
                  <Input
                    value={newTemplate.subject}
                    onChange={(e) =>
                      setNewTemplate({ ...newTemplate, subject: e.target.value })
                    }
                    placeholder="Use {{variable}} for placeholders"
                  />
                </div>
              )}
              <div>
                <Label>Body</Label>
                <Textarea
                  value={newTemplate.body}
                  onChange={(e) =>
                    setNewTemplate({ ...newTemplate, body: e.target.value })
                  }
                  rows={8}
                  placeholder="Use {{buyer_name}}, {{address}}, {{agent_name}}, etc."
                />
              </div>
              <Button
                onClick={createTemplate}
                disabled={!newTemplate.name || !newTemplate.body || saving}
                className="w-full"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Template"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {templates.map((t) => {
        const Icon = CHANNEL_ICONS[t.channel] || Mail;
        const isEditing = editingId === t.id;

        return (
          <Card key={t.id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-xs">
                        {t.category}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {t.channel}
                      </Badge>
                      {t.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      isEditing ? saveEdit(t.id) : startEdit(t)
                    }
                  >
                    {isEditing ? (
                      saving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className="text-xs font-medium text-green-600">
                          Save
                        </span>
                      )
                    ) : (
                      <Pencil className="h-3 w-3" />
                    )}
                  </Button>
                  {!t.is_system && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteTemplate(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-3 space-y-2">
                  {t.channel === "email" && (
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Subject line"
                      className="text-sm"
                    />
                  )}
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={6}
                    className="text-sm font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Variables: {"{{buyer_name}}"}, {"{{address}}"}, {"{{agent_name}}"}, {"{{date}}"}, {"{{time}}"}, {"{{price}}"}, {"{{beds}}"}, {"{{baths}}"}, {"{{sqft}}"}
                  </p>
                </div>
              )}

              {!isEditing && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {t.body.slice(0, 120)}
                  {t.body.length > 120 ? "..." : ""}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
