'use client';

import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";
import { startGoogleSignIn } from "@/lib/auth/google-sign-in-client";

export default function GoogleSignIn() {
  const handleClick = async () => {
    await startGoogleSignIn("/workspace");
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      className="w-full"
    >
      <Chrome className="mr-2 h-4 w-4" />
      Sign in with Google
    </Button>
  );
}
