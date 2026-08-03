'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'

const formSchema = z.object({
  policyId: z.string().min(1, 'Leave type is required'),
  startDate: z.date(),
  endDate: z.date(),
  reason: z.string().min(1, 'Reason is required'),
})

type LeaveRequestFormValues = z.infer<typeof formSchema>

type PolicyOption = {
  id: string
  policy: { id: string; name: string; code: string }
  entitled: number
  used: number
  pending: number
}

interface LeaveRequestFormProps {
  onSuccess?: () => void
}

export function LeaveRequestForm({ onSuccess }: LeaveRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const { data: balances = [] } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: async () => {
      const res = await fetch('/api/employee/leave/balances')
      if (!res.ok) throw new Error('Failed to load policies')
      return (await res.json()) as PolicyOption[]
    },
  })

  const form = useForm<LeaveRequestFormValues>({
    resolver: zodResolver(formSchema),
  })

  async function onSubmit(data: LeaveRequestFormValues) {
    try {
      setIsSubmitting(true)
      const policy = balances.find((b) => b.policy.id === data.policyId)?.policy
      const response = await fetch('/api/employee/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyId: data.policyId,
          type: policy?.code || 'ANNUAL',
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
          reason: data.reason,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to submit leave request')
      }

      toast({ title: 'Leave request submitted successfully' })
      void queryClient.invalidateQueries({ queryKey: ['leave-balances'] })
      void queryClient.invalidateQueries({ queryKey: ['ess-leave-balances'] })
      void queryClient.invalidateQueries({ queryKey: ['employee-leave-requests'] })
      onSuccess?.()
      form.reset()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to submit leave request',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="policyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Leave Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {balances.map((b) => {
                    const remaining = b.entitled - b.used - b.pending
                    return (
                      <SelectItem key={b.policy.id} value={b.policy.id}>
                        {b.policy.name} ({remaining} left)
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const maxDate = new Date()
                      maxDate.setMonth(today.getMonth() + 3)
                      return date < today || date > maxDate
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => {
                      const startDate = form.getValues('startDate')
                      const maxDate = new Date()
                      maxDate.setMonth(maxDate.getMonth() + 3)
                      return (startDate && date < startDate) || date > maxDate
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Please provide a reason for your leave request"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </form>
    </Form>
  )
}
