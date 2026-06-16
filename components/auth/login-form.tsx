'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Mail, Lock } from "lucide-react";
import { loginSchema } from "@/lib/validations/auth";
import type { LoginInput } from "@/lib/validations/auth";
import { useRouter } from 'next/navigation';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import GoogleSignIn from "./google-signin";

interface LoginFormProps {
  type: 'user' | 'employee';
  title: string;
  subtitle: string;
  redirectPath: string;
  registerPath: string;
}

export function LoginForm({ type, title, subtitle, redirectPath, registerPath }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      isEmployee: type === 'employee'
    }
  });

  async function onSubmit(data: LoginInput) {
    try {
      console.log('[Login Form] Submitting:', { email: data.email });
      setError(null);
      form.clearErrors();
      
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      
      console.log('[Login Form] SignIn result:', result);
      
      if (result?.error) {
        console.error('[Login Form] Login failed:', result.error);
        setError(result.error === 'CredentialsSignin' ? 'Invalid email or password' : result.error);
      } else if (result?.ok) {
        console.log('[Login Form] Login success, redirecting to:', redirectPath);
        router.push(redirectPath);
      }
    } catch (err) {
      console.error('[Login Form] Submit error:', err);
      setError(err instanceof Error ? err.message : "Failed to sign in");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full space-y-10 p-12 border-2 border-foreground/5 bg-background shadow-none">
        <div className="text-center border-b border-foreground/5 pb-10">
          <div className="flex justify-center mb-6">
            <div className="w-3 h-3 bg-foreground" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-[0.25em] text-foreground">{title}</h2>
          <p className="mt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-50">
            {subtitle} • Protocol ID-771
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form 
            onSubmit={form.handleSubmit(onSubmit)} 
            className="space-y-6"
            // Prevent default form submission
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                form.handleSubmit(onSubmit)();
              }
            }}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        {...field}
                        type="email"
                        placeholder="IDENTIFIER: EMAIL"
                        className="pl-10 h-10 rounded-none border-foreground/10 bg-muted/5 font-mono text-xs placeholder:text-muted-foreground/30 focus:border-foreground"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                      <Input
                        {...field}
                        type="password"
                        placeholder="ACCESS CODE"
                        className="pl-10 h-10 rounded-none border-foreground/10 bg-muted/5 font-mono text-xs placeholder:text-muted-foreground/30 focus:border-foreground"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11 uppercase font-black tracking-[0.2em] border-2 border-foreground rounded-none hover:bg-foreground hover:text-background transition-all"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Authenticating..." : "Execute Login"}
            </Button>
          </form>
        </Form>

        <div className="relative mt-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-foreground/10" />
          </div>
          <div className="relative flex justify-center text-[9px] uppercase font-black tracking-widest">
            <span className="bg-background px-4 text-muted-foreground/40">Alternative Gateway</span>
          </div>
        </div>

        <GoogleSignIn />

        <p className="text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/30 pt-8 border-t border-foreground/5">
          New interface required?{" "}
          <Link href={registerPath} className="text-foreground underline decoration-1 underline-offset-4 hover:opacity-70 transition-opacity">
            Register Account
          </Link>
        </p>
      </div>
    </div>
  );
}
