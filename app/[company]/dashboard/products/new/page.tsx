"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DashboardLink } from "@/components/navigation/dashboard-link";
import { useToast } from "@/hooks/use-toast";
import { useWorkspacePaths } from "@/hooks/use-workspace-paths";
import { workspaceSlugHeaders } from "@/lib/api/workspace-slug";
import { humanizeEnum } from "@/lib/crm/humanize-enum";

/** Same category values the catalog list filters on. */
const CATEGORIES = ["HARDWARE", "SOFTWARE", "SERVICES", "CONSUMABLE", "OTHER"];

const formSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters"),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.coerce.number().min(0, "Price can't be negative"),
  quantity: z.coerce.number().int("Quantity must be a whole number").min(0, "Quantity can't be negative"),
  category: z.string().min(1, "Choose a category"),
});

type FormData = z.infer<typeof formSchema>;

export default function NewProductPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const params = useParams<{ company: string }>();
  const { path, slug } = useWorkspacePaths();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      sku: "",
      price: 0,
      quantity: 0,
      category: "HARDWARE",
    },
  });

  async function onSubmit(values: FormData) {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...workspaceSlugHeaders(slug ?? params.company),
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Could not create the product");
      }

      toast({
        title: "Product created",
        description: `${values.name.trim()} was added to the catalog.`,
      });
      router.push(path("/dashboard/products"));
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <DashboardLink href="/dashboard/products">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to products
        </DashboardLink>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New product</h1>
        <p className="text-sm text-muted-foreground">
          Add an item to your catalog so it can be used on quotes, invoices and stock.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Pro workstation bundle" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="What is it, and who is it for?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {humanizeEnum(c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SKU-10042" {...field} />
                      </FormControl>
                      <FormDescription>Must be unique if set.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening stock</FormLabel>
                      <FormControl>
                        <Input type="number" inputMode="numeric" min={0} step={1} placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" asChild>
                  <DashboardLink href="/dashboard/products">Cancel</DashboardLink>
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "Creating…" : "Create product"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
