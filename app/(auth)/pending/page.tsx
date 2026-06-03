import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PendingPage() {
  return (
    <Card className="border-border shadow-sm text-center">
      <CardHeader>
        <CardTitle className="text-xl">Account pending approval</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Your account has been created. An admin will review and approve it
          before you can sign in.
        </p>
        <p className="text-muted-foreground text-sm">
          Come back and try signing in once you receive confirmation.
        </p>
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
