import { LeadStatus, Priority, ActivityType } from "@prisma/client"

// Re-export prisma enums
export { LeadStatus, Priority, ActivityType }

// Base types for consistent employee data
interface EmployeeBase {
  id: string
  name: string
  avatar: string | null
}

interface EmployeeWithEmail extends EmployeeBase {
  email: string
}

// Activity related types
export interface LeadActivity {
  id: string
  activityType: ActivityType
  description: string
  employeeId?: string | null
  userId?: string | null
  dueDate?: Date | null
  completed: boolean
  createdAt: Date
  updatedAt: Date
  employee?: EmployeeBase | null
  user?: { id: string, name: string } | null
}

// Document related types
export interface LeadDocument {
  id: string
  name: string
  type: string
  url: string
  employeeId: string
  createdAt: Date
  updatedAt: Date
  uploadedBy: EmployeeBase
}

// Lead types
export interface Lead {
  id: string
  companyName: string
  name?: string | null
  status: LeadStatus
  source: string
  value: number | null
  priority: Priority
  employeeId?: string | null
  userId: string
  assignedTo?: { id: string, name: string, avatar: string | null } | null
  employee?: EmployeeBase | null
  contactName?: string | null
  email: string | null
  phone: string | null
  website: string | null
  createdAt: Date
  updatedAt: Date
  lastContactedAt?: Date | null
  convertedAt?: Date | null
  description: string | null
  notes: string | null
  tags: string[]
  convertedClientId?: string | null
  companyId?: string | null
}

// Response type for API
export interface LeadResponse extends Lead {
  _count: {
    activities: number
    documents: number
  }
  activities?: LeadActivity[]
  documents?: LeadDocument[]
}

// Table display type
export interface LeadTableItem {
  id: string
  companyName: string
  name?: string | null
  contactName?: string | null
  email: string | null
  status: LeadStatus
  priority: Priority
  value: number | null
  lastContactedAt?: Date | null
  assignedTo?: { id: string, name: string, avatar: string | null } | null
  employee?: EmployeeBase | null
  _count: {
    activities: number
  }
}

// Form data type
export interface LeadFormData {
  companyName: string
  name?: string
  contactName: string
  email?: string
  phone?: string
  website?: string
  status: LeadStatus
  priority: Priority
  value?: number | null
  source: string
  employeeId?: string
  description?: string
  notes?: string
  tags?: string[]
}
