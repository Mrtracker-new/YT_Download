import React, { createContext, useContext } from 'react';
import { useUpdateChecker, type UpdateState } from '../../hooks/useUpdateChecker';
import { YtdlpUpdateModal } from './YtdlpUpdateModal';

const UpdateContext = createContext<UpdateState | null>(null);

/**
 * Mounts the startup update checker once and exposes its state to the tree.
 * Also renders the yt-dlp progress modal so it's available globally regardless
 * of which route is active.
 */
export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const state = useUpdateChecker();

  return (
    <UpdateContext.Provider value={state}>
      {children}
      {state.ytdlpUpdating && state.ytdlpUpdate && (
        <YtdlpUpdateModal ytdlpUpdate={state.ytdlpUpdate} onDone={state.onYtdlpDone} />
      )}
    </UpdateContext.Provider>
  );
}

/** Read update state. Returns null when used outside the provider. */
export function useUpdateContext(): UpdateState | null {
  return useContext(UpdateContext);
}
