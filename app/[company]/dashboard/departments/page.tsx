'use client'

import { Building2 } from 'lucide-react'
import { HrOrgCrudPage } from '@/components/hr/org-crud-page'

export default function DepartmentsPage() {
  return (
    <HrOrgCrudPage
      title="Departments"
      description="Company departments and teams used on employee profiles."
      apiPath="/api/hr/departments"
      queryKey="hr-departments"
      icon={Building2}
      fields={['code']}
    />
  )
}
