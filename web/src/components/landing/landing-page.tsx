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
      {/* (global grain removed — applied only to hero bg) */}

      {/* ============ NAV ============ */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-12 flex items-center justify-between px-5 sm:px-8 bg-[#0C0B0A]/70 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <Image
            src="/icon-2.0.1.svg"
            alt="FoyerFind"
            width={16}
            height={16}
          />
          <span className="text-[11px] font-mono uppercase tracking-[0.15em]">
            FoyerFind
          </span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="#pricing"
            className="text-[11px] font-mono text-[#6A655F] hover:text-[#F0EBE3] transition-colors duration-150 uppercase tracking-[0.1em]"
          >
            Pricing
          </a>
          <a
            href="#contact"
            className="text-[11px] font-mono text-[#6A655F] hover:text-[#F0EBE3] transition-colors duration-150 uppercase tracking-[0.1em]"
          >
            Contact
          </a>
          <div className="w-px h-4 bg-[#F0EBE3]/[0.1]" />
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
            Sign up
          </Link>
        </div>
      </nav>

      {/* ============ PANEL 1: HERO + FLOATING DEMO ============ */}
      <section className="relative overflow-visible h-screen px-5 sm:px-8 pt-32 sm:pt-40 lg:pt-48 pb-0">
        {/* Background image — A24 painterly treatment */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Image container — blur applied to wrapper to avoid banding */}
          <div className="absolute -inset-6 blur-[6px]">
            <Image
              src="/bg.jpg"
              alt=""
              fill
              className="object-cover object-center"
              priority
            />
          </div>
          <div className="absolute inset-0 bg-[#0C0B0A]/70" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 50%, transparent 20%, #0C0B0A 85%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, rgba(12,11,10,0.35) 0%, rgba(12,11,10,0.05) 30%, rgba(12,11,10,0.05) 50%, rgba(12,11,10,0.85) 100%)",
            }}
          />
          {/* Film grain */}
          <div
            className="absolute inset-0 mix-blend-overlay opacity-[0.08]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 2048 2048' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)' opacity='1'/%3E%3C/svg%3E")`,
            }}
          />
          {/* Warm halation */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              background:
                "radial-gradient(ellipse at 15% 20%, #C4A882 0%, transparent 50%)",
            }}
          />
        </div>

        {/* Panel number */}
        <span className="absolute top-14 sm:top-16 lg:top-18 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          00
        </span>

        {/* Vertical edge label */}
        <span
          className="hidden lg:block absolute left-3 top-1/3 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.3em] z-10"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          The command center for buyer&apos;s agents
        </span>

        {/* Hero content */}
        <div className="relative z-10 ml-1 sm:ml-4 lg:ml-8">
          <h1>
            <span
              className={`${display.className} block text-[clamp(3rem,10vw,7rem)] leading-[0.85] tracking-[-0.02em]`}
            >
              FOYER FIND
            </span>
          </h1>

          <p className="mt-5 sm:mt-6 text-[14px] sm:text-[15px] text-[#8A857F]">
            Tired of back and forth? Wasted too much time on zillow?
          </p>

          <div className="mt-5 sm:mt-6 flex items-center gap-6">
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

        {/* Corner text — bottom right */}
        <span className="absolute bottom-5 sm:bottom-8 lg:bottom-10 right-5 sm:right-8 lg:right-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          Scroll for more
        </span>

      </section>

      {/* ---- Floating Dashboard Demo — sits OVER the divider between hero and pricing ---- */}
      <div id="demo" className="hidden sm:block relative z-30 max-w-5xl px-5 sm:px-8" style={{ marginTop: "calc(-50vh)", marginBottom: "calc(-100px)", marginLeft: "calc(50% - 32rem + 7.5vw)", marginRight: "auto" }}>
        {/* Shimmer wrapper */}
        <div className="relative rounded-xl p-px shadow-[0_0_6px_rgba(196,168,130,0.05),0_0_12px_rgba(196,168,130,0.03),0_0_18px_rgba(196,168,130,0.02),0_0_24px_rgba(196,168,130,0.01)]">
          {/* Rotating shimmer beam */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: "conic-gradient(from var(--shimmer-angle, 0deg) at 50% 50%, transparent 0deg, transparent 70deg, rgba(240,235,227,0.15) 80deg, rgba(196,168,130,0.225) 85deg, rgba(240,235,227,0.15) 90deg, transparent 100deg, transparent 250deg, rgba(240,235,227,0.15) 260deg, rgba(196,168,130,0.225) 265deg, rgba(240,235,227,0.15) 270deg, transparent 280deg, transparent 360deg)",
              animation: "shimmer-rotate 30s linear infinite",
            }}
          />
          {/* Static border */}
          <div className="absolute inset-0 rounded-xl border border-[#F0EBE3]/[0.06] pointer-events-none z-10" />
          {/* Keyframes */}
          <style dangerouslySetInnerHTML={{ __html: `
            @property --shimmer-angle {
              syntax: "<angle>";
              initial-value: 0deg;
              inherits: false;
            }
            @keyframes shimmer-rotate {
              from { --shimmer-angle: 0deg; }
              to { --shimmer-angle: 360deg; }
            }
          `}} />

          {/* Dashboard frame — actual content */}
          <div className="relative rounded-[11px] bg-[#111110] overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-[#F0EBE3]/[0.06] px-4 py-2.5 bg-[#0E0E0D]">
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F0EBE3]/[0.06]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#F0EBE3]/[0.06]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#F0EBE3]/[0.06]" />
              </div>
              <div className="w-px h-3.5 bg-[#F0EBE3]/[0.06] ml-1" />
              <Image src="/icon-2.0.1.svg" alt="FoyerFind" width={14} height={14} className="opacity-50" />
              <span className="text-[11px] font-mono text-[#6A655F] uppercase tracking-[0.15em]">FoyerFind</span>
            </div>
            <span className="text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.15em]">
              Interactive Demo
            </span>
          </div>

          {/* App layout: sidebar + content */}
          <div className="flex min-h-[420px] sm:min-h-[480px]">
            {/* Sidebar */}
            <div className="hidden sm:flex w-44 flex-col border-r border-[#F0EBE3]/[0.06] bg-[#0E0E0D] p-3">
              <div className="text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] px-2.5 py-2 mb-1">
                Workspace
              </div>
              {(
                [
                  { key: "buyers" as const, label: "Clients", icon: Users, count: "3" },
                  { key: "properties" as const, label: "Properties", icon: Building2, count: null },
                  { key: "deals" as const, label: "Deals", icon: Briefcase, count: "3" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveTab(item.key);
                    setSelectedBuyer(null);
                  }}
                  className={`w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] transition-colors duration-150 cursor-pointer mb-0.5 ${
                    activeTab === item.key
                      ? "bg-[#F0EBE3]/[0.06] text-[#F0EBE3]"
                      : "text-[#6A655F] hover:text-[#8A857F] hover:bg-[#F0EBE3]/[0.02]"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                  {item.count && (
                    <span className="ml-auto text-[9px] font-mono text-[#4A4540]">{item.count}</span>
                  )}
                </button>
              ))}

              <div className="h-px bg-[#F0EBE3]/[0.06] my-2.5" />

              {[
                { label: "Calls", icon: Phone },
                { label: "Email", icon: MessageSquare },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-[#3A3530] mb-0.5"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                  <span className="ml-auto text-[8px] font-mono text-[#3A3530] border border-[#F0EBE3]/[0.04] px-1 rounded">
                    soon
                  </span>
                </div>
              ))}

              {/* Sidebar user */}
              <div className="mt-auto pt-3 border-t border-[#F0EBE3]/[0.06]">
                <div className="flex items-center gap-2 px-2.5 py-1">
                  <div className="w-5 h-5 rounded-full bg-[#1A1918] flex items-center justify-center text-[8px] font-mono text-[#6A655F]">
                    A
                  </div>
                  <span className="text-[11px] text-[#4A4540] truncate">demo@foyerfind.com</span>
                </div>
              </div>
            </div>

            {/* Mobile tabs */}
            <div className="sm:hidden flex border-b border-[#F0EBE3]/[0.06] w-full">
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
                  className={`flex-1 py-2.5 text-[11px] font-mono transition-colors cursor-pointer ${
                    activeTab === item.key
                      ? "text-[#F0EBE3] border-b border-[#F0EBE3]/30"
                      : "text-[#4A4540]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 p-4 sm:p-5 overflow-auto">
              <TabContent
                activeTab={activeTab}
                selectedBuyer={selectedBuyer}
                setSelectedBuyer={setSelectedBuyer}
              />
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* ============ PANEL 01: HOW IT WORKS ============ */}
      <section className="relative">
        {/* The inset frame IS the 3 boxes — one border, bisected by two vertical lines */}
        <div className="mx-3 sm:mx-6 lg:mx-8 my-3 sm:my-6 lg:my-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#F0EBE3]/[0.06]">
            {[
              {
                label: "01",
                title: "Add your clients",
                description:
                  "Create buyer profiles with preferences, budget, and timeline. Track where each client is in their search.",
              },
              {
                label: "02",
                title: "Curate properties",
                description:
                  "Build shortlists with your notes, match reasoning, and strategy. Show your expertise — not just auto-alerts.",
              },
              {
                label: "03",
                title: "Share the dashboard",
                description:
                  "Send each client a private link. They see your picks, leave feedback, and track their deal. No app download required.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`relative overflow-hidden p-6 sm:p-8 lg:p-10 aspect-auto sm:aspect-square flex flex-col justify-between ${
                  i > 0 ? "border-t sm:border-t-0 sm:border-l border-[#F0EBE3]/[0.06]" : ""
                }`}
              >
                {(i === 0 || i === 1 || i === 2) && (
                  <div className="absolute inset-[10px] overflow-hidden rounded-sm">
                    <div className="absolute -inset-6 blur-[12px]">
                      <Image
                        src={i === 0 ? "/standing.png" : i === 1 ? "/house.png" : "/phone.png"}
                        alt=""
                        fill
                        className="object-cover object-center"
                      />
                    </div>
                    <div className="absolute inset-0 bg-[#0C0B0A]/80" />
                    <div
                      className="absolute inset-0 mix-blend-overlay opacity-[1]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 2048 2048' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='f${i}'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23f${i})' opacity='1'/%3E%3C/svg%3E")`,
                      }}
                    />
                  </div>
                )}
                <div className="relative z-10">
                  {"label" in item && item.label && (
                    <span className="text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] block mb-4">
                      {item.label}
                    </span>
                  )}
                  <h3 className={`${display.className} text-xl sm:text-2xl lg:text-3xl`}>
                    {item.title}
                  </h3>
                </div>
                <p className="relative z-10 text-[13px] text-[#6A655F] leading-relaxed mt-6 sm:mt-0">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PANEL 02: PRICING ============ */}
      <section
        id="pricing"
        className="min-h-screen relative border-t border-[#F0EBE3]/[0.06] flex flex-col justify-center"
      >
        {/* Background image */}
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
        <div className="absolute inset-3 sm:inset-6 lg:inset-8 border border-[#F0EBE3]/[0.06] pointer-events-none z-10" />

        {/* Vertical edge label */}
        <span
          className="hidden lg:block absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.3em] z-10"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg) translateX(50%)" }}
        >
          No contracts · Cancel anytime
        </span>

        {/* Panel number */}
        <span className="absolute top-5 sm:top-8 lg:top-10 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] z-10">
          04
        </span>

        <div className="relative z-10 px-5 sm:px-10 lg:px-16 py-20 sm:py-24">
          <h2
            className={`${display.className} text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.85] tracking-[-0.02em] mb-8`}
          >
            PRICING
          </h2>

          {/* Features summary */}
          <div className="mb-14 sm:mb-16">
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
                /month
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

      {/* ============ PANEL 02: CONTACT ============ */}
      <section
        id="contact"
        className="min-h-screen relative border-t border-[#F0EBE3]/[0.06]"
      >
        {/* Inset frame */}
        <div className="absolute inset-3 sm:inset-6 lg:inset-8 border border-[#F0EBE3]/[0.06] pointer-events-none" />

        {/* Vertical edge label */}
        <span
          className="hidden lg:block absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.3em]"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg) translateX(50%)" }}
        >
          15 min · Free · No obligation
        </span>

        {/* Panel number */}
        <span className="absolute top-5 sm:top-8 lg:top-10 left-5 sm:left-8 lg:left-10 text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em]">
          05
        </span>

        <div className="pt-20 sm:pt-28 lg:pt-32 px-5 sm:px-10 lg:px-16 pb-16">
          <h2
            className={`${display.className} text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.85] tracking-[-0.02em] mb-10`}
          >
            CONTACT
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 max-w-5xl">
            {/* Email form */}
            <div className="border border-[#F0EBE3]/[0.08] p-6 sm:p-8 lg:p-10">
              <div className="text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] mb-6">
                Send a message
              </div>
              <form
                action="https://api.web3forms.com/submit"
                method="POST"
                className="space-y-5"
              >
                <input type="hidden" name="access_key" value="ee809368-55bc-43b2-871f-e0510885bae4" />
                <div>
                  <label className="text-[11px] font-mono text-[#6A655F] uppercase tracking-[0.1em] block mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full bg-transparent border-b border-[#F0EBE3]/[0.1] focus:border-[#C4A882]/40 text-[14px] text-[#F0EBE3] py-2 outline-none transition-colors duration-200 placeholder:text-[#3A3530]"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-[#6A655F] uppercase tracking-[0.1em] block mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full bg-transparent border-b border-[#F0EBE3]/[0.1] focus:border-[#C4A882]/40 text-[14px] text-[#F0EBE3] py-2 outline-none transition-colors duration-200 placeholder:text-[#3A3530]"
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-[#6A655F] uppercase tracking-[0.1em] block mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    required
                    rows={4}
                    className="w-full bg-transparent border-b border-[#F0EBE3]/[0.1] focus:border-[#C4A882]/40 text-[14px] text-[#F0EBE3] py-2 outline-none transition-colors duration-200 resize-none placeholder:text-[#3A3530]"
                    placeholder="How can we help?"
                  />
                </div>
                <button
                  type="submit"
                  className="text-[11px] font-mono uppercase tracking-[0.15em] border border-[#F0EBE3]/20 hover:border-[#F0EBE3]/50 px-6 py-2.5 transition-colors duration-200 mt-2"
                >
                  Send message
                </button>
              </form>
            </div>

            {/* Calendly */}
            <div className="border border-[#F0EBE3]/[0.08] lg:border-l-0 overflow-hidden">
              <div className="p-6 sm:p-8 lg:p-10 pb-0 sm:pb-0 lg:pb-0">
                <div className="text-[9px] font-mono text-[#4A4540] uppercase tracking-[0.2em] mb-2">
                  Or book a call
                </div>
              </div>
              <iframe
                src="https://calendly.com/andy-phtlabs/discovery?embed_type=Inline&background_color=0c0b0a&text_color=a19a92&primary_color=c4a882"
                width="100%"
                height="600"
                title="Book a discovery call"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="border-0"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-[#F0EBE3]/[0.06] px-5 sm:px-8 py-6">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-[#3A3530] uppercase tracking-[0.15em]">
            © 2026 phtlabs
          </span>
          <a
            href="https://phtlabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-[#3A3530] hover:text-[#6A655F] uppercase tracking-[0.15em] transition-colors duration-150"
          >
            phtlabs.com
          </a>
        </div>
      </footer>
    </div>
  );
}
