"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Building2,
  LayoutDashboard,
  Users,
  Briefcase,
  Phone,
  ArrowRight,
  Star,
  MessageSquare,
  ChevronRight,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// --- Demo Data ---

const demoBuyers = [
  {
    id: 1,
    name: "Sarah Chen",
    temperature: "Hot" as const,
    budget: "$650K - $800K",
    lastActivity: "2 hours ago",
    properties: 5,
    notes: "Prefers Westside, needs 3BR minimum, good schools",
    status: "Active",
  },
  {
    id: 2,
    name: "Marcus & Tanya Johnson",
    temperature: "Warm" as const,
    budget: "$450K - $550K",
    lastActivity: "1 day ago",
    properties: 3,
    notes: "First-time buyers, pre-approved with Wells Fargo",
    status: "Active",
  },
  {
    id: 3,
    name: "David Park",
    temperature: "Cool" as const,
    budget: "$1.2M - $1.5M",
    lastActivity: "5 days ago",
    properties: 8,
    notes: "Relocating from NYC, luxury condo or townhome",
    status: "Nurturing",
  },
];

const demoProperties = [
  {
    id: 1,
    address: "4817 Ridgewood Dr",
    price: "$725,000",
    beds: 4,
    baths: 2.5,
    sqft: "2,100",
    match: 94,
    agentNote: "Strong match — great school district, updated kitchen, below budget ceiling",
  },
  {
    id: 2,
    address: "310 Birch Hollow Ln",
    price: "$689,000",
    beds: 3,
    baths: 2,
    sqft: "1,850",
    match: 87,
    agentNote: "Good bones, needs cosmetic updates. Could negotiate 5-8% below ask",
  },
  {
    id: 3,
    address: "1205 Crescent Park Blvd",
    price: "$752,000",
    beds: 3,
    baths: 3,
    sqft: "2,400",
    match: 79,
    agentNote: "Slightly over budget but exceptional layout. Worth a showing",
  },
];

const demoDeals = [
  { buyer: "Sarah Chen", property: "4817 Ridgewood Dr", stage: "Negotiating", daysInStage: 3 },
  { buyer: "Marcus Johnson", property: "782 Westlake Ave", stage: "Touring", daysInStage: 7 },
  { buyer: "Lisa Wang", property: "2340 Summit Ct", stage: "Closing", daysInStage: 12 },
];

const features = [
  {
    icon: LayoutDashboard,
    title: "Command Center",
    description:
      "See your entire pipeline at a glance. Leads, active buyers, deals in progress — all in one view.",
  },
  {
    icon: Users,
    title: "Client Portfolios",
    description:
      "Curate property shortlists with your notes and reasoning. Show clients exactly why you picked each home.",
  },
  {
    icon: Briefcase,
    title: "Deal Tracking",
    description:
      "Track every deal from first showing to closing. Never lose track of where things stand.",
  },
  {
    icon: Star,
    title: "Buyer Dashboards",
    description:
      "Share a private link with each client. They see your curated picks, leave feedback, and track progress.",
  },
  {
    icon: Phone,
    title: "Call & Activity Logs",
    description:
      "Log calls, notes, and touchpoints. Build a record of the work you do for every client.",
  },
  {
    icon: MessageSquare,
    title: "Buyer Feedback Loop",
    description:
      "Clients favorite properties and leave comments directly on their dashboard. No more lost text threads.",
  },
];

// --- Interactive Demo ---

type DemoTab = "buyers" | "properties" | "deals";

