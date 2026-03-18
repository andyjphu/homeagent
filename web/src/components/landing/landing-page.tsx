"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Abril_Fatface } from "next/font/google";
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

const display = Abril_Fatface({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// =============================================
// DEMO DATA (unchanged)
// =============================================

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
    agentNote:
      "Strong match — great school district, updated kitchen, below budget ceiling",
  },
  {
    id: 2,
    address: "310 Birch Hollow Ln",
    price: "$689,000",
    beds: 3,
    baths: 2,
    sqft: "1,850",
    match: 87,
    agentNote:
      "Good bones, needs cosmetic updates. Could negotiate 5-8% below ask",
  },
  {
    id: 3,
    address: "1205 Crescent Park Blvd",
    price: "$752,000",
    beds: 3,
    baths: 3,
    sqft: "2,400",
    match: 79,
    agentNote:
      "Slightly over budget but exceptional layout. Worth a showing",
  },
];

const demoDeals = [
  {
    buyer: "Sarah Chen",
    property: "4817 Ridgewood Dr",
    stage: "Negotiating",
    daysInStage: 3,
  },
  {
    buyer: "Marcus Johnson",
    property: "782 Westlake Ave",
    stage: "Touring",
    daysInStage: 7,
  },
  {
    buyer: "Lisa Wang",
    property: "2340 Summit Ct",
    stage: "Closing",
    daysInStage: 12,
  },
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

// =============================================
// TAB CONTENT
// =============================================

type DemoTab = "buyers" | "properties" | "deals";

function TabContent({
  activeTab,
  selectedBuyer,
  setSelectedBuyer,
}: {
  activeTab: DemoTab;
  selectedBuyer: number | null;
  setSelectedBuyer: (id: number | null) => void;
}) {
  const stages = ["Prospecting", "Touring", "Negotiating", "Closing"];

  return (
    <div>
      {activeTab === "buyers" && (
        <div>
          {demoBuyers.map((buyer, i) => (
            <div
              key={buyer.id}
              onClick={() =>
                setSelectedBuyer(
                  selectedBuyer === buyer.id ? null : buyer.id
                )
              }
              className={`py-5 cursor-pointer transition-colors duration-150 ${
                i < demoBuyers.length - 1
                  ? "border-b border-[#F0EBE3]/[0.06]"
                  : ""
              } ${selectedBuyer === buyer.id ? "bg-[#F0EBE3]/[0.015]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[15px] text-[#F0EBE3]">
                    {buyer.name}
                  </span>
                  <span
                    className={`text-[9px] font-mono uppercase tracking-[0.15em] ${
                      buyer.temperature === "Hot"
                        ? "text-[#C4A882]"
                        : buyer.temperature === "Warm"
                          ? "text-[#A89880]"
                          : "text-[#6A655F]"
                    }`}
                  >
                    {buyer.temperature}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#6A655F]">
                  {buyer.lastActivity}
                </span>
              </div>
              <div className="text-[12px] font-mono text-[#5A554F] mt-1.5">
                {buyer.budget} · {buyer.properties} curated
              </div>
              {selectedBuyer === buyer.id && (
                <div className="mt-4 pt-4 border-t border-[#F0EBE3]/[0.06]">
                  <p className="text-[13px] text-[#8A857F] leading-relaxed">
                    {buyer.notes}
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#6A655F] border border-[#F0EBE3]/[0.08] px-2 py-0.5">
                      {buyer.status}
                    </span>
                    <button className="text-[10px] font-mono uppercase tracking-[0.1em] text-[#C4A882] flex items-center gap-1 hover:text-[#F0EBE3] transition-colors duration-150 cursor-pointer">
                      Shortlist <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "properties" && (
        <div>
          {demoProperties.map((prop, i) => (
            <div
              key={prop.id}
              className={`py-5 ${
                i < demoProperties.length - 1
                  ? "border-b border-[#F0EBE3]/[0.06]"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-[#F0EBE3]">
                  {prop.address}
                </span>
                <span className="text-[11px] font-mono text-[#C4A882]">
                  {prop.match}%
                </span>
              </div>
              <div className="text-[12px] font-mono text-[#5A554F] mt-1.5">
                {prop.price} · {prop.beds}bd/{prop.baths}ba · {prop.sqft}sf
              </div>
              <p className="text-[13px] text-[#6A655F] mt-3 leading-relaxed italic">
                &ldquo;{prop.agentNote}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === "deals" && (
        <div>
          {demoDeals.map((deal, i) => (
            <div
              key={i}
              className={`py-5 ${
                i < demoDeals.length - 1
                  ? "border-b border-[#F0EBE3]/[0.06]"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] text-[#F0EBE3]">
                  {deal.buyer}
                </span>
                <span
                  className={`text-[10px] font-mono uppercase tracking-[0.1em] ${
                    deal.stage === "Closing"
                      ? "text-[#C4A882]"
                      : deal.stage === "Negotiating"
                        ? "text-[#A89880]"
                        : "text-[#6A655F]"
                  }`}
                >
                  {deal.stage}
                </span>
              </div>
              <div className="text-[12px] font-mono text-[#5A554F] mt-1.5">
                {deal.property} · {deal.daysInStage}d in stage
              </div>
              <div className="flex gap-1 mt-3">
                {stages.map((stage) => {
                  const current = stages.indexOf(deal.stage);
                  const idx = stages.indexOf(stage);
                  return (
                    <div
                      key={stage}
                      className={`h-[3px] flex-1 ${
                        idx <= current
                          ? "bg-[#C4A882]"
                          : "bg-[#F0EBE3]/[0.06]"
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
  );
}

// =============================================
// MAIN PAGE
// =============================================

export function LandingPage() {
  const [activeTab, setActiveTab] = useState<DemoTab>("buyers");
  const [selectedBuyer, setSelectedBuyer] = useState<number | null>(null);

  return (
    <div className="bg-[#0C0B0A] text-[#F0EBE3] min-h-screen antialiased overflow-x-hidden">
      {/* Paper grain texture */}
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ============ NAV ============ */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-5 sm:px-8 bg-[#0C0B0A]/70 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <Image
            src="/foyerfindclear.svg"
            alt="FoyerFind"
            width={16}
            height={16}
          />
          <span className="text-[11px] font-mono uppercase tracking-[0.15em]">
            FoyerFind
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-[11px] font-mono text-[#6A655F] hover:text-[#F0EBE3] transition-colors duration-150 uppercase tracking-[0.1em]"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-[11px] font-mono uppercase tracking-[0.1em] border border-[#F0EBE3]/20 hover:border-[#F0EBE3]/50 px-4 py-1.5 transition-colors duration-150"
          >
            Enter
          </Link>
        </div>
      </nav>

      {/* ============ PANEL 1: HERO ============ */}
      <section className="min-h-screen relative flex flex-col justify-center px-5 sm:px-8 pt-16">
        {/* Background image — A24 painterly treatment */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/bg.jpg"
            alt=""
            fill
            className="object-cover object-center scale-105 blur-[2px]"
            priority
          />
          {/* Dark vignette overlay */}
          <div className="absolute inset-0 bg-[#0C0B0A]/70" />
          {/* Radial vignette — darker edges, lighter center */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 50%, transparent 20%, #0C0B0A 85%)",
            }}
          />
          {/* Warm color wash */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0C0B0A]/40 via-transparent to-[#0C0B0A]/90" />
          {/* Film grain — heavier than the global grain for cinematic feel */}
          <div
            className="absolute inset-0 mix-blend-overlay"
            style={{
              opacity: 0.12,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Subtle halation / light leak from top-left */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              background:
                "radial-gradient(ellipse at 15% 20%, #C4A882 0%, transparent 50%)",
            }}
          />
        </div>

        {/* Inset frame */}
        <div className="absolute inset-3 sm:inset-6 lg:inset-8 top-16 sm:top-18 lg:top-20 border border-[#F0EBE3]/[0.06] pointer-events-none z-10" />

        {/* Corner metadata */}
        <span className="absolute top-18 sm:top-20 lg:top-22 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          Est. 2024
        </span>
        <span className="absolute top-18 sm:top-20 lg:top-22 right-5 sm:right-8 lg:right-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          V1.0
        </span>
        <span className="absolute bottom-5 sm:bottom-8 lg:bottom-10 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          For buyer&apos;s agents
        </span>
        <span className="absolute bottom-5 sm:bottom-8 lg:bottom-10 right-5 sm:right-8 lg:right-10 text-[#C4A882] text-base z-10">
          ✦
        </span>

        {/* Hero content */}
        <div className="relative z-10 ml-1 sm:ml-4 lg:ml-8 mt-12">
          <h1>
            <span
              className={`${display.className} block text-[clamp(4.5rem,15vw,13rem)] leading-[0.82] tracking-[-0.02em]`}
            >
              FOYER
            </span>
            <span
              className={`${display.className} block text-[clamp(4.5rem,15vw,13rem)] leading-[0.82] tracking-[-0.02em] ml-[0.05em]`}
            >
              FIND
            </span>
          </h1>

          <div className="mt-10 sm:mt-14 max-w-sm sm:max-w-md">
            <p className="text-[14px] sm:text-[15px] text-[#8A857F] leading-[1.7]">
              The command center for buyer&apos;s agents.
              <br />
              Your clients deserve to see the work you do.
            </p>
          </div>

          <div className="mt-8 sm:mt-10 flex items-center gap-6">
            <Link
              href="/signup"
              className="text-[11px] font-mono uppercase tracking-[0.15em] border border-[#F0EBE3]/25 hover:border-[#F0EBE3]/60 px-6 py-2.5 transition-colors duration-200 inline-flex items-center gap-2.5"
            >
              Get started <ArrowRight className="h-3 w-3" />
            </Link>
            <a
              href="#contact"
              className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#6A655F] hover:text-[#F0EBE3] transition-colors duration-200"
            >
              Book a call
            </a>
          </div>
        </div>
      </section>

      {/* ============ PANEL 2: DEMO ============ */}
      <section
        id="demo"
        className="min-h-screen relative border-t border-[#F0EBE3]/[0.06]"
      >
        {/* Inset frame */}
        <div className="absolute inset-3 sm:inset-6 lg:inset-8 top-14 sm:top-16 lg:top-18 border border-[#F0EBE3]/[0.06] pointer-events-none" />

        {/* Corner metadata */}
        <span className="absolute top-5 sm:top-8 lg:top-10 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em]">
          02
        </span>
        <span className="absolute top-5 sm:top-8 lg:top-10 right-5 sm:right-8 lg:right-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em]">
          Interactive
        </span>
        <span className="absolute bottom-5 sm:bottom-8 lg:bottom-10 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em]">
          Live preview
        </span>
        <span className="absolute bottom-5 sm:bottom-8 lg:bottom-10 right-5 sm:right-8 lg:right-10 text-[#C4A882] text-base">
          ✦
        </span>

        <div className="pt-24 sm:pt-28 lg:pt-32 px-5 sm:px-10 lg:px-16 pb-16">
          {/* Section title */}
          <h2
            className={`${display.className} text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.85] tracking-[-0.02em] mb-14 sm:mb-16`}
          >
            THE
            <br />
            DASHBOARD
          </h2>

          {/* Tab nav */}
          <div className="flex gap-6 sm:gap-8 mb-2">
            {(
              [
                { key: "buyers" as const, label: "Clients" },
                { key: "properties" as const, label: "Properties" },
                { key: "deals" as const, label: "Deals" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setSelectedBuyer(null);
                }}
                className={`text-[11px] font-mono uppercase tracking-[0.15em] pb-3 border-b transition-colors duration-150 cursor-pointer ${
                  activeTab === item.key
                    ? "text-[#C4A882] border-[#C4A882]"
                    : "text-[#4A4540] border-transparent hover:text-[#8A857F]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-b border-[#F0EBE3]/[0.06] mb-2" />

          {/* Demo content */}
          <div className="max-w-2xl">
            <TabContent
              activeTab={activeTab}
              selectedBuyer={selectedBuyer}
              setSelectedBuyer={setSelectedBuyer}
            />
          </div>
        </div>
      </section>

      {/* ============ PANEL 3: PRICING ============ */}
      <section
        id="pricing"
        className="min-h-screen relative border-t border-[#F0EBE3]/[0.06] flex flex-col justify-center"
      >
        {/* Background image — cinematic treatment */}
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src="/traffic.png"
            alt=""
            fill
            className="object-cover object-center scale-105 blur-[3px]"
          />
          <div className="absolute inset-0 bg-[#0C0B0A]/80" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 60% 70%, transparent 10%, #0C0B0A 75%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0C0B0A]/90 via-[#0C0B0A]/40 to-[#0C0B0A]" />
          <div
            className="absolute inset-0 mix-blend-overlay"
            style={{
              opacity: 0.1,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Inset frame */}
        <div className="absolute inset-3 sm:inset-6 lg:inset-8 top-14 sm:top-16 lg:top-18 border border-[#F0EBE3]/[0.06] pointer-events-none z-10" />

        {/* Corner metadata */}
        <span className="absolute top-5 sm:top-8 lg:top-10 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          03
        </span>
        <span className="absolute top-5 sm:top-8 lg:top-10 right-5 sm:right-8 lg:right-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          Plans
        </span>
        <span className="absolute bottom-5 sm:bottom-8 lg:bottom-10 right-5 sm:right-8 lg:right-10 text-[#C4A882] text-base z-10">
          ✦
        </span>

        <div className="relative z-10 px-5 sm:px-10 lg:px-16 py-20 sm:py-24">
          <h2
            className={`${display.className} text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.85] tracking-[-0.02em] mb-8`}
          >
            PRICING
          </h2>

          {/* Features summary */}
          <div className="mb-14 sm:mb-16">
            <div className="text-[10px] font-mono text-[#4A4540] uppercase tracking-[0.2em] mb-4">
              What&apos;s included
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {features.map((f) => (
                <span
                  key={f.title}
                  className="text-[12px] text-[#6A655F] whitespace-nowrap"
                >
                  {f.title}
                </span>
              ))}
            </div>
          </div>

          {/* Pricing cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 max-w-2xl">
            {/* Starter */}
            <div className="border border-[#F0EBE3]/[0.08] p-6 sm:p-8">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6A655F] mb-8">
                Starter
              </div>
              <div
                className={`${display.className} text-[3.5rem] sm:text-[4.5rem] leading-[0.85]`}
              >
                $0
              </div>
              <div className="text-[10px] font-mono text-[#4A4540] uppercase tracking-[0.15em] mt-2 mb-10">
                /month · free forever
              </div>
              <div className="space-y-3">
                {[
                  "3 active clients",
                  "Property curation",
                  "Client dashboards",
                  "Buyer feedback",
                ].map((item) => (
                  <div
                    key={item}
                    className="text-[13px] text-[#8A857F] flex items-center gap-2.5"
                  >
                    <span className="text-[#4A4540]">—</span>
                    {item}
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                className="mt-10 block text-center text-[11px] font-mono uppercase tracking-[0.15em] border border-[#F0EBE3]/15 hover:border-[#F0EBE3]/40 py-3 transition-colors duration-200"
              >
                Start free
              </Link>
            </div>

            {/* Professional */}
            <div className="border border-[#F0EBE3]/[0.08] p-6 sm:p-8 bg-[#F0EBE3]/[0.02] sm:border-l-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#C4A882] mb-8">
                Professional
              </div>
              <div
                className={`${display.className} text-[3.5rem] sm:text-[4.5rem] leading-[0.85]`}
              >
                $49
              </div>
              <div className="text-[10px] font-mono text-[#4A4540] uppercase tracking-[0.15em] mt-2 mb-10">
                /month · cancel anytime
              </div>
              <div className="space-y-3">
                {[
                  "Unlimited clients",
                  "All features",
                  "AI property scoring",
                  "Priority support",
                ].map((item) => (
                  <div
                    key={item}
                    className="text-[13px] text-[#8A857F] flex items-center gap-2.5"
                  >
                    <span className="text-[#C4A882]">—</span>
                    {item}
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                className="mt-10 block text-center text-[11px] font-mono uppercase tracking-[0.15em] border border-[#C4A882]/30 hover:border-[#C4A882]/60 text-[#C4A882] py-3 transition-colors duration-200"
              >
                Go professional →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ PANEL 4: CONTACT ============ */}
      <section
        id="contact"
        className="min-h-screen relative border-t border-[#F0EBE3]/[0.06]"
      >
        {/* Inset frame */}
        <div className="absolute inset-3 sm:inset-6 lg:inset-8 top-14 sm:top-16 lg:top-18 border border-[#F0EBE3]/[0.06] pointer-events-none" />

        {/* Corner metadata */}
        <span className="absolute top-5 sm:top-8 lg:top-10 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em]">
          04
        </span>
        <span className="absolute top-5 sm:top-8 lg:top-10 right-5 sm:right-8 lg:right-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em]">
          Get in touch
        </span>
        <span className="absolute bottom-5 sm:bottom-8 lg:bottom-10 right-5 sm:right-8 lg:right-10 text-[#C4A882] text-base">
          ✦
        </span>

        <div className="pt-20 sm:pt-28 lg:pt-32 px-5 sm:px-10 lg:px-16 pb-16">
          <h2
            className={`${display.className} text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.85] tracking-[-0.02em] mb-4`}
          >
            CONTACT
          </h2>
          <p className="text-[14px] text-[#6A655F] mb-10 max-w-md leading-relaxed">
            15-minute discovery call. See how FoyerFind fits your workflow.
          </p>

          <div className="border border-[#F0EBE3]/[0.08] overflow-hidden max-w-3xl">
            <iframe
              src="https://calendly.com/andy-phtlabs/discovery?embed_type=Inline&background_color=0c0b0a&text_color=a19a92&primary_color=c4a882"
              width="100%"
              height="660"
              title="Book a discovery call"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="border-0"
            />
          </div>
        </div>
      </section>

      {/* ============ PANEL 5: FOOTER ============ */}
      <footer className="border-t border-[#F0EBE3]/[0.06] relative">
        <div className="px-5 sm:px-8 py-16 sm:py-20">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-8">
            <div>
              <span
                className={`${display.className} text-[2rem] sm:text-[2.5rem] leading-[0.85] block`}
              >
                FOYERFIND
              </span>
              <p className="text-[12px] text-[#4A4540] mt-3 font-mono uppercase tracking-[0.15em]">
                The command center for buyer&apos;s agents
              </p>
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="/login"
                className="text-[11px] font-mono text-[#4A4540] hover:text-[#F0EBE3] transition-colors duration-150 uppercase tracking-[0.1em]"
              >
                Agent Login
              </Link>
              <a
                href="#contact"
                className="text-[11px] font-mono text-[#4A4540] hover:text-[#F0EBE3] transition-colors duration-150 uppercase tracking-[0.1em]"
              >
                Contact
              </a>
              <a
                href="#pricing"
                className="text-[11px] font-mono text-[#4A4540] hover:text-[#F0EBE3] transition-colors duration-150 uppercase tracking-[0.1em]"
              >
                Pricing
              </a>
            </div>
          </div>

          <div className="mt-14 pt-6 border-t border-[#F0EBE3]/[0.06] flex items-center justify-between">
            <span className="text-[10px] font-mono text-[#3A3530] uppercase tracking-[0.15em]">
              © 2024 FoyerFind
            </span>
            <span className="text-[#C4A882] text-sm">✦</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
