import { useSyncExternalStore } from 'react';
import { lang, type LanguageId } from '../../state/lang';

export function useLang() {
  const current = useSyncExternalStore(lang.subscribe, lang.get, () => 'javascript' as LanguageId);
  return { current, set: lang.set };
}