function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>("buyers");
  const [selectedBuyer, setSelectedBuyer] = useState<number | null>(null);
  const stages = ["Prospecting", "Touring", "Negotiating", "Closing"];

  return (
    <div className="rounded-xl border bg-card shadow-lg overflow-hidden">
      {/* Mock top bar */}
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <Image src="/foyerfindclear.svg" alt="FoyerFind" width={20} height={20} />
        <span className="font-semibold text-sm">FoyerFind</span>
        <span className="text-xs text-muted-foreground ml-2">Demo Mode</span>
      </div>

      <div className="flex flex-col sm:flex-row min-h-[420px]">
        {/* Sidebar (desktop) */}
        <div className="hidden sm:flex w-48 flex-col border-r bg-muted/10 p-3 gap-1">
          {(
            [
              { key: "buyers", label: "Clients", icon: Users },
              { key: "properties", label: "Properties", icon: Building2 },
              { key: "deals", label: "Deals", icon: Briefcase },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setActiveTab(item.key);
                setSelectedBuyer(null);
              }}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors cursor-pointer ${
                activeTab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Tabs (mobile) */}
        <div className="sm:hidden flex border-b w-full">
          {(
            [
              { key: "buyers", label: "Clients" },
              { key: "properties", label: "Properties" },
              { key: "deals", label: "Deals" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setActiveTab(item.key);
                setSelectedBuyer(null);
              }}
              className={`flex-1 py-2 text-xs font-medium transition-colors cursor-pointer ${
                activeTab === item.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          {activeTab === "buyers" && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Active Clients
              </h3>
              {demoBuyers.map((buyer) => (
                <div
                  key={buyer.id}
                  onClick={() => setSelectedBuyer(selectedBuyer === buyer.id ? null : buyer.id)}
                  className={`rounded-lg border p-3 cursor-pointer transition-all ${
                    selectedBuyer === buyer.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{buyer.name}</span>
                      <Badge
                        variant={buyer.temperature === "Hot" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {buyer.temperature}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{buyer.lastActivity}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {buyer.budget} &middot; {buyer.properties} properties curated
                  </div>
                  {selectedBuyer === buyer.id && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-xs text-muted-foreground">{buyer.notes}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {buyer.status}
                        </Badge>
                        <span className="text-xs text-primary flex items-center gap-1 cursor-pointer">
                          View shortlist <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "properties" && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Curated for Sarah Chen
              </h3>
              {demoProperties.map((prop) => (
                <div key={prop.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{prop.address}</span>
                    <Badge variant="default" className="text-xs">
                      {prop.match}% match
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {prop.price} &middot; {prop.beds}bd / {prop.baths}ba &middot; {prop.sqft} sqft
                  </div>
                  <div className="text-xs bg-muted/50 rounded p-2 italic">
                    Agent note: &ldquo;{prop.agentNote}&rdquo;
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "deals" && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Active Deals
              </h3>
              {demoDeals.map((deal, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{deal.buyer}</span>
                    <Badge
                      variant={deal.stage === "Closing" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {deal.stage}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {deal.property} &middot; {deal.daysInStage} days in stage
                  </div>
                  <div className="flex gap-1 mt-2">
                    {stages.map((stage) => {
                      const current = stages.indexOf(deal.stage);
                      const idx = stages.indexOf(stage);
                      return (
                        <div
                          key={stage}
                          className={`h-1.5 flex-1 rounded-full ${
                            idx <= current ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Image src="/foyerfindclear.svg" alt="FoyerFind" width={24} height={24} />
            <span className="text-xl font-bold">FoyerFind</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <Badge variant="secondary" className="mb-6">
          Built for buyer&apos;s agents
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
          Your clients deserve to see
          <br />
          <span className="text-primary">the work you do</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          FoyerFind is the command center for buyer&apos;s agents. Manage your pipeline, curate
          properties with your expertise, and share private dashboards that prove your value.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              Start Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#demo">
            <Button variant="outline" size="lg">
              See it in action
            </Button>
          </a>
        </div>
      </section>

      {/* Interactive Demo */}
      <section id="demo" className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold">See how it works</h2>
          <p className="text-muted-foreground mt-2">
            Click around — this is a live preview of your agent dashboard.
          </p>
        </div>
        <InteractiveDemo />
      </section>

      {/* Post-NAR value prop */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">
            The NAR settlement changed everything.
            <br />
            Your tools should too.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Buyer&apos;s agents now sign compensation agreements before the first showing. Clients
            want to know what they&apos;re paying for. FoyerFind makes your research, curation, and
            negotiation work visible — so you never have to justify your value with words alone.
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            {[
              {
                stat: "100%",
                label: "of your work visible",
                detail: "Clients see every property you researched, every note, every comparison",
              },
              {
                stat: "1 link",
                label: "per client",
                detail: "Share a private dashboard — no app downloads, no logins, no friction",
              },
              {
                stat: "Real-time",
                label: "feedback loop",
                detail: "Clients favorite, comment, and rank — you see it instantly",
              },
            ].map((item) => (
              <Card key={item.stat}>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{item.stat}</div>
                  <div className="font-medium mt-1">{item.label}</div>
                  <p className="text-xs text-muted-foreground mt-2">{item.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-muted-foreground mt-2">
            Purpose-built for how buyer&apos;s agents actually work.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card key={feature.title} className="border">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            Up and running in minutes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Add your clients",
                description:
                  "Create buyer profiles with their preferences, budget, and timeline. Track where each client is in their search.",
              },
              {
                step: "2",
                title: "Curate properties",
                description:
                  "Add properties to each client\u2019s shortlist with your notes, match reasoning, and strategy. Show your expertise.",
              },
              {
                step: "3",
                title: "Share the dashboard",
                description:
                  "Send each client a private link. They see your curated picks, leave feedback, and track their deal — all in one place.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Calendly */}
      <section id="book" className="mx-auto max-w-4xl px-6 py-20">
        <div className="text-center mb-8">
          <Calendar className="h-8 w-8 text-primary mx-auto mb-4" />
          <h2 className="text-2xl sm:text-3xl font-bold">Let&apos;s talk</h2>
          <p className="text-muted-foreground mt-2">
            Book a quick discovery call to see how FoyerFind fits your workflow.
          </p>
        </div>
        <div className="rounded-xl border overflow-hidden bg-card">
          <iframe
            src="https://calendly.com/andy-phtlabs/discovery?embed_type=Inline"
            width="100%"
            height="660"
            title="Book a discovery call"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            className="border-0"
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Stop losing clients to agents who look more organized
          </h2>
          <p className="mt-4 opacity-90 max-w-xl mx-auto">
            FoyerFind gives you the tools to demonstrate your value — not just talk about it.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup">
              <Button size="lg" variant="secondary" className="gap-2">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#book">
              <Button
                size="lg"
                variant="ghost"
                className="text-primary-foreground border border-primary-foreground/30 hover:bg-primary-foreground/10"
              >
                Book a Call
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/foyerfindclear.svg" alt="FoyerFind" width={16} height={16} className="opacity-50" />
            <span className="text-sm text-muted-foreground">FoyerFind</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Agent Login
            </Link>
            <a href="#book" className="hover:text-foreground transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
