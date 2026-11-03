import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'clashprime_sticky_headers';
let stickyHeaders = true;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => stickyHeaders;

export async function loadStickyHeadersPref(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === 'on' || stored === 'off') stickyHeaders = stored === 'on';
    listeners.forEach(listener => listener());
  } catch (error) { console.warn('Failed to load header preference', error); }
}

async function setStickyHeaders(enabled: boolean): Promise<void> {
  stickyHeaders = enabled;
  listeners.forEach(listener => listener());
  try { await AsyncStorage.setItem(KEY, enabled ? 'on' : 'off'); }
  catch (error) { console.warn('Failed to save header preference', error); }
}

export function useStickyHeaders() {
  return { enabled: useSyncExternalStore(subscribe, snapshot, snapshot), setStickyHeaders };
}
