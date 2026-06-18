import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** Legacy equipment/new → canonical inventory/new route. */
export default async function EquipmentNewRedirectPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/inventory/new`);
}
