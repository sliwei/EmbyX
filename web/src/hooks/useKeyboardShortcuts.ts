import { useEffect } from 'react';
import { useAppStore } from '../stores/appStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const s = useAppStore.getState();
      const k = e.key.toLowerCase();

      if (k === 'i') {
        s.setProfileOpen(true);
        return;
      }
      if (k === 'e') {
        s.setViewMode(s.viewMode === 'stream' ? 'grid' : 'stream');
        return;
      }
      if (k === 'r') {
        s.cyclePlayControl();
        return;
      }
      if (k === 'f') {
        document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (k === 'g') {
        void s.loadLibraries();
        s.setLibraryOpen(true);
        return;
      }
      if (k === 'v') {
        void s.openMediaInfo();
        return;
      }
      if (k === 'm') {
        s.toggleMute();
        return;
      }
      if (k === 'j') {
        s.toggleScale();
        return;
      }
      if (k === 'u') {
        s.toggleFavorite();
        return;
      }
      if (k === ' ') {
        e.preventDefault();
        s.requestTogglePlay();
        return;
      }
      if (k === 'w' || e.key === 'ArrowUp') {
        e.preventDefault();
        s.prevVideo();
        return;
      }
      if (k === 's' || e.key === 'ArrowDown') {
        e.preventDefault();
        s.nextVideo();
        return;
      }
      if (k === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('embyx:seek', { detail: -15 }));
        return;
      }
      if (k === 'd' || e.key === 'ArrowRight') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('embyx:seek', { detail: 15 }));
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
