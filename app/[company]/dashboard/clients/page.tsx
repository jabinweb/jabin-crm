import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** /{company}/dashboard/clients → /{company}/dashboard/customers */
export default async function ClientsRedirectPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/customers`);
}
