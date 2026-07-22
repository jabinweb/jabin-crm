import { ServiceRequestForm } from '@/components/service-request/service-request-form';

type Props = { params: Promise<{ token: string }> };

export default async function ServiceRequestPage({ params }: Props) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
        <ServiceRequestForm token={token} />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          No login required · Your request goes straight to the service team
        </p>
      </div>
    </main>
  );
}
