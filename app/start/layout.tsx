export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 h-[100dvh] overflow-hidden bg-stone-50">{children}</div>
  );
}
