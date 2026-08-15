export type ClubRole = 'member' | 'admin' | 'owner';
export type ClubMembershipStatus = 'active' | 'pending' | 'removed';

export interface RunClub {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  isPrivate: boolean;
  memberCount: number;
  createdBy: string;
  createdAt: number;
  /** null if the current user isn't a member (or membership isn't active). */
  myRole: ClubRole | null;
  myStatus: ClubMembershipStatus | null;
}

export interface ClubMember {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: ClubRole;
  status: ClubMembershipStatus;
  joinedAt: number;
}
