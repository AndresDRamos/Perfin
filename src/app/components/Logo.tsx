interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

// Brand mark: shield (protection) + user (identity) + bank pediment with a
// keyhole standing in for the lock — see src/app/icon.svg (used as favicon)
// for the source shape; this inlines it so it can sit next to the wordmark.
export function Logo({ size = 28, withWordmark = true, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M32 3 L56 12 V29 C56 46 46 57 32 61 C18 57 8 46 8 29 V12 Z"
          className="fill-primary-700 dark:fill-primary-500"
        />
        <circle cx="32" cy="21" r="6.5" fill="#ffffff" />
        <path d="M20.5 37 C20.5 28.5 43.5 28.5 43.5 37 L43.5 39 L20.5 39 Z" fill="#ffffff" />
        <rect x="14" y="46" width="36" height="3" rx="1" fill="#ffffff" />
        <rect x="17" y="49" width="3.5" height="7" fill="#ffffff" />
        <rect x="24.5" y="49" width="3.5" height="7" fill="#ffffff" />
        <rect x="32" y="49" width="3.5" height="7" fill="#ffffff" />
        <rect x="39.5" y="49" width="3.5" height="7" fill="#ffffff" />
        <rect x="46" y="49" width="3.5" height="7" fill="#ffffff" />
        <circle cx="32" cy="41.5" r="3.4" className="fill-primary-700 dark:fill-primary-500" />
        <rect x="30.9" y="43.6" width="2.2" height="3.4" className="fill-primary-700 dark:fill-primary-500" />
      </svg>
      {withWordmark && (
        <span className="text-lg font-semibold text-secondary-900 dark:text-secondary-100">
          Perfin
        </span>
      )}
    </span>
  );
}
