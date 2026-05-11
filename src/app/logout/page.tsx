import { LogoutOnLoad } from "@/components/auth/logout-on-load";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LogoutPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <LogoutOnLoad />
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Signing out</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You will be redirected to sign in.
        </CardContent>
      </Card>
    </main>
  );
}
