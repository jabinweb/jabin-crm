import { redirect } from 'next/navigation';

type Props = { params: Promise<{ company: string }> };

/** Trash folder — unified inbox with folder=trash. */
export default async function EmailTrashPage({ params }: Props) {
  const { company } = await params;
  redirect(`/${company}/dashboard/emails?folder=trash`);
}
