import { redirect } from 'next/navigation';

/** Legacy /register → unified workspace signup */
export default function RegisterRedirect() {
  redirect('/start');
}
