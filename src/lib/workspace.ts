import type { Banner, Preset } from '@/lib/types';

const WORKSPACE_KEY = 'banner-board-workspace';
const PRESETS_KEY = 'banner-board-presets';

export function saveWorkspaceToStorage(banners: Banner[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(banners));
  } catch (error) {
    console.error('Failed to save workspace:', error);
  }
}

export function loadWorkspaceFromStorage(): Banner[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem(WORKSPACE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load workspace:', error);
    return null;
  }
}

export function savePresetsToStorage(presets: Preset[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save presets:', error);
  }
}

export function loadPresetsFromStorage(): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(PRESETS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load presets:', error);
    return [];
  }
}
