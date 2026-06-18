import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** /{company}/dashboard/clients/new → /{company}/dashboard/customers/new */
export default async function ClientsNewRedirectPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/customers/new`);
}
