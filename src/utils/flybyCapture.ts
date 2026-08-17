import { captureRef } from 'react-native-view-shot';
import React from 'react';

/**
 * Captures the stat card as a shareable static image. Video export (frame
 * capture + ffmpeg stitching) was dropped from this build — ffmpeg-kit-
 * react-native's iOS binaries 404 (the project was retired/archived by its
 * maintainer in 2025 and the prebuilt frameworks pulled from CocoaPods).
 * This is the fallback: still gives people something to share, just a static
 * image instead of a video. Revisit video export via a proper plan (e.g.
 * server-side rendering, per the spec's Phase 2) rather than another
 * on-device ffmpeg dependency.
 */
export async function captureStatCardImage(viewRef: React.RefObject<React.Component | null>): Promise<string> {
  return captureRef(viewRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' });
}
