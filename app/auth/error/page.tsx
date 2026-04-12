import { Suspense } from "react";
import AuthErrorContent from "./AuthErrorContent";

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Memuat...</p></div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
