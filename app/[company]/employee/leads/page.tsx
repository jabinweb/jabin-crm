'use client'

import { LeadsList } from './leads-list'

export default function EmployeeLeadsPage() {
  // LeadsList renders its own header immediately and only skeletons the table while leads load.
  return <LeadsList />
}
