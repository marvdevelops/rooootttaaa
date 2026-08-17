import { Directory, File, Paths } from 'expo-file-system';
// eslint-disable-next-line import/no-unresolved
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';
import React from 'react';
import { captureRef } from 'react-native-view-shot';

const FPS = 30;

function frameFileName(index: number): string {
  return `frame_${String(index).padStart(5, '0')}.jpg`;
}

/** Fresh scratch directory for one flyby render's frames — wiped and recreated so a retry never mixes frames with a previous attempt. */
export function makeFramesDir(routeId: string): Directory {
  const dir = new Directory(Paths.cache, `flyby_frames_${routeId}`);
  if (dir.exists) dir.delete();
  dir.create();
  return dir;
}

/**
 * Captures the map view on a fixed interval for the given duration, in
 * parallel with whatever animation is running on the map (the camera
 * animation is driven separately — this just samples whatever's on screen).
 * Returns the number of frames captured, which is what the stat-card
 * frames get appended after (see appendFrozenFrames).
 */
export async function captureFramesForDuration(
  viewRef: React.RefObject<React.Component | null>,
  framesDir: Directory,
  durationMs: number,
  onProgress?: (fraction: number) => void,
): Promise<number> {
  const intervalMs = 1000 / FPS;
  const totalFrames = Math.round((durationMs / 1000) * FPS);
  let index = 0;
  const start = Date.now();

  while (Date.now() - start < durationMs) {
    try {
      const tmpUri = await captureRef(viewRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
      const dest = new File(framesDir, frameFileName(index));
      const src = new File(tmpUri);
      if (dest.exists) dest.delete();
      await src.move(dest);
      index += 1;
      onProgress?.(Math.min(1, index / totalFrames));
    } catch {
      // A single dropped frame shouldn't kill the whole render — ffmpeg
      // just sees a shorter sequence, which is imperceptible at 30fps.
    }
    const elapsed = Date.now() - start;
    const nextFrameAt = index * intervalMs;
    const wait = nextFrameAt - elapsed;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  return index;
}

/** Captures a single view (the stat card) repeatedly to hold it as a freeze-frame for `holdMs`. */
export async function appendFrozenFrames(
  viewRef: React.RefObject<React.Component | null>,
  framesDir: Directory,
  startIndex: number,
  holdMs: number,
): Promise<number> {
  const frameCount = Math.round((holdMs / 1000) * FPS);
  const tmpUri = await captureRef(viewRef, { format: 'jpg', quality: 0.9, result: 'tmpfile' });
  const srcFile = new File(tmpUri);

  for (let i = 0; i < frameCount; i++) {
    const dest = new File(framesDir, frameFileName(startIndex + i));
    if (dest.exists) dest.delete();
    // Copy (not move) since the same source frame is reused for every
    // repeated freeze-frame — moving it would leave nothing for frame 2+.
    srcFile.copySync(dest);
  }
  srcFile.delete();
  return startIndex + frameCount;
}

/** Stitches the numbered frame sequence into an MP4 via ffmpeg's image2 demuxer. */
export async function stitchFramesToVideo(framesDir: Directory, outputFile: File): Promise<void> {
  if (outputFile.exists) outputFile.delete();

  const pattern = `${framesDir.uri.replace('file://', '')}/frame_%05d.jpg`;
  const outputPath = outputFile.uri.replace('file://', '');
  const command = `-y -framerate ${FPS} -i "${pattern}" -c:v mpeg4 -q:v 4 -pix_fmt yuv420p "${outputPath}"`;

  const session = await FFmpegKit.execute(command);
  const returnCode = await session.getReturnCode();
  if (!ReturnCode.isSuccess(returnCode)) {
    const logs = await session.getAllLogsAsString();
    throw new Error(`Video encoding failed: ${logs.slice(-300)}`);
  }
}

export function cleanupFramesDir(framesDir: Directory): void {
  try {
    if (framesDir.exists) framesDir.delete();
  } catch {
    // Best-effort cleanup — leftover cache files aren't worth surfacing an error over.
  }
}
