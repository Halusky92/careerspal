export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div data-hide-site-footer className="contents">{children}</div>;
}
