import { UserRole, CompanyStatus } from '@prisma/client'

// Exclude UserRole from auth.ts since it is exported by enums.ts
export type UserRoleType = UserRole
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'loading'

export interface CompanyRelation {
  id: string
  name: string
  status: CompanyStatus
}

export interface ValidationIssue {
  path: (string | number)[]
  message: string
}

export interface LoginResponse {
  success: boolean
  error?: string
  redirectTo?: string
  issues?: ValidationIssue[]
}
