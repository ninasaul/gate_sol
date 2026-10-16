'use client';

import { SolarIcon } from '@/components/SolarIcon';

interface EmptyProps {
  icon: string;
  text: string;
  /** compact：左栏拒绝区等矮空位 */
  size?: 'default' | 'compact';
  className?: string;
}

export function Empty({ icon, text, size = 'default', className = '' }: EmptyProps) {
  return (
    <div
      className={`empty-state ${size === 'compact' ? 'empty-state--compact' : ''} ${className}`.trim()}
      role="status"
    >
      <SolarIcon name={icon} size={size === 'compact' ? 16 : 22} className="empty-state__icon" />
      <span className="empty-state__text">{text}</span>
    </div>
  );
}
