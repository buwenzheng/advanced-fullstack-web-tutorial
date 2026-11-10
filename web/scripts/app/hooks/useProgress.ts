import { useSyncExternalStore } from 'react';
import { store } from '../../state/store';

export function useProgress() {
  const version = useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
  return { version };
}
