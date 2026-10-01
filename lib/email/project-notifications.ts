import {
  isPlatformEmailConfigured,
  sendActionEmail,
  type ActionEmailContent,
} from './action-email';

export { isPlatformEmailConfigured };
export type ProjectEmailContent = ActionEmailContent;

export async function sendProjectNotificationEmail(params: {
  to: string;
  recipientName?: string | null;
  projectName?: string | null;
  url: string;
  content: ProjectEmailContent;
}) {
  return sendActionEmail({
    to: params.to,
    recipientName: params.recipientName,
    contextLabel: params.projectName,
    url: params.url,
    content: params.content,
    footer:
      'You are receiving this because you are assigned to, watching, or mentioned in this project.',
  });
}
