import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  Mail,
  Phone,
  Shield,
  ArrowRight,
  CheckCircle2,
  Star,
  Eye,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          HomeAgent
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How It Works
          </a>
          <a
            href="#why"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Why HomeAgent
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Log In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent" />
      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-green-500" />
            Built for the post-NAR settlement era
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl md:leading-[1.1]">
            The command center for{" "}
            <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              buyer&apos;s agents
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Manage leads, curate properties, share private dashboards with
            buyers, and track deals through closing. Prove your value at every
            step.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link href="/signup">
                Start Free
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base"
              asChild
            >
              <Link href="#features">See How It Works</Link>
            </Button>
          </div>
        </div>

        {/* Dashboard preview mockup */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-xl border bg-card shadow-lg">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <div className="size-3 rounded-full bg-red-400/60" />
              <div className="size-3 rounded-full bg-yellow-400/60" />
              <div className="size-3 rounded-full bg-green-400/60" />
              <span className="ml-3 text-xs text-muted-foreground">
                HomeAgent Dashboard
              </span>
            </div>
            <div className="grid grid-cols-4 gap-4 p-6">
              <StatCard label="Active Buyers" value="12" />
              <StatCard label="Properties Curated" value="47" />
              <StatCard label="Deals in Progress" value="5" />
              <StatCard label="Closed This Month" value="3" />
            </div>
            <div className="grid grid-cols-3 gap-4 px-6 pb-6">
              <div className="col-span-2 space-y-2 rounded-lg border p-4">
                <div className="text-xs font-medium text-muted-foreground">
                  Recent Activity
                </div>
                <ActivityItem
                  text="Sarah Chen favorited 142 Oak Lane"
                  time="2m ago"
                />
                <ActivityItem
                  text='New lead: Marcus Thompson — "Looking for 3BR in Westside"'
                  time="15m ago"
                />
                <ActivityItem
                  text="Offer accepted on 89 Pine St for the Rivera deal"
                  time="1h ago"
                />
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="text-xs font-medium text-muted-foreground">
                  Action Items
                </div>
                <ActionItem text="Send comps to Chen" />
                <ActionItem text="Schedule showing — 77 Elm" />
                <ActionItem text="Follow up with Rivera" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ActivityItem({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <span className="text-foreground/80">{text}</span>
      <span className="shrink-0 text-muted-foreground">{time}</span>
    </div>
  );
}

function ActionItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <div className="size-3 shrink-0 rounded border" />
      <span className="text-foreground/80">{text}</span>
    </div>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: LayoutDashboard,
      title: "Agent Command Center",
      description:
        "Your entire business at a glance. Pipeline view, buyer portfolio, action items, and activity feed — all in one place.",
    },
    {
      icon: Eye,
      title: "Buyer Private Dashboard",
      description:
        "Share a branded, token-based dashboard with each buyer. They see curated properties, your notes, and deal progress — no login required.",
    },
    {
      icon: Building2,
      title: "Property Curation",
      description:
        "Hand-pick and rank properties for each buyer with your expert reasoning. This isn't auto-alerts — it's demonstrable expertise.",
    },
    {
      icon: TrendingUp,
      title: "Deal Tracking",
      description:
        "Track every deal from prospecting through closing. Stage-based pipeline keeps you and your buyers aligned on what's next.",
    },
    {
      icon: Users,
      title: "Lead Management",
      description:
        "Capture, qualify, and convert leads. Track temperature, last activity, and next steps. Never let a lead slip through.",
    },
    {
      icon: Mail,
      title: "Email Integration",
      description:
        "Connect your Gmail to see communication history in context. Every email tied to the right buyer and deal automatically.",
    },
  ];

  return (
    <section id="features" className="border-b py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything a buyer&apos;s agent needs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Purpose-built tools that help you manage your business and
            demonstrate your value to clients.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20"
            >
              <div className="mb-4 inline-flex rounded-lg border bg-background p-2.5">
                <feature.icon className="size-5 text-foreground" />
              </div>
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Set up your dashboard",
      description:
        "Sign up, add your buyers, and start building their property shortlists. Import leads or add them manually.",
    },
    {
      step: "02",
      title: "Curate & share",
      description:
        "Pick the best properties, add your professional notes and reasoning, then share a private dashboard link with each buyer.",
    },
    {
      step: "03",
      title: "Track through closing",
      description:
        "Manage offers, strategy notes, and deal progress. Your buyer sees the timeline. Your work speaks for itself.",
    },
  ];

  return (
    <section id="how-it-works" className="border-b bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Up and running in minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No complex setup. No training needed. Just sign up and start
            managing your business better.
          </p>
        </div>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.step} className="relative">
              {i < steps.length - 1 && (
                <ChevronRight className="absolute -right-5 top-8 hidden size-5 text-muted-foreground/40 md:block" />
              )}
              <div className="mb-4 text-4xl font-bold text-muted-foreground/20">
                {step.step}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhySection() {
  const reasons = [
    {
      icon: Shield,
      title: "Justify your commission",
      description:
        "After the NAR settlement, buyers need to see the work you do. HomeAgent makes your research, curation, and negotiation work visible.",
    },
    {
      icon: Star,
      title: "Stand out from other agents",
      description:
        "Most agents send auto-generated MLS alerts. You send a curated dashboard with your expert reasoning on each property.",
    },
    {
      icon: MessageSquare,
      title: "Keep buyers engaged",
      description:
        "Buyers can favorite properties, leave comments, and track deal progress — all through their private dashboard.",
    },
    {
      icon: Phone,
      title: "Everything in one place",
      description:
        "Leads, buyers, properties, deals, emails, calls — stop juggling five different tools. HomeAgent is your single source of truth.",
    },
  ];

  return (
    <section id="why" className="border-b py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Built for the new reality
              <br />
              of buyer representation
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              The 2024 NAR settlement changed everything. Buyer-broker
              agreements are mandatory. Compensation is no longer guaranteed.
              You need to prove your value — and HomeAgent gives you the tools
              to do it.
            </p>
            <div className="mt-8 space-y-3">
              {[
                "Buyer-broker agreements are now required",
                "Agents must demonstrate value to earn commission",
                "Transparency wins trust and referrals",
                "Your work log is your best sales tool",
              ].map((point) => (
                <div key={point} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {reasons.map((reason) => (
              <div key={reason.title} className="space-y-2">
                <reason.icon className="size-5 text-foreground" />
                <h3 className="font-semibold">{reason.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {reason.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BuyerDashboardPreview() {
  return (
    <section className="border-b bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Your buyers get their own dashboard
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A private, branded link — no login required. Buyers see your
            curated picks, leave feedback, and track their deal in real time.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-xl border bg-card shadow-lg">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <div className="size-3 rounded-full bg-red-400/60" />
              <div className="size-3 rounded-full bg-yellow-400/60" />
              <div className="size-3 rounded-full bg-green-400/60" />
              <span className="ml-3 text-xs text-muted-foreground">
                Sarah&apos;s Home Search — Private Dashboard
              </span>
            </div>
            <div className="p-6">
              {/* Deal timeline preview */}
              <div className="mb-6 rounded-lg border p-4">
                <div className="mb-3 text-xs font-medium text-muted-foreground">
                  Deal Progress
                </div>
                <div className="flex items-center gap-2">
                  {["Searching", "Touring", "Negotiating", "Closing"].map(
                    (stage, i) => (
                      <div key={stage} className="flex flex-1 items-center gap-2">
                        <div
                          className={`flex size-6 items-center justify-center rounded-full text-[10px] font-medium ${
                            i < 2
                              ? "bg-foreground text-background"
                              : "border bg-muted text-muted-foreground"
                          }`}
                        >
                          {i < 2 ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span
                          className={`text-xs ${
                            i < 2 ? "font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {stage}
                        </span>
                        {i < 3 && (
                          <div
                            className={`hidden h-px flex-1 sm:block ${
                              i < 1 ? "bg-foreground" : "bg-border"
                            }`}
                          />
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
              {/* Property cards preview */}
              <div className="space-y-3">
                <PropertyPreviewCard
                  address="142 Oak Lane, Westside"
                  price="$685,000"
                  beds="3"
                  baths="2"
                  note="Great backyard for the kids. Seller motivated — 45 DOM."
                  rank={1}
                />
                <PropertyPreviewCard
                  address="89 Pine Street, Downtown"
                  price="$720,000"
                  beds="4"
                  baths="2.5"
                  note="Recently renovated kitchen. Walking distance to metro."
                  rank={2}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PropertyPreviewCard({
  address,
  price,
  beds,
  baths,
  note,
  rank,
}: {
  address: string;
  price: string;
  beds: string;
  baths: string;
  note: string;
  rank: number;
}) {
  return (
    <div className="flex items-start gap-4 rounded-lg border bg-background p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium">{address}</span>
          <span className="shrink-0 text-sm font-semibold">{price}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {beds} bed / {baths} bath
        </div>
        <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
          Agent note: {note}
        </div>
      </div>
    </div>
  );
}

function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Ready to run your business
            <br />
            like a professional?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Join the buyer&apos;s agents who are using HomeAgent to manage
            clients, demonstrate value, and close more deals.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 px-8 text-base" asChild>
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base"
              asChild
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="text-sm font-medium">HomeAgent</div>
        <div className="flex gap-6 text-sm text-muted-foreground">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Log In
          </Link>
          <Link href="/signup" className="transition-colors hover:text-foreground">
            Sign Up
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <WhySection />
      <BuyerDashboardPreview />
      <CTASection />
      <Footer />
    </div>
  );
}
