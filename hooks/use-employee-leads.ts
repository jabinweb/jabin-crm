import { useQuery } from '@tanstack/react-query'
import { LeadStatus, CompanyTaskPriority, Lead } from '@prisma/client'

export type LeadTableItem = Lead & {
  assignedTo?: { name: string } | null;
};

interface UseEmployeeLeadsParams {
  employeeId?: string
  status?: LeadStatus[]
  priority?: CompanyTaskPriority[]
}

export function useEmployeeLeads({ employeeId, status, priority }: UseEmployeeLeadsParams) {
  return useQuery<LeadTableItem[]>({
    queryKey: ['employee-leads', employeeId, status, priority],
    queryFn: async () => {
      if (!employeeId) return []
      
      const params = new URLSearchParams()
      status?.forEach(s => params.append('status', s))
      priority?.forEach(p => params.append('priority', p))

      const response = await fetch(`/api/employee/leads?${params}`)
      if (!response.ok) throw new Error('Failed to fetch leads')
      
      const data = await response.json()
      return data
    },
    enabled: !!employeeId
  })
}
