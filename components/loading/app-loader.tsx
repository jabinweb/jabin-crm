import { cn } from '@/lib/utils';
import { getClientBrandConfig, OPSLANE_DEFAULT_LOGO_PATH } from '@/lib/branding';

/** Inline copy of /brand/opslane-mark.svg so the first paint needs no extra request. */
function DefaultMark({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      aria-hidden
    >
      <rect width="64" height="64" rx="14" fill="#0f766e" />
      <path
        d="M32 12c-9.389 0-17 7.611-17 17s7.611 17 17 17 17-7.611 17-17-7.611-17-17-17zm0 6.5c5.799 0 10.5 4.701 10.5 10.5S37.799 39.5 32 39.5 21.5 34.799 21.5 29 26.201 18.5 32 18.5z"
        fill="#fff"
        opacity="0.95"
      />
      <path d="M20 44.5h24" stroke="#99f6e4" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M24 50h16"
        stroke="#ccfbf1"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

/**
 * Full-screen branded loader for app bootstrap (session resolving, first redirect).
 * Page-level loading inside the shell should keep using skeletons instead.
 */
export function AppLoader({
  className,
  label,
}: {
  className?: string;
  /** Optional status line, e.g. "Opening your workspace". */
  label?: string;
}) {
  const brand = getClientBrandConfig();
  const customLogo = brand.logoUrl && brand.logoUrl !== OPSLANE_DEFAULT_LOGO_PATH;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background',
        className
      )}
    >
      <div className="app-loader-mark flex items-center gap-3">
        {customLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt=""
            width={44}
            height={44}
            className="shrink-0 rounded-[22%]"
          />
        ) : (
          <DefaultMark size={44} />
        )}
        <span className="text-xl font-semibold tracking-tight text-foreground">
          {brand.appName}
        </span>
      </div>

      <div className="h-1 w-44 overflow-hidden rounded-full bg-muted">
        <div className="app-loader-bar h-full w-1/3 rounded-full bg-primary" />
      </div>

      {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
      <span className="sr-only">Loading {brand.appName}</span>
    </div>
  );
}
