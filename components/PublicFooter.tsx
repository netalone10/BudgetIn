import Link from "next/link";

const publicLinks = [
  { href: "/about", label: "Tentang" },
  { href: "/contact", label: "Kontak" },
  { href: "/privacy", label: "Kebijakan Privasi" },
  { href: "/terms", label: "Syarat & Ketentuan" },
];

export default function PublicFooter() {
  return (
    <footer className="relative z-10 space-y-4 border-t border-border py-10 text-center">
      <span className="block text-[15px] font-semibold tracking-tight text-foreground">
        BudgetIn
      </span>
      <p className="mx-auto max-w-2xl px-6 text-[13px] font-medium text-muted-foreground">
        &copy; 2026 BudgetIn - Aplikasi pencatat keuangan responsif dan aman yang dikembangkan oleh{" "}
        <a
          href="https://amuharr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline underline-offset-4"
        >
          Akbar Muharram
        </a>
        .
      </p>
      <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 text-[13px] font-medium text-muted-foreground" aria-label="Navigasi legal dan informasi">
        {publicLinks.map((link, index) => (
          <span key={link.href} className="inline-flex items-center gap-4">
            {index > 0 ? <span aria-hidden="true">&middot;</span> : null}
            <Link href={link.href} className="transition-colors hover:text-primary">
              {link.label}
            </Link>
          </span>
        ))}
      </nav>
    </footer>
  );
}
