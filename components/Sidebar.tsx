"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import * as m from "framer-motion/m";
import { LazyMotion, domAnimation } from "framer-motion";
import {
  LayoutGrid,
  Menu,
  X,
  LogOut,
  ListPlus,
  Pin,
  PinOff,
  ShieldCheck,
  KeyRound,
  Sparkles,
  PiggyBank,
  Wallet,
  Tags,
  TrendingDown,
  BookOpen,
  History,
  Bell,
  CalendarDays,
  Banknote,
  Calculator,
  ArrowUpRight,
  Layers3,
  ArchiveRestore,
  UserCog,
  Receipt,
  FileText,
  ListTree,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
const ChangePasswordModal = dynamic(() => import("@/components/ChangePasswordModal"), { ssr: false });
const OnboardingModal = dynamic(() => import("@/components/OnboardingModal"), { ssr: false });
const CalculatorModal = dynamic(() => import("@/components/CalculatorModal"), { ssr: false });

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const PINNED_KEY = "budgetin.sidebar.pinned";

/** Subscribe to cross-tab + same-tab `storage` notifications. */
function subscribeStorage(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getPinnedSnapshot(): boolean {
  return localStorage.getItem(PINNED_KEY) === "1";
}

/** Persist a localStorage value and notify this tab's subscribers. */
function writeStorage(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent("storage", { key }));
}

const sidebarVariants = {
  expanded: { width: "15rem" },
  collapsed: { width: "3.6rem" },
};

const labelVariants = {
  expanded: { opacity: 1, x: 0, transition: { duration: 0.18 } },
  collapsed: { opacity: 0, x: -8, transition: { duration: 0.12 } },
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
        <m.p
          variants={labelVariants}
          className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/55"
        >
          {title}
        </m.p>
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
                "group relative flex h-9 items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  "bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--shadow-offset-x)_var(--shadow-offset-y)_var(--shadow-blur)_var(--shadow-spread)_var(--shadow-color)] hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? item.name : undefined}
              aria-label={isCollapsed ? item.name : undefined}
            >
              {isActive && (
                <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-sidebar-ring" />
              )}
              <Icon className="size-4 shrink-0" />
              {!isCollapsed && (
                <m.span
                  variants={labelVariants}
                  className="min-w-0 flex-1 truncate text-sm font-medium"
                >
                  {item.name}
                </m.span>
              )}
              {!isCollapsed && item.badge && (
                <m.span
                  variants={labelVariants}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    isActive
                      ? "bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground"
                      : "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  {item.badge}
                </m.span>
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

  // Pinned state lives in localStorage; derive collapse from it + hover.
  const isPinned = useSyncExternalStore(subscribeStorage, getPinnedSnapshot, () => false);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const isCollapsed = isPinned ? false : !hoverExpanded;

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Onboarding shows once per user. The "seen" flag is persisted, but a session
  // latch (`onboardingFor`) drives visibility so that marking it seen — done as
  // soon as it opens, so it survives a reload — doesn't immediately re-close it.
  const userId = session?.userId;
  const onboardingKey = userId ? `budgetin_onboarding_${userId}` : null;
  const hasSeenOnboarding = useSyncExternalStore(
    subscribeStorage,
    () => (onboardingKey ? localStorage.getItem(onboardingKey) === "1" : true),
    () => true,
  );
  const [onboardingFor, setOnboardingFor] = useState<string | null>(null);
  if (userId && !hasSeenOnboarding && onboardingFor !== userId) {
    setOnboardingFor(userId); // render-phase latch open; converges
  }
  const showOnboarding = !!userId && onboardingFor === userId;
  useEffect(() => {
    // Persist "seen" the moment onboarding opens so a reload won't show it again.
    if (showOnboarding && onboardingKey) {
      localStorage.setItem(onboardingKey, "1");
    }
  }, [showOnboarding, onboardingKey]);

  // Close the mobile drawer on navigation (render-phase, no effect setState).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setIsMobileOpen(false);
  }

  const isEmailUser = !session?.sheetsId;
  const isAdminUser = session?.isAdmin === true;


  const primaryItems: NavItem[] = [
    { name: "Overview", href: "/dashboard", icon: LayoutGrid, badge: "Home" },
    { name: "Transaksi", href: "/dashboard/transactions", icon: Receipt },
    { name: "Budget", href: "/dashboard/budget", icon: Banknote },
    { name: "Tabungan", href: "/dashboard/savings", icon: PiggyBank },
    { name: "Akun & Dompet", href: "/dashboard/accounts", icon: Wallet },
    { name: "Berulang", href: "/dashboard/recurring", icon: Bell },
    { name: "Keluarga", href: "/dashboard/family", icon: Users, badge: "Beta" },
  ];

  const insightsItems: NavItem[] = [
    { name: "Arus Kas", href: "/dashboard/cashflow", icon: TrendingDown },
    { name: "Kalender", href: "/dashboard/calendar", icon: CalendarDays },
    { name: "Rincian", href: "/dashboard/details", icon: ListTree },
    { name: "Report", href: "/dashboard/report", icon: FileText },
    { name: "AI Analyst", href: "/dashboard/analyst", icon: Sparkles, badge: "AI" },
  ];

  const utilityItems: NavItem[] = [
    { name: "Akun & Data", href: "/dashboard/settings/account", icon: UserCog },
    { name: "Tipe Akun", href: "/dashboard/settings/account-types", icon: Tags },
    { name: "Backup & Restore", href: "/dashboard/settings/backup-restore", icon: ArchiveRestore },
    { name: "Panduan", href: "/dashboard/panduan", icon: BookOpen },
    { name: "Updates", href: "/dashboard/changelog", icon: History },
  ];

  if (isAdminUser) {
    utilityItems.push({ name: "Admin Panel", href: "/admin", icon: ShieldCheck, badge: "Admin" });
  }

  const desktopSidebar = (
    <m.aside
      className="hidden md:sticky md:top-0 md:z-40 md:flex md:h-screen shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      initial={isCollapsed ? "collapsed" : "expanded"}
      animate={isCollapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
      onMouseEnter={() => setHoverExpanded(true)}
      onMouseLeave={() => setHoverExpanded(false)}
      onFocusCapture={() => setHoverExpanded(true)}
    >
      <div className="flex h-full w-full flex-col p-2">
        {/* Header */}
        <div className="mb-3 flex h-[54px] shrink-0 items-center border-b border-sidebar-border pb-2">
          <div
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5",
              isCollapsed && "justify-center px-0"
            )}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Layers3 className="size-4" />
            </div>
            {!isCollapsed && (
              <m.div variants={labelVariants} className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">BudgetIn</p>
                <p className="truncate text-[11px] text-sidebar-foreground/55">
                  {isPinned ? "Pinned" : "Workspace"}
                </p>
              </m.div>
            )}
            <button
              type="button"
              onClick={() => {
                const next = !isPinned;
                if (!next) setHoverExpanded(false);
                writeStorage(PINNED_KEY, next ? "1" : "0");
              }}
              className={cn(
                "ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isPinned && "bg-sidebar-accent text-sidebar-accent-foreground",
                isCollapsed && "hidden"
              )}
              aria-label={isPinned ? "Lepas pin sidebar" : "Pin sidebar tetap terbuka"}
              title={isPinned ? "Lepas pin sidebar" : "Pin sidebar tetap terbuka"}
            >
              {isPinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            </button>
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-3 [scrollbar-width:thin]">
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
              <m.p
                variants={labelVariants}
                className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/55"
              >
                Tools
              </m.p>
            )}

            <Link
              href="/dashboard/categories"
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-md px-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isCollapsed && "justify-center px-0",
                pathname === "/dashboard/categories" && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              title={isCollapsed ? "Kelola Kategori" : undefined}
              aria-label={isCollapsed ? "Kelola Kategori" : undefined}
            >
              <ListPlus className="size-4 shrink-0" />
              {!isCollapsed && (
                <m.span variants={labelVariants} className="truncate text-sm font-medium">
                  Kelola Kategori
                </m.span>
              )}
            </Link>

            <NavSection
              title="Pengaturan"
              items={utilityItems}
              pathname={pathname}
              isCollapsed={isCollapsed}
            />

            {isEmailUser && (
              <button
                onClick={() => setShowChangePassword(true)}
                className={cn(
                  "flex h-9 w-full items-center gap-2 rounded-md px-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isCollapsed && "justify-center px-0"
                )}
                title={isCollapsed ? "Ganti Password" : undefined}
                aria-label={isCollapsed ? "Ganti Password" : undefined}
              >
                <KeyRound className="size-4 shrink-0" />
                {!isCollapsed && (
                  <m.span variants={labelVariants} className="truncate text-sm font-medium">
                    Ganti Password
                  </m.span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="space-y-2 border-t border-sidebar-border pt-2">
          <div
            className={cn(
              "flex items-center rounded-md border border-sidebar-border bg-sidebar-accent/35 p-1",
              isCollapsed ? "justify-center flex-col gap-1" : "justify-between"
            )}
          >
            <ThemeToggle compact={isCollapsed} />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowCalculator(true)}
              aria-label="Buka calculator"
              title="Calculator"
              className="rounded-md shadow-none"
            >
              <Calculator className="size-4" />
            </Button>
          </div>

          {session?.user && (
            <div
              className={cn(
                "rounded-md border border-sidebar-border bg-sidebar-accent/35",
                isCollapsed ? "flex justify-center p-1.5" : "p-2"
              )}
            >
              <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2")}>
                <div className="size-8 shrink-0 overflow-hidden rounded-full border border-sidebar-border">
                  <UserAvatar image={session.user.image} name={session.user.name ?? ""} size={32} />
                </div>

                {!isCollapsed && (
                  <m.div variants={labelVariants} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-sidebar-foreground">
                      {session.user.name}
                    </p>
                    <p className="truncate text-[11px] text-sidebar-foreground/60" title={session.user.email ?? ""}>
                      {session.user.email}
                    </p>
                  </m.div>
                )}

                {!isCollapsed && (
                  <m.button
                    variants={labelVariants}
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="cursor-pointer rounded-md border border-sidebar-border bg-sidebar p-1.5 text-sidebar-foreground/70 transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    title="Logout"
                  >
                    <LogOut className="size-4" />
                  </m.button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </m.aside>
  );

  const mobileTopbarAndNav = (
    <div className="md:hidden">
      <div className="fixed left-0 right-0 top-0 z-40 border-b border-sidebar-border bg-sidebar/90 text-sidebar-foreground backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Layers3 className="size-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/55">
                Dashboard
              </p>
              <p className="text-[15px] font-semibold text-sidebar-foreground">BudgetIn</p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileOpen(true)}
            className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Buka menu"
          >
            <Menu className="size-5" />
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
          onKeyDown={(e) => { if (e.key === "Escape") setIsMobileOpen(false); }}
          role="button"
          tabIndex={-1}
        />

        <m.div
          className={cn(
            "relative h-full w-[86vw] max-w-[360px] border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
          )}
          initial={false}
          animate={{ x: isMobileOpen ? 0 : "-100%" }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
        >
          <div className="flex h-full flex-col">
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/55">
                    Workspace
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-sidebar-foreground">
                    BudgetIn
                  </p>
                  <p className="mt-2 text-sm text-sidebar-foreground/65">
                    Semua alur keuanganmu dalam satu navigasi yang lebih rapi.
                  </p>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="rounded-lg border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  aria-label="Tutup menu"
                >
                  <X className="size-5" />
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
                <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/55">
                  Tools
                </p>
                <Link
                  href="/dashboard/categories"
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-md px-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    pathname === "/dashboard/categories" && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <ListPlus className="size-4 shrink-0" />
                  <span className="text-sm font-medium">Kelola Kategori</span>
                </Link>

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
                        "flex h-9 items-center gap-2 rounded-md px-2 transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 text-sm font-medium">{item.name}</span>
                      {item.badge && (
                        <span className="rounded-md bg-sidebar-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
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
                    className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <KeyRound className="size-4 shrink-0" />
                    <span className="text-sm font-medium">Ganti Password</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 border-t border-sidebar-border pt-4">
              <div className="flex items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent/35 px-3 py-2">
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
                  className="rounded-md shadow-none"
                >
                  <Calculator className="size-4" />
                </Button>
              </div>

              {session?.user && (
                <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/35 p-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 shrink-0 overflow-hidden rounded-full border border-sidebar-border">
                      <UserAvatar image={session.user.image} name={session.user.name ?? ""} size={40} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-sidebar-foreground">
                        {session.user.name}
                      </p>
                      <p className="truncate text-[12px] text-sidebar-foreground/60" title={session.user.email ?? ""}>
                        {session.user.email}
                      </p>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="cursor-pointer rounded-md border border-sidebar-border bg-sidebar p-2 text-sidebar-foreground/70 transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                      title="Logout"
                    >
                      <LogOut className="size-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-sidebar-foreground/60">
                    <ArrowUpRight className="size-3.5" />
                    <span>Siap lanjut mengelola cashflow hari ini.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </m.div>
      </div>
    </div>
  );

  return (
    <LazyMotion features={domAnimation}>
      <>
      {desktopSidebar}
      {mobileTopbarAndNav}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {showCalculator && (
        <CalculatorModal onClose={() => setShowCalculator(false)} />
      )}

      {showOnboarding && (
        <OnboardingModal onClose={() => setOnboardingFor(null)} />
      )}
      </>
    </LazyMotion>
  );
}
