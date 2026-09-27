import { useCallback, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

export type ShareImagePayload = {
  dialogTitle?: string;
  scale?: number;
  format?: 'png' | 'jpg' | 'webm';
  quality?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  errorMessage?: string;
};

/**
 * Captures a view ref as a high-res PNG and opens the native share sheet.
 * Returns an error message on failure (null on success), so callers can
 * surface it however they like (toast, hint bar, dialog).
 */
export async function shareCapturedView(
  ref: RefObject<View | null>,
  payload: ShareImagePayload = {}
): Promise<string | null> {
  const {
    dialogTitle,
    scale = 3,
    format = 'png',
    quality = 1,
    mimeType = 'image/png',
    width,
    height,
    errorMessage = 'Could not share right now.',
  } = payload;

  try {
    if (!ref.current) return 'Nothing to capture yet.';
    const size =
      width !== undefined && height !== undefined
        ? { width: width * scale, height: height * scale }
        : {};
    const uri = await captureRef(ref, { format, quality, ...size });
    if (!(await Sharing.isAvailableAsync())) {
      return 'Sharing is not available on this device.';
    }
    await Sharing.shareAsync(uri, { mimeType, dialogTitle });
    return null;
  } catch {
    return errorMessage;
  }
}

/**
 * React-hook wrapper around {@link shareCapturedView} exposing `sharing`,
 * the latest `error`, and a stable `share` callback that can be passed
 * straight to a button's onPress.
 */
export function useShareImage(ref: RefObject<View | null>, base: ShareImagePayload = {}) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const share = useCallback(
    async (overrides: ShareImagePayload = {}): Promise<string | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setSharing(true);
      setError(null);
      try {
        const err = await shareCapturedView(ref, { ...base, ...overrides });
        if (err) setError(err);
        return err;
      } finally {
        setSharing(false);
        busyRef.current = false;
      }
    },
    [ref, base]
  );

  return {
    share,
    sharing,
    error,
    clearError: () => setError(null),
  };
}