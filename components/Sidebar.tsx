"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutGrid,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  ListPlus,
  ShieldCheck,
  KeyRound,
  Sparkles,
  PiggyBank,
  Wallet,
  Tags,
  TrendingDown,
  BookOpen,
  Bell,
  CalendarDays,
  Banknote,
  Calculator,
  ArrowUpRight,
  Layers3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import ManageCategoriesModal from "@/components/ManageCategoriesModal";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import OnboardingModal from "@/components/OnboardingModal";
import CalculatorModal from "@/components/CalculatorModal";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

function NavSection({
  title,
  items,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-2">
      {!isCollapsed && (
        <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
          {title}
        </p>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 transition-all duration-200",
                isActive
                  ? "bg-foreground text-background shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                  : "text-muted-foreground hover:bg-card hover:text-foreground",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              {isActive && (
                <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary" />
              )}
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.name}
                  </span>
                  {item.badge && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        isActive
                          ? "bg-background/14 text-background"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    const userId = session?.userId;
    if (userId) {
      const key = `budgetin_onboarding_${userId}`;
      if (!localStorage.getItem(key)) {
        setShowOnboarding(true);
        localStorage.setItem(key, "1");
      }
    }
  }, [session?.userId]);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  const isEmailUser = !session?.sheetsId;
  const isAdminUser = session?.isAdmin === true;

  const handleCategoriesChanged = () => {
    window.dispatchEvent(new CustomEvent("categoriesChanged"));
  };

  const primaryItems: NavItem[] = [
    { name: "Overview", href: "/dashboard", icon: LayoutGrid, badge: "Home" },
    { name: "Budget", href: "/dashboard/budget", icon: Banknote },
    { name: "Tabungan", href: "/dashboard/savings", icon: PiggyBank },
    { name: "Akun & Dompet", href: "/dashboard/accounts", icon: Wallet },
    { name: "Tagihan", href: "/dashboard/bills", icon: Bell },
  ];

  const insightsItems: NavItem[] = [
    { name: "Arus Kas", href: "/dashboard/cashflow", icon: TrendingDown },
    { name: "Kalender", href: "/dashboard/calendar", icon: CalendarDays },
    { name: "AI Analyst", href: "/dashboard/analyst", icon: Sparkles, badge: "AI" },
  ];

  const utilityItems: NavItem[] = [
    { name: "Tipe Akun", href: "/dashboard/settings/account-types", icon: Tags },
    { name: "Panduan", href: "/dashboard/panduan", icon: BookOpen },
  ];

  if (isAdminUser) {
    utilityItems.push({ name: "Admin Panel", href: "/admin", icon: ShieldCheck, badge: "Admin" });
  }

  const DesktopSidebar = () => (
    <div
      className={cn(
        "hidden md:flex md:h-screen md:sticky md:top-0 transition-all duration-300 ease-in-out border-r border-border/70 bg-muted/30 backdrop-blur-xl",
        isCollapsed ? "w-[92px]" : "w-[320px]"
      )}
    >
      <div className="flex w-full flex-col p-4">
        <div className="mb-4 rounded-[28px] border border-border/70 bg-card/90 p-3 shadow-sm">
          <div className={cn("flex items-start gap-3", isCollapsed && "justify-center")}>
            {!isCollapsed && (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Layers3 className="h-5 w-5" />
              </div>
            )}
            <div className={cn("min-w-0 flex-1", isCollapsed && "hidden")}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Workspace
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                    BudgetIn
                  </p>
                </div>
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="rounded-xl border border-border bg-background p-2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            {isCollapsed && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="rounded-2xl border border-border bg-background p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
          </div>

        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-3">
          <NavSection
            title="Utama"
            items={primaryItems}
            pathname={pathname}
            isCollapsed={isCollapsed}
          />
          <NavSection
            title="Insight"
            items={insightsItems}
            pathname={pathname}
            isCollapsed={isCollapsed}
          />

          <div className="space-y-2">
            {!isCollapsed && (
              <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                Tools
              </p>
            )}

            <button
              onClick={() => setShowManageCategories(true)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? "Kelola Kategori" : undefined}
            >
              <ListPlus className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <span className="text-sm font-medium">Kelola Kategori</span>
              )}
            </button>

            <NavSection
              title="hidden"
              items={utilityItems}
              pathname={pathname}
              isCollapsed={isCollapsed}
            />

            {isEmailUser && (
              <button
                onClick={() => setShowChangePassword(true)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-muted-foreground transition-colors hover:bg-card hover:text-foreground",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? "Ganti Password" : undefined}
              >
                <KeyRound className="h-5 w-5 shrink-0" />
                {!isCollapsed && (
                  <span className="text-sm font-medium">Ganti Password</span>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-3">
          <div
            className={cn(
              "rounded-[24px] border border-border/70 bg-card/90 p-3 shadow-sm",
              isCollapsed && "px-2"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2",
                isCollapsed ? "justify-center" : "justify-between"
              )}
            >
              <ThemeToggle compact={isCollapsed} />
              <Button
                variant="ghost"
                size={isCollapsed ? "icon-xs" : "icon-sm"}
                onClick={() => setShowCalculator(true)}
                aria-label="Buka calculator"
                title="Calculator"
                className="rounded-xl"
              >
                <Calculator className={isCollapsed ? "h-3 w-3" : "h-4 w-4"} />
              </Button>
            </div>

            {!isCollapsed && (
              <div className="mt-3 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                Quick utility untuk hitung cepat tanpa pindah halaman.
              </div>
            )}
          </div>

          {session?.user && (
            <div
              className={cn(
                "rounded-[24px] border border-border/70 bg-card/90 p-3 shadow-sm",
                isCollapsed ? "flex justify-center" : ""
              )}
            >
              <div
                className={cn(
                  "flex items-center",
                  isCollapsed ? "justify-center" : "gap-3"
                )}
              >
                <Avatar className="h-10 w-10 shrink-0 border border-border">
                  <AvatarImage src={session.user.image ?? ""} alt={session.user.name ?? ""} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>

                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {session.user.name}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {session.user.email}
                    </p>
                  </div>
                )}

                {!isCollapsed && (
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-xl border border-border bg-background p-2 text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const MobileTopbarAndNav = () => (
    <div className="md:hidden">
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <Layers3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Dashboard
              </p>
              <p className="text-[15px] font-semibold text-foreground">BudgetIn</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileOpen(true)}
            className="rounded-xl border border-border bg-card p-2 text-foreground transition-colors hover:bg-muted"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 flex transition-all duration-200",
          isMobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-200",
            isMobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsMobileOpen(false)}
        />

        <div
          className={cn(
            "relative h-full w-[86vw] max-w-[360px] border-r border-border bg-background p-4 transition-transform duration-200 ease-in-out",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="rounded-[28px] border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Workspace
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                    BudgetIn
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Semua alur keuanganmu dalam satu navigasi yang lebih rapi.
                  </p>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="rounded-xl border border-border bg-background p-2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Tutup menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 space-y-5 overflow-y-auto pb-4">
              <NavSection
                title="Utama"
                items={primaryItems}
                pathname={pathname}
                isCollapsed={false}
                onNavigate={() => setIsMobileOpen(false)}
              />
              <NavSection
                title="Insight"
                items={insightsItems}
                pathname={pathname}
                isCollapsed={false}
                onNavigate={() => setIsMobileOpen(false)}
              />

              <div className="space-y-2">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                  Tools
                </p>
                <button
                  onClick={() => {
                    setIsMobileOpen(false);
                    setShowManageCategories(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                >
                  <ListPlus className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">Kelola Kategori</span>
                </button>

                {utilityItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
                        isActive
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-card hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1 text-sm font-medium">{item.name}</span>
                      {item.badge && (
                        <span className="rounded-full bg-background/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}

                {isEmailUser && (
                  <button
                    onClick={() => {
                      setIsMobileOpen(false);
                      setShowChangePassword(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                  >
                    <KeyRound className="h-5 w-5 shrink-0" />
                    <span className="text-sm font-medium">Ganti Password</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-border/70 pt-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-3 py-2">
                <ThemeToggle />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setIsMobileOpen(false);
                    setShowCalculator(true);
                  }}
                  aria-label="Buka calculator"
                  title="Calculator"
                  className="rounded-xl"
                >
                  <Calculator className="h-4 w-4" />
                </Button>
              </div>

              {session?.user && (
                <div className="rounded-[24px] border border-border bg-card p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 shrink-0 border border-border">
                      <AvatarImage src={session.user.image ?? ""} alt={session.user.name ?? ""} />
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {session.user.name}
                      </p>
                      <p className="truncate text-[12px] text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="rounded-xl border border-border bg-background p-2 text-muted-foreground transition-colors hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
                      title="Logout"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    <span>Siap lanjut mengelola cashflow hari ini.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileTopbarAndNav />

      {showManageCategories && (
        <ManageCategoriesModal
          onClose={() => setShowManageCategories(false)}
          onSaved={handleCategoriesChanged}
        />
      )}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {showCalculator && (
        <CalculatorModal onClose={() => setShowCalculator(false)} />
      )}

      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
    </>
  );
}
