import { useEffect, useRef } from 'react';
import { BottomChrome } from './components/controls/BottomChrome';
import { ClickToPlayOverlay } from './components/layout/ClickToPlayOverlay';
import { LoadingOverlay } from './components/layout/LoadingOverlay';
import { Toast } from './components/layout/Toast';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { LibraryModal } from './components/modals/LibraryModal';
import { MediaInfoModal } from './components/modals/MediaInfoModal';
import { ProfileDrawer } from './components/modals/ProfileDrawer';
import { GridView } from './components/player/GridView';
import { StreamDeck } from './components/player/StreamDeck';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './stores/appStore';

export function App() {
  const boot = useAppStore((s) => s.boot);
  const viewMode = useAppStore((s) => s.viewMode);
  const bootOnce = useRef(false);

  useKeyboardShortcuts();

  useEffect(() => {
    if (bootOnce.current) return;
    bootOnce.current = true;
    void boot();
  }, [boot]);

  useEffect(() => {
    useAppStore.getState().showInterfaceTemp();
  }, [viewMode]);

  return (
    <div className="slide-container select-none font-sans">
      <div className="relative h-full w-full">
        {viewMode === 'stream' ? <StreamDeck /> : <GridView />}
        <ClickToPlayOverlay />
        <BottomChrome />
      </div>
      <ProfileDrawer />
      <LibraryModal />
      <MediaInfoModal />
      <DeleteConfirmModal />
      <Toast />
      <LoadingOverlay />
    </div>
  );
}
