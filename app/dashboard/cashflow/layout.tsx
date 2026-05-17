// User-specific mutable data — always fetch fresh
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CashflowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
