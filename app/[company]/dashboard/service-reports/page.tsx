import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** Legacy sidebar path; consolidated into main reporting. */
export default async function ServiceReportsRedirectPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/reports`);
}
