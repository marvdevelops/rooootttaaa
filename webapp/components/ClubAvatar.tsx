import { RunClub } from '../lib/types';

interface Props {
  club: Pick<RunClub, 'name' | 'avatarUrl'>;
  size?: number;
}

/** Club logo, falling back to the club's first initial on a teal circle when no avatar is set. */
export default function ClubAvatar({ club, size = 48 }: Props) {
  if (club.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={club.avatarUrl}
        alt={club.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--teal)',
        color: 'var(--white)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {club.name.slice(0, 1).toUpperCase()}
    </div>
  );
}
