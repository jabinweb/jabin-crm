import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** Legacy equipment list → canonical inventory route. */
export default async function EquipmentRedirectPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/inventory`);
}
