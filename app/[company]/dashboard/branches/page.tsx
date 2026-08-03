'use client'

import { MapPin } from 'lucide-react'
import { HrOrgCrudPage } from '@/components/hr/org-crud-page'

export default function BranchesPage() {
  return (
    <HrOrgCrudPage
      title="Branches"
      description="Offices and work locations for employees."
      apiPath="/api/hr/branches"
      queryKey="hr-branches"
      icon={MapPin}
      fields={['code', 'city', 'address']}
    />
  )
}
