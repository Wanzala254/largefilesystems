// Lucide icons type declarations
declare module 'lucide-react' {
  import * as React from 'react';

  export const AlertCircle: React.FC<{ className?: string }>
  export const AlertTriangle: React.FC<{ className?: string }>
  export const Eye: React.FC<{ className?: string }>
  export const Wifi: React.FC<{ className?: string }>
  export const CheckCircle: React.FC<{ className?: string }>
  export const Shield: React.FC<{ className?: string }>
  export const EyeOff: React.FC<{ className?: string }>
  export const Lock: React.FC<{ className?: string }>
  export const Activity: React.FC<{ className?: string }>
  export const RefreshCw: React.FC<{ className?: string }>
  export const BarChart3: React.FC<{ className?: string }>
  export const Settings: React.FC<{ className?: string }>
  export const MapIcon: React.FC<{ className?: string }>
  export const ClockIcon: React.FC<{ className?: string }>
  export const UserIcon: React.FC<{ className?: string }>
}

// date-fns type declarations
declare module 'date-fns' {
  export function formatDistanceToNow(date: Date, options?: { addSuffix?: boolean }): string
}