'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
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
import { format } from 'date-fns'

const formSchema = z.object({
  policyId: z.string({ required_error: 'Choose a leave type' }).min(1, 'Choose a leave type'),
  startDate: z.date({ required_error: 'Pick the dates you need off' }),
  endDate: z.date({ required_error: 'Pick the dates you need off' }),
  reason: z.string({ required_error: 'Add a short reason' }).trim().min(1, 'Add a short reason'),
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
    defaultValues: { policyId: '', reason: '' },
  })

  const startDate = useWatch({ control: form.control, name: 'startDate' })
  const endDate = useWatch({ control: form.control, name: 'endDate' })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDate = new Date(today)
  maxDate.setMonth(today.getMonth() + 3)

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
          // Calendar days, not local-midnight instants (IST midnight is the previous
          // day in UTC, which shifted leave dates/years on the server)
          startDate: format(data.startDate, 'yyyy-MM-dd'),
          endDate: format(data.endDate, 'yyyy-MM-dd'),
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
              <FormLabel>Leave type</FormLabel>
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

        {/* One range calendar instead of two stacked ones: tap the first day, then the last
            (tap a single day for one-day leave). */}
        <FormField
          control={form.control}
          name="startDate"
          render={() => (
            <FormItem className="flex flex-col">
              <FormLabel>Dates</FormLabel>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {startDate
                  ? endDate && endDate.getTime() !== startDate.getTime()
                    ? `${format(startDate, 'EEE, d MMM')} – ${format(endDate, 'EEE, d MMM yyyy')}`
                    : format(startDate, 'EEE, d MMM yyyy')
                  : 'Tap the first day, then the last day of your leave.'}
              </p>
              <FormControl>
                <Calendar
                  mode="range"
                  className="self-center rounded-md border sm:self-start"
                  selected={startDate ? { from: startDate, to: endDate ?? startDate } : undefined}
                  onSelect={(range) => {
                    const from = range?.from
                    const to = range?.to ?? range?.from
                    form.setValue('startDate', from as Date, { shouldValidate: Boolean(from) })
                    form.setValue('endDate', to as Date, { shouldValidate: Boolean(to) })
                  }}
                  disabled={(date) => date < today || date > maxDate}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Family function, medical appointment"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting…' : 'Submit request'}
        </Button>
      </form>
    </Form>
  )
}
