'use client'

import { BadgeCheck } from 'lucide-react'
import { HrOrgCrudPage } from '@/components/hr/org-crud-page'

export default function DesignationsPage() {
  return (
    <HrOrgCrudPage
      title="Designations"
      description="Job titles and grades for your organization."
      apiPath="/api/hr/designations"
      queryKey="hr-designations"
      icon={BadgeCheck}
      fields={['code', 'level']}
    />
  )
}
