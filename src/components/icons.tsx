import React from 'react';
import Svg, { Path, Polygon } from 'react-native-svg';
import { colors } from '../theme/theme';

export function UndoIcon({ size = 22, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 7L4 12l5 5M4 12h11a5 5 0 000-10"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function ExportIcon({ size = 18, color = colors.sand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3v13m0 0l-4-4m4 4l4-4M5 21h14"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ImportIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 16V3m0 13l-4-4m4 4l4-4M5 21h14"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ShareIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FileIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3v5a1 1 0 001 1h5M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FlagIcon({ size = 15, color = colors.sand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Polygon points="0,0 0,14 13,7" fill={color} />
    </Svg>
  );
}

export function NoteFlagIcon({ size = 15, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 21V4" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M6 4h13l-3.5 4L19 12H6" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function BookmarkIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SaveIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 3h11l4 4v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path d="M8 3v6h8V3" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M8 21v-7h8v7" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}

export function SendIcon({ size = 18, color = colors.sand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12l16-8-6 16-3-7-7-1z" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ReplyIcon({ size = 14, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 17l-6-6 6-6M3 11h11a6 6 0 016 6v2" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-8 0v13a1 1 0 001 1h8a1 1 0 001-1V7"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BackIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronUpIcon({ size = 14, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 15l6-6 6 6" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.4-4 4.6-6 8-6s6.6 2 8 6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function UsersIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c1.2-3.6 3.8-5.5 6.5-5.5s5.3 1.9 6.5 5.5M16.5 5.2a3.5 3.5 0 010 6.6M20 20c-.7-2.2-1.9-3.8-3.5-4.7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function GearIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.4 13a7.97 7.97 0 000-2l2.1-1.6-2-3.5-2.5 1a8 8 0 00-1.7-1L14.9 3H9.1l-.4 2.9a8 8 0 00-1.7 1l-2.5-1-2 3.5L4.6 11a7.97 7.97 0 000 2l-2.1 1.6 2 3.5 2.5-1a8 8 0 001.7 1l.4 2.9h5.8l.4-2.9a8 8 0 001.7-1l2.5 1 2-3.5L19.4 13z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function LoopIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12a8 8 0 0114-5.3M20 4v5h-5M20 12a8 8 0 01-14 5.3M4 20v-5h5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CompassIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21a9 9 0 100-18 9 9 0 000 18z" stroke={color} strokeWidth={2.2} />
      <Path
        d="M15.5 8.5l-2.2 5.2-5.2 2.2 2.2-5.2 5.2-2.2z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CalendarIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 4h14a1 1 0 011 1v15a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM4 9h16M8 2v4M16 2v4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ClockIcon({ size = 14, color = colors.muted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CameraIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path d="M12 18a4 4 0 100-8 4 4 0 000 8z" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

export function HeartIcon({
  size = 18,
  color = colors.ink,
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20s-7-4.35-9.5-8.8C.8 7.9 2.2 4.5 5.6 4.1c2-.24 3.7.8 4.9 2.4 1.2-1.6 2.9-2.64 4.9-2.4 3.4.4 4.8 3.8 3.1 7.1C19 15.65 12 20 12 20z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color = colors.sand }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 16, color = colors.muted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FilterIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6h16M8 12h8M11 18h2"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.02l7.73 6c4.51-4.18 7.09-10.36 7.09-17.49z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24 24 0 000 21.56l7.98-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export function CheckIcon({ size = 14, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12.5l4.5 4.5L19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LockIcon({ size = 16, color = colors.muted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 10V7a5 5 0 0110 0v3M5 10h14v10H5V10z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BellIcon({ size = 20, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9a6 6 0 1112 0c0 3.5 1 5.5 2 6.5H4c1-1 2-3 2-6.5z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M10 19a2 2 0 004 0" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
