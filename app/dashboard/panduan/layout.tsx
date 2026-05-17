// Static-ish content — help/documentation page that rarely changes
export const revalidate = 3600;

export default function PanduanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
