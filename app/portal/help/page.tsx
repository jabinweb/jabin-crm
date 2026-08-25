import { redirect } from 'next/navigation';

/** Legacy /portal/help → unified support hub */
export default function PortalHelpRedirect() {
  redirect('/portal/support');
}
