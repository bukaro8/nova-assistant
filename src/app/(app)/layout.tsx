import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { authOptions } from "@/server/auth/options";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <AppBottomNav />
      <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:pl-60 md:pr-8 md:pt-8">
        {children}
      </main>
    </div>
  );
}
