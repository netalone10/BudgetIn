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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import ManageCategoriesModal from "@/components/ManageCategoriesModal";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import OnboardingModal from "@/components/OnboardingModal";
import CalculatorModal from "@/components/CalculatorModal";

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Tampilkan onboarding sekali per user (localStorage)
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

  function handleCloseOnboarding() {
    setShowOnboarding(false);
  }

  // Close mobile sidebar on route change
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

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutGrid },
    { name: "Budget", href: "/dashboard/budget", icon: Banknote },
    { name: "Tabungan", href: "/dashboard/savings", icon: PiggyBank },
    { name: "Akun & Dompet", href: "/dashboard/accounts", icon: Wallet },
    { name: "Tagihan", href: "/dashboard/bills", icon: Bell },
    { name: "Arus Kas", href: "/dashboard/cashflow", icon: TrendingDown },
    { name: "Kalender", href: "/dashboard/calendar", icon: CalendarDays },
    { name: "AI Analyst", href: "/dashboard/analyst", icon: Sparkles },
  ];

  if (isAdminUser) {
    navItems.push({ name: "Admin Panel", href: "/admin", icon: ShieldCheck });
  }

  const DesktopSidebar = () => (
    <div
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out border-r border-border bg-card",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b border-border">
        {!isCollapsed && (
          <span className="text-[17px] font-semibold tracking-tight text-foreground whitespace-nowrap">
            BudgetIn
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors group",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="font-medium text-sm">{item.name}</span>}
            </Link>
          );
        })}

        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={() => setShowManageCategories(true)}
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors group text-muted-foreground hover:bg-muted hover:text-foreground",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? "Kategori" : undefined}
          >
            <ListPlus className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="font-medium text-sm">Kategori</span>}
          </button>

          <Link
            href="/dashboard/settings/account-types"
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
              pathname === "/dashboard/settings/account-types" && "bg-primary text-primary-foreground",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? "Tipe Akun" : undefined}
          >
            <Tags className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="font-medium text-sm">Tipe Akun</span>}
          </Link>

          <Link
            href="/dashboard/panduan"
            className={cn(
              "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
              pathname === "/dashboard/panduan" && "bg-primary text-primary-foreground",
              isCollapsed && "justify-center px-0"
            )}
            title={isCollapsed ? "Panduan" : undefined}
          >
            <BookOpen className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="font-medium text-sm">Panduan</span>}
          </Link>

          {isEmailUser && (
            <button
              onClick={() => setShowChangePassword(true)}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors group text-muted-foreground hover:bg-muted hover:text-foreground",
                isCollapsed && "justify-center px-0"
              )}
              title={isCollapsed ? "Ganti Password" : undefined}
            >
              <KeyRound className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">Ganti Password</span>}
            </button>
          )}
        </div>
      </nav>

      <div className={cn("border-t border-border flex flex-col gap-3", isCollapsed ? "p-1.5" : "p-3")}>
        <div className={cn("flex items-center gap-1", isCollapsed ? "justify-center" : "justify-start px-1")}>
          <ThemeToggle compact={isCollapsed} />
          <Button
            variant="ghost"
            size={isCollapsed ? "icon-xs" : "icon-sm"}
            onClick={() => setShowCalculator(true)}
            aria-label="Buka calculator"
            title="Calculator"
          >
            <Calculator className={isCollapsed ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        </div>
        
        {session?.user && (
          <div className={cn(
            "flex items-center rounded-xl p-2 bg-muted/40",
            isCollapsed ? "justify-center" : "gap-3"
          )}>
            <Avatar className="h-8 w-8 shrink-0 border border-border">
              <AvatarImage src={session.user.image ?? ""} alt={session.user.name ?? ""} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{session.user.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{session.user.email}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const MobileTopbarAndNav = () => (
    <div className="md:hidden">
      {/* Topbar — fixed so it doesn't push content; layout.tsx adds pt-14 to offset */}
      <div className="fixed top-0 left-0 right-0 flex h-14 items-center justify-between px-4 border-b border-border bg-background/90 backdrop-blur-md z-40">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          BudgetIn
        </span>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-1.5 rounded-md text-foreground hover:bg-muted transition-colors"
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex transition-all duration-200",
          isMobileOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
            isMobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setIsMobileOpen(false)}
        />

        {/* Drawer */}
        <div
          className={cn(
            "relative w-72 max-w-[82vw] bg-card h-full flex flex-col border-r border-border transition-transform duration-200 ease-in-out",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between px-4 border-b border-border">
            <span className="text-[17px] font-semibold tracking-tight text-foreground">
              BudgetIn
            </span>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-[15px]">{item.name}</span>
                </Link>
              );
            })}

            <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1">
              <button
                onClick={() => { setIsMobileOpen(false); setShowManageCategories(true); }}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
              >
                <ListPlus className="h-5 w-5 shrink-0" />
                <span className="text-[15px]">Kelola Kategori</span>
              </button>
              <Link
                href="/dashboard/settings/account-types"
                onClick={() => setIsMobileOpen(false)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
              >
                <Tags className="h-5 w-5 shrink-0" />
                <span className="text-[15px]">Tipe Akun</span>
              </Link>
              <Link
                href="/dashboard/panduan"
                onClick={() => setIsMobileOpen(false)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
              >
                <BookOpen className="h-5 w-5 shrink-0" />
                <span className="text-[15px]">Panduan</span>
              </Link>
              {isEmailUser && (
                <button
                  onClick={() => { setIsMobileOpen(false); setShowChangePassword(true); }}
                  className="w-full flex items-center gap-3 rounded-xl px-4 py-3 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                >
                  <KeyRound className="h-5 w-5 shrink-0" />
                  <span className="text-[15px]">Ganti Password</span>
                </button>
              )}
            </div>
          </nav>

          <div className="p-4 border-t border-border flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setIsMobileOpen(false); setShowCalculator(true); }}
                aria-label="Buka calculator"
                title="Calculator"
              >
                <Calculator className="h-4 w-4" />
              </Button>
            </div>
            {session?.user && (
              <div className="flex items-center justify-between rounded-xl p-3 bg-muted/40 border border-border/50">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-9 w-9 shrink-0 border border-border">
                    <AvatarImage src={session.user.image ?? ""} alt={session.user.name ?? ""} />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-foreground truncate">{session.user.name}</p>
                    <p className="text-[12px] text-muted-foreground truncate">{session.user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            )}
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
        <OnboardingModal onClose={handleCloseOnboarding} />
      )}
    </>
  );
}
