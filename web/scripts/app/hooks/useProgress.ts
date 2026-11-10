import { useMemo, useSyncExternalStore } from 'react';
import { store } from '../../state/store';
import { courseMastery, isLessonMastered, stageMastery } from '../../state/progress';

export function useProgress() {
  const version = useSyncExternalStore(store.subscribe, store.getVersion, () => 0);

  return useMemo(() => ({
    version,
    course: courseMastery(),
    stage: stageMastery,
    lessonDone: isLessonMastered,
  }), [version]);
}
