import { redirect } from 'next/navigation';

/**
 * /{company}/dashboard/clients → consolidated into /dashboard/customers
 * Kept as a redirect so bookmarks and old links don't 404.
 */
export default function ClientsRedirectPage() {
  redirect('/dashboard/customers');
}
