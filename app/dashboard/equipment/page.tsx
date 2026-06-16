import { redirect } from 'next/navigation'

/** List view not implemented; entry point is the new-equipment flow. */
export default function EquipmentIndexRedirectPage() {
  redirect('/dashboard/equipment/new')
}
