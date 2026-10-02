'use client'

import { useEffect, useState, use } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { ImageUpload } from "@/components/ui/image-upload"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { ArrowLeft } from "lucide-react"
import { FormSkeleton } from '@/components/loading'
import { DashboardLink } from '@/components/navigation/dashboard-link'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { humanizeEnum } from '@/lib/crm/humanize-enum'

/** Same category values the catalog list filters on. */
const CATEGORIES = ['HARDWARE', 'SOFTWARE', 'SERVICES', 'CONSUMABLE', 'OTHER']

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
  price: z
    .string()
    .refine((v) => v.trim() === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter a price of 0 or more"),
  category: z.string().optional(),
  quantity: z
    .string()
    .refine((v) => v.trim() === '' || (Number.isInteger(Number(v)) && Number(v) >= 0), "Enter a whole number of 0 or more"),
  sku: z.string().optional(),
  imageUrl: z.string().optional(),
})

type ProductFormValues = z.infer<typeof formSchema>

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const routeParams = useParams<{ company: string }>()
  const { path, slug } = useWorkspacePaths()

  const resolvedParams = use(params)
  const productId = resolvedParams.id

  const [isLoading, setIsLoading] = useState(true)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      category: "",
      quantity: "",
      sku: "",
      imageUrl: "",
    },
  })

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`, {
          credentials: 'include',
          headers: workspaceSlugHeaders(slug ?? routeParams.company),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch product')
        }

        const data = await response.json()
        form.reset({
          name: data.name,
          description: data.description ?? "",
          price: data.price != null ? String(data.price) : "",
          category: data.category ?? "",
          quantity: data.quantity != null ? String(data.quantity) : "0",
          sku: data.sku ?? "",
          imageUrl: data.imageUrl || "",
        })
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch product"
        })
        router.push(path('/dashboard/products'))
      } finally {
        setIsLoading(false)
      }
    }

    if (productId) {
      fetchProduct()
    }
  }, [productId, form, router, path, slug, routeParams.company])

  async function onSubmit(data: ProductFormValues) {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...workspaceSlugHeaders(slug ?? routeParams.company),
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          category: data.category || null,
          // SKU is unique — send null rather than an empty string when cleared.
          sku: data.sku?.trim() || null,
          price: data.price.trim() === '' ? undefined : parseFloat(data.price),
          quantity: data.quantity.trim() === '' ? undefined : parseInt(data.quantity, 10),
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update product')
      }

      toast({
        title: "Success",
        description: "Product updated successfully"
      })
      router.push(path(`/dashboard/products/${productId}`))
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update product"
      })
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-6">
        <FormSkeleton fields={6} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <DashboardLink href={`/dashboard/products/${productId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to product
          </DashboardLink>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit product</h1>
          <p className="text-sm text-muted-foreground">Update catalog details, pricing and stock.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="min-w-0 space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Product name" {...field} />
                    </FormControl>
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
                      <Input placeholder="SKU" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* Keep legacy free-text categories selectable so saving doesn't drop them. */}
                        {field.value && !CATEGORIES.includes(field.value) ? (
                          <SelectItem value={field.value}>{field.value}</SelectItem>
                        ) : null}
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
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
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-6">
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product image</FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value}
                        onChange={field.onChange}
                        disabled={form.formState.isSubmitting}
                      />
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
                      <Textarea 
                        placeholder="Product description" 
                        className="h-[120px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(path(`/dashboard/products/${productId}`))}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
} 