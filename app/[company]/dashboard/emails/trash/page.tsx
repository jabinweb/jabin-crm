import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** Trash/archive view — consolidated into email log. */
export default async function EmailTrashPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/emails/log?status=FAILED`);
}
