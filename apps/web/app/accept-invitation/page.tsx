"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Invitation flow has been removed. Users are now created by organization admins
 * with email/password. Redirect legacy invitation links to login.
 */
export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectUrl = searchParams.get("redirect") || "/login";
    router.replace(redirectUrl);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecionando...</p>
    </div>
  );
}
