'use client';

import { useEmailsInbox } from '@/hooks/use-emails-inbox';
import { EmailsInboxView } from '@/components/email/emails-inbox-view';

export default function EmailsPage() {
  const inbox = useEmailsInbox();

  return <EmailsInboxView {...inbox} />;
}
