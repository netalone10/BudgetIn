"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "@/components/ThemeToggle";
import ChangePasswordModal from "@/components/ChangePasswordModal";
import ManageCategoriesModal from "@/components/ManageCategoriesModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, KeyRound, ShieldCheck, ListPlus } from "lucide-react";

interface Props {
  onCategoriesChange?: () => void;
}

export default function Navbar({ onCategoriesChange }: Props) {
  const { data: session } = useSession();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  // Email user = tidak punya sheetsId (tidak login via Google)
  const isEmailUser = !session?.sheetsId;

  // Admin status langsung dari session (dihitung server-side saat login)
  const isAdminUser = session?.isAdmin === true;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">BudgetIn</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              — catat pengeluaranmu
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <ThemeToggle />

            {session?.user && (
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-1 rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage
                      src={session.user.image ?? ""}
                      alt={session.user.name ?? ""}
                    />
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.user.email}
                    </p>
                    {isEmailUser && (
                      <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        Email · tanpa Google Sheets
                      </span>
                    )}
                  </div>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setShowManageCategories(true)}
                  >
                    <ListPlus className="mr-2 h-4 w-4" />
                    Kelola Kategori
                  </DropdownMenuItem>

                  {/* Ganti Password — hanya untuk email users */}
                  {isEmailUser && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setShowChangePassword(true)}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Ganti Password
                    </DropdownMenuItem>
                  )}

                  {/* Admin Panel — hanya untuk admin */}
                  {isAdminUser && (
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => window.location.href = "/admin"}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
                      Admin Panel
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Modal Kelola Kategori */}
      {showManageCategories && (
        <ManageCategoriesModal 
          onClose={() => setShowManageCategories(false)} 
          onSaved={() => onCategoriesChange?.()} 
        />
      )}

      {/* Modal Ganti Password */}
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </>
  );
}
