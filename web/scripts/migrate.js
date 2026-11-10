const LEGACY_LESSON = /^s6-l([1-6])(?=$|[-@])/;

export function mapLegacyId(id) {
  return typeof id === 'string' ? id.replace(LEGACY_LESSON, 'a$1') : id;
}

function remapKeys(source, mapper) {
  const result = {};
  for (const [key, value] of Object.entries(source || {})) {
    const nextKey = mapper(key);
    if (nextKey === key || !(nextKey in result)) result[nextKey] = value;
  }
  return result;
}

export function migrateLegacyIds(state) {
  if (!state || typeof state !== 'object') return state;
  if ((state.meta && state.meta.version) >= 2) return state;
  state.q = remapKeys(state.q, mapLegacyId);
  state.l = remapKeys(state.l, mapLegacyId);
  state.p = { ...(state.p || {}) };
  state.meta = { ...(state.meta || {}), version: 2 };
  return state;
}

export function migrateDraftMap(drafts) {
  if (!drafts || typeof drafts !== 'object' || Array.isArray(drafts)) return drafts;
  return remapKeys(drafts, mapLegacyId);
}
