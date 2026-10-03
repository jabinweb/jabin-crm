'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { loginSchema } from "@/lib/validations/auth";
import type { LoginInput } from "@/lib/validations/auth";
import { useRouter } from 'next/navigation';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleIcon } from "@/components/auth/google-icon";
import { startGoogleSignIn } from "@/lib/auth/google-sign-in-client";

interface LoginFormProps {
  type: 'user' | 'employee';
  title: string;
  subtitle: string;
  redirectPath: string;
  registerPath: string;
}

export function LoginForm({ type, title, subtitle, redirectPath, registerPath }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      isEmployee: type === 'employee'
    }
  });

  const submitting = form.formState.isSubmitting;

  async function onSubmit(data: LoginInput) {
    try {
      setError(null);

      const result = await signIn('credentials', {
        email: data.email.trim().toLowerCase(),
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          result.error === 'CredentialsSignin'
            ? 'Incorrect email or password.'
            : "We couldn't sign you in. Please try again."
        );
      } else if (result?.ok) {
        router.push(redirectPath);
      }
    } catch {
      setError("We couldn't sign you in. Check your connection and try again.");
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await startGoogleSignIn("/workspace");
    } catch {
      setError('Google sign-in failed. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[var(--lp-ink)] sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm text-[var(--lp-muted)]">{subtitle}</p>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-[var(--lp-ink)]">Work email</FormLabel>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        className="h-11 border-slate-200 bg-white pl-10 shadow-sm focus-visible:ring-[var(--lp-accent)]"
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-[var(--lp-ink)]">Password</FormLabel>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <FormControl>
                      <Input
                        {...field}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="h-11 border-slate-200 bg-white pl-10 pr-11 shadow-sm focus-visible:ring-[var(--lp-accent)]"
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-accent)]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end">
              <Link
                href="/auth/forgot-password"
                className="py-2 text-xs text-[var(--lp-muted)] hover:text-[var(--lp-accent-deep)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="h-11 w-full bg-[var(--lp-accent)] text-white shadow-sm hover:bg-[var(--lp-accent-deep)]"
              disabled={submitting || googleLoading}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </Form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full bg-[var(--lp-line)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--lp-surface)] px-3 text-[var(--lp-muted)]">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-slate-200 bg-white text-[var(--lp-ink)] shadow-sm hover:bg-slate-50"
          onClick={handleGoogle}
          disabled={submitting || googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="mr-2.5 h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <GoogleIcon className="mr-2.5 h-5 w-5" />
          )}
          Continue with Google
        </Button>

        <p className="text-center text-sm text-[var(--lp-muted)]">
          New here?{" "}
          <Link
            href={registerPath}
            className="font-medium text-[var(--lp-accent-deep)] underline-offset-4 hover:underline"
          >
            Create your employee account
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
