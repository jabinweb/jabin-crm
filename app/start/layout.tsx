export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-stone-50">{children}</div>
  );
}
