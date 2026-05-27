export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 grid lg:grid-cols-[1.05fr_1fr] min-h-[calc(100vh-4rem)]">
      {children}
    </div>
  );
}
