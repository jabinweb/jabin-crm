import { z } from 'zod'
import { LeadStatus, Priority } from '@prisma/client'

export const leadFormSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  name: z.string().optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  status: z.nativeEnum(LeadStatus),
  priority: z.nativeEnum(Priority),
  value: z.number().optional().nullable(),
  source: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  employeeId: z.string().optional(),
  companyId: z.string().optional()
})

export type LeadFormValues = z.infer<typeof leadFormSchema>
