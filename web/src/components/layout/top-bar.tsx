"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Menu,
  Bell,
  Building2,
  LayoutDashboard,
  UserPlus,
  Users,
  Phone,
  Settings,
  LogOut,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/buyers", label: "Clients", icon: Users },
  { href: "/deals", label: "Deals", icon: Briefcase },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/calls", label: "Calls", icon: Phone },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/buyers": "Client Portfolio",
  "/deals": "Deals",
  "/properties": "Properties",
  "/email": "Email Integration",
  "/calls": "Calls",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/leads/")) return "Lead Details";
  if (pathname.startsWith("/buyers/")) return "Client Details";
  if (pathname.startsWith("/deals/")) return "Deal Details";
  if (pathname.startsWith("/properties/")) return "Property Details";
  return "HomeAgent";
}

interface TopBarProps {
  agentName: string;
  agentEmail: string;
  actionCount: number;
}

export function TopBar({ agentName, agentEmail, actionCount }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = agentName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    const supabase = createClient() as any;
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex items-center h-14 border-b px-4 shrink-0 bg-background gap-3">
      {/* Mobile hamburger */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden shrink-0">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-6 pt-6 pb-0">
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              HomeAgent
            </SheetTitle>
          </SheetHeader>
          <Separator className="mt-4" />
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Separator />
          <div className="p-3 space-y-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                pathname === "/settings"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                handleSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
          <Separator />
          <div className="p-4 flex items-center gap-3">
            <Avatar size="sm">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{agentName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {agentEmail}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page title */}
      <h1 className="text-lg font-semibold truncate">{getPageTitle(pathname)}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Notification bell */}
      <Button variant="ghost" size="icon" className="relative shrink-0">
        <Bell className="h-5 w-5" />
        {actionCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {actionCount > 9 ? "9+" : actionCount}
          </span>
        )}
        <span className="sr-only">Notifications</span>
      </Button>

      {/* Agent avatar (desktop) */}
      <div className="hidden md:flex items-center gap-2">
        <Avatar size="sm">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm text-muted-foreground truncate max-w-32">
          {agentName.split(" ")[0]}
        </span>
      </div>
    </header>
  );
}
