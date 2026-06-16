import { redirect } from 'next/navigation';

/**
 * /{company}/dashboard/clients/new → consolidated into /dashboard/customers/new
 * Kept as a redirect so bookmarks and old links don't 404.
 */
export default function ClientsNewRedirectPage() {
  redirect('/dashboard/customers/new');
}
