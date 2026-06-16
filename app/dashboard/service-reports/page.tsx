import { redirect } from 'next/navigation'

/** Legacy sidebar path; consolidated into main reporting. */
export default function ServiceReportsRedirectPage() {
  redirect('/dashboard/reports')
}
