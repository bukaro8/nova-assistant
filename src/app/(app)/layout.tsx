import { AppBottomNav } from "@/components/app-bottom-nav";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen">
      <AppBottomNav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:pl-60 md:pr-8 md:pt-8">
        {children}
      </main>
    </div>
  );
}
