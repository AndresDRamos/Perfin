interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}

// Marca del design system ("shield-check"): escudo verde de marca con palomita
// — protección + finanzas al día. Fuente: proyecto Perfin Design System
// (assets/logo/mark-shield-check.svg); src/app/icon.svg la replica como favicon.
export function Logo({ size = 28, withWordmark = true, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 4 L54 12 V28 C54 44 45 54 32 59 C19 54 10 44 10 28 V12 Z" fill="#27B544" />
        <path
          d="M22 32 L30 40 L43 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && <span className="text-heading font-medium text-text">Perfin</span>}
    </span>
  );
}
