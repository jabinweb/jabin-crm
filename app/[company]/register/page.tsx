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
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BUSINESS_VERTICAL_OPTIONS } from '@/lib/workspace-templates';

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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    if (session.user.role === 'SUPER_ADMIN') {
      router.replace('/dashboard');
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
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/register', { // Fix: Updated API endpoint path
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      toast({
        title: "Registration successful",
        description: "Please wait for admin approval",
      });
      
      router.push(
        companySlug
          ? `/auth/signin?callbackUrl=${encodeURIComponent(`/${companySlug}/dashboard`)}`
          : '/auth/signin'
      );
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Registration failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const redirectingAway =
    status === 'authenticated' &&
    session?.user &&
    (session.user.role === 'SUPER_ADMIN' || !!session.user.companySlug?.trim());

  if (redirectingAway) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-muted-foreground">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full space-y-10 p-12 border-2 border-foreground/5 bg-background shadow-none">
        <div className="text-center border-b border-foreground/5 pb-10">
          <h2 className="text-xl font-black uppercase tracking-[0.25em] text-foreground">Account Genesis</h2>
          <p className="mt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
            Authorized Personnel Only • Node Signup Protocol
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-3">
            {[
              { 
                name: 'name', 
                label: 'Full Name', 
                type: 'text', 
                placeholder: 'John Doe',
                autocomplete: 'name'
              },
              { 
                name: 'email', 
                label: 'Email Address', 
                type: 'email', 
                placeholder: 'john@company.com',
                autocomplete: 'email'
              },
              { 
                name: 'password', 
                label: 'Password', 
                type: 'password', 
                placeholder: '••••••••',
                autocomplete: 'new-password'
              },
              { 
                name: 'companyName', 
                label: 'Company Name', 
                type: 'text', 
                placeholder: 'Your Company Name',
                autocomplete: 'organization'
              },
              { 
                name: 'website', 
                label: 'Company Website', 
                type: 'url', 
                placeholder: 'https://your-company.com',
                autocomplete: 'url'
              }
            ].map((field) => (
              <FormField
                key={field.name}
                control={form.control}
                name={field.name as keyof z.infer<typeof formSchema>}
                render={({ field: formField }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{field.label}</FormLabel>
                    <FormControl>
                      <Input
                        {...formField}
                        type={field.type}
                        placeholder={field.placeholder}
                        autoComplete={field.autocomplete}
                        className="bg-muted/5 border-foreground/10 h-10 px-4 font-mono text-xs"
                      />
                    </FormControl>
                    <FormMessage className="text-[9px] uppercase tracking-tighter" />
                  </FormItem>
                )} 
              />
            ))}

            <FormField
              control={form.control}
              name="businessVertical"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                    Business type
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-muted/5 border-foreground/10 h-10 font-mono text-xs">
                        <SelectValue placeholder="Select your industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BUSINESS_VERTICAL_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[9px] uppercase tracking-tighter" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full h-11 uppercase font-black tracking-[0.2em] border-2 border-foreground hover:bg-foreground hover:text-background transition-all"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Authenticating..." : "Execute Login"}
            </Button>

            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-12 pt-8 border-t border-foreground/5">
              Legacy access available?{' '}
              <Link
                href={
                  companySlug
                    ? `/auth/signin?callbackUrl=${encodeURIComponent(`/${companySlug}/dashboard`)}`
                    : '/auth/signin'
                }
                className="text-foreground underline decoration-1 underline-offset-4 hover:opacity-70 transition-opacity"
              >
                Execute Login
              </Link>
            </p>
          </form>
        </Form>
      </div>
    </div>
  );
}
