import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

export class PhotoUploadError extends Error {}

export interface RoutePhoto {
  id: string;
  routeId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Raw storage object paths (not URLs) — needed as-is to delete from storage. */
  storagePath: string;
  thumbnailPath: string | null;
  /** Public display URLs, derived from the paths above. */
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  takenAt: number | null;
  createdAt: number;
  isOwnedByMe: boolean;
}

interface PhotoRow {
  id: string;
  route_id: string;
  user_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
  profiles: { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;
}

const MAX_PHOTOS_PER_ROUTE_PER_USER = 5;
const MAX_PHOTOS_PER_USER_PER_DAY = 20;
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024;

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function publicUrl(path: string): string {
  return supabase.storage.from('route-photos').getPublicUrl(path).data.publicUrl;
}

function toRoutePhoto(row: PhotoRow, viewerId: string | null): RoutePhoto {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    routeId: row.route_id,
    userId: row.user_id,
    username: profile?.username ?? 'unknown',
    avatarUrl: profile?.avatar_url ?? null,
    storagePath: row.storage_path,
    thumbnailPath: row.thumbnail_path,
    imageUrl: publicUrl(row.storage_path),
    thumbnailUrl: row.thumbnail_path ? publicUrl(row.thumbnail_path) : null,
    caption: row.caption,
    takenAt: row.taken_at ? new Date(row.taken_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    isOwnedByMe: row.user_id === viewerId,
  };
}

export async function listRoutePhotos(routeId: string, limit = 50): Promise<RoutePhoto[]> {
  const viewerId = await currentUserId();
  const { data, error } = await supabase
    .from('route_photos')
    .select('*, profiles!user_id(username, avatar_url)')
    .eq('route_id', routeId)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PhotoRow[]).map((row) => toRoutePhoto(row, viewerId));
}

/** Most recent photos sorted by when the run happened (not upload date) — used as trail condition evidence alongside the condition note. */
export async function listRecentTrailPhotos(routeId: string, limit = 2): Promise<RoutePhoto[]> {
  const viewerId = await currentUserId();
  const { data, error } = await supabase
    .from('route_photos')
    .select('*, profiles!user_id(username, avatar_url)')
    .eq('route_id', routeId)
    .eq('is_visible', true)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PhotoRow[]).map((row) => toRoutePhoto(row, viewerId));
}

async function validateUpload(userId: string, routeId: string): Promise<void> {
  const [perRoute, perDay] = await Promise.all([
    supabase.from('route_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('route_id', routeId),
    supabase
      .from('route_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
  ]);

  if ((perRoute.count ?? 0) >= MAX_PHOTOS_PER_ROUTE_PER_USER) {
    throw new PhotoUploadError(`You've already added ${MAX_PHOTOS_PER_ROUTE_PER_USER} photos to this route.`);
  }
  if ((perDay.count ?? 0) >= MAX_PHOTOS_PER_USER_PER_DAY) {
    throw new PhotoUploadError('Daily photo limit reached. Try again tomorrow.');
  }
}

export interface PickedPhoto {
  uri: string;
  fileSize?: number;
}

/** Opens the photo library — EXIF explicitly disabled so GPS coordinates never leave the device (a photo taken at home before a run would otherwise leak a user's address). */
export async function pickPhotoFromLibrary(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new PhotoUploadError('Photo library permission denied — enable it in Settings to add a photo.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
    exif: false,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return { uri: asset.uri, fileSize: asset.fileSize };
}

/** Same EXIF-stripping guarantee as the library picker, for photos taken in-app. */
export async function takePhotoWithCamera(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new PhotoUploadError('Camera permission denied — enable it in Settings to take a photo.');
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
    exif: false,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return { uri: asset.uri, fileSize: asset.fileSize };
}

export interface UploadRoutePhotoInput {
  routeId: string;
  photo: PickedPhoto;
  caption: string;
  takenAt: Date;
  completionId?: string;
}

/** Resizes to a max 1200px-wide main image + a 400x300 thumbnail, uploads both, then inserts the route_photos row. Rate-limited per route and per day. */
export async function uploadRoutePhoto(input: UploadRoutePhotoInput): Promise<void> {
  const userId = await currentUserId();
  if (!userId) throw new PhotoUploadError('You must be signed in to add a photo.');

  if (input.photo.fileSize && input.photo.fileSize > MAX_ORIGINAL_BYTES) {
    throw new PhotoUploadError('That photo is too large (max 10MB).');
  }

  await validateUpload(userId, input.routeId);

  // Imported lazily (not at module scope) — expo-image-manipulator is a native
  // module, and requireNativeModule() throws immediately on import if it isn't
  // linked in the running binary. A static import would crash every screen
  // that pulls in this file (route detail, via the photo gallery) on any
  // build that predates this feature's native rebuild. Deferring it here
  // means only the upload action itself fails, gracefully, until then.
  let ImageManipulator: typeof import('expo-image-manipulator');
  try {
    ImageManipulator = await import('expo-image-manipulator');
  } catch {
    throw new PhotoUploadError('Photo uploads need the latest app update. Please update Rootah and try again.');
  }

  const [main, thumb] = await Promise.all([
    ImageManipulator.manipulateAsync(input.photo.uri, [{ resize: { width: 1200 } }], {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }),
    ImageManipulator.manipulateAsync(
      input.photo.uri,
      [{ resize: { width: 400, height: 300 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    ),
  ]);

  if (!main.base64 || !thumb.base64) throw new PhotoUploadError('Failed to process photo.');

  const photoId = crypto.randomUUID();
  const mainPath = `${input.routeId}/${userId}/${photoId}.jpg`;
  const thumbPath = `${input.routeId}/${userId}/${photoId}_thumb.jpg`;

  const [mainRes, thumbRes] = await Promise.all([
    supabase.storage.from('route-photos').upload(mainPath, decode(main.base64), { contentType: 'image/jpeg' }),
    supabase.storage.from('route-photos').upload(thumbPath, decode(thumb.base64), { contentType: 'image/jpeg' }),
  ]);
  if (mainRes.error) throw new PhotoUploadError(mainRes.error.message);
  if (thumbRes.error) throw new PhotoUploadError(thumbRes.error.message);

  const { error } = await supabase.from('route_photos').insert({
    id: photoId,
    route_id: input.routeId,
    user_id: userId,
    completion_id: input.completionId ?? null,
    storage_path: mainPath,
    thumbnail_path: thumbPath,
    caption: input.caption.trim() || null,
    taken_at: input.takenAt.toISOString().slice(0, 10),
  });
  if (error) throw new PhotoUploadError(error.message);
}

export async function deleteRoutePhoto(photoId: string, storagePath: string, thumbnailPath: string | null): Promise<void> {
  const paths = thumbnailPath ? [storagePath, thumbnailPath] : [storagePath];
  await supabase.storage.from('route-photos').remove(paths).catch(() => {});

  const { error } = await supabase.from('route_photos').delete().eq('id', photoId);
  if (error) throw new Error(error.message);
}
