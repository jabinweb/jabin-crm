import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** Sent mail lives in the email log with status filter. */
export default async function EmailSentPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/emails/log?status=SENT`);
}
