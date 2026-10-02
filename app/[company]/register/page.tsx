'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INDUSTRY_PICKER_OPTIONS } from '@/lib/industry-aliases';

const formSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  companyName: z
    .string()
    .min(2, 'Company name must be at least 2 characters')
    .max(100, 'Company name must not exceed 100 characters'),
  website: z
    .string()
    .url('Invalid website URL')
    .max(255, 'Website URL must not exceed 255 characters'),
  businessVertical: z.string().optional(),
});

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const companySlug = typeof params?.company === 'string' ? params.company : '';
  const { data: session, status } = useSession();
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    if (session.user.role === 'SUPER_ADMIN') {
      router.replace('/admin');
      return;
    }
    const slug = session.user.companySlug?.trim();
    // No workspace yet — stay on /{slug}/register to complete org signup (matches proxy)
    if (!slug) return;
    router.replace(`/${slug}/dashboard`);
  }, [status, session, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      companyName: '',
      website: '',
      businessVertical: 'general',
    }
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setSubmitError('');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Something went wrong on our side. Please try again in a moment.');
      }

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      toast.success('Account created', {
        description: 'Sign in to continue. Your company will be reviewed before the workspace goes live.',
      });

      const registeredSlug = result.data?.companySlug as string | undefined;
      router.push(
        registeredSlug
          ? `/auth/signin?callbackUrl=${encodeURIComponent(`/${registeredSlug}/onboarding`)}`
          : companySlug
            ? `/auth/signin?callbackUrl=${encodeURIComponent(`/${companySlug}/onboarding`)}`
            : '/auth/signin'
      );
    } catch (error) {
      console.error('Registration error:', error);
      const message = error instanceof Error ? error.message : 'Registration failed';
      setSubmitError(message);
      toast.error(message);
    }
  };

  const redirectingAway =
    status === 'authenticated' &&
    session?.user &&
    (session.user.role === 'SUPER_ADMIN' || !!session.user.companySlug?.trim());

  if (status === 'loading' || redirectingAway) {
    return (
      <AuthShell>
        <div className="flex min-h-[320px] items-center justify-center" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--lp-muted)]" />
          <span className="sr-only">{redirectingAway ? 'Redirecting…' : 'Loading…'}</span>
        </div>
      </AuthShell>
    );
  }

  const fields = [
    { name: 'name', label: 'Your name', type: 'text', placeholder: 'Priya Sharma', autocomplete: 'name' },
    { name: 'email', label: 'Work email', type: 'email', placeholder: 'you@company.com', autocomplete: 'email' },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      placeholder: '8+ characters, upper, lower and a number',
      autocomplete: 'new-password',
    },
    { name: 'companyName', label: 'Company name', type: 'text', placeholder: 'Acme Service Co', autocomplete: 'organization' },
    { name: 'website', label: 'Company website', type: 'url', placeholder: 'https://acme.com', autocomplete: 'url' },
  ] as const;

  const isSubmitting = form.formState.isSubmitting;

  return (
    <AuthShell>
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="font-[family-name:var(--font-landing-display)] text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--lp-ink)]">
            Register your company
          </h2>
          <p className="text-sm text-[var(--lp-muted)]">
            Create your admin account. We review new companies before the workspace goes live.
          </p>
        </div>

        {submitError ? (
          <Alert variant="destructive" className="rounded-lg">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {fields.map((field) => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name}
                render={({ field: formField }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-medium text-[var(--lp-ink)]">{field.label}</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        type={field.type}
                        placeholder={field.placeholder}
                        autoComplete={field.autocomplete}
                        className="h-11 border-slate-200 bg-white shadow-sm focus-visible:ring-[var(--lp-accent)]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <FormField
              control={form.control}
              name="businessVertical"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium text-[var(--lp-ink)]">Industry</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11 border-slate-200 bg-white shadow-sm">
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDUSTRY_PICKER_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="h-11 w-full bg-[var(--lp-accent)] text-white shadow-sm hover:bg-[var(--lp-accent-deep)]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </Button>

            <p className="text-center text-xs leading-relaxed text-[var(--lp-muted)]">
              By creating an account you agree to the{' '}
              <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--lp-ink)]">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--lp-ink)]">
                Privacy policy
              </Link>
              .
            </p>
          </form>
        </Form>

        <p className="text-center text-sm text-[var(--lp-muted)]">
          Already have an account?{' '}
          <Link
            href={
              companySlug
                ? `/auth/signin?callbackUrl=${encodeURIComponent(`/${companySlug}/dashboard`)}`
                : '/auth/signin'
            }
            className="font-medium text-[var(--lp-accent-deep)] hover:text-[var(--lp-accent)] hover:underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
