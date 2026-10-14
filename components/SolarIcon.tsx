import { SOLAR_ICONS } from '@/lib/solar-icons';

interface SolarIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function SolarIcon({ name, size = 20, className }: SolarIconProps) {
  const paths = SOLAR_ICONS[name];
  if (!paths) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          opacity={path.opacity ?? undefined}
          fillRule={path.fillRule === 'evenodd' ? 'evenodd' : undefined}
          clipRule={path.clipRule === 'evenodd' ? 'evenodd' : undefined}
        />
      ))}
    </svg>
  );
}
