'use client';

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface SignOutButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function SignOutButton({ 
  variant = "outline", 
  size = "default",
  className = ""
}: SignOutButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => signOut({ callbackUrl: "/auth/login" })}
      className={className}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Sign out
    </Button>
  );
}
