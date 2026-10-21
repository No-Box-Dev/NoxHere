import { useCallback, useEffect, useState } from "react";

export const ALL_FILTER_VALUE = "all";

type FilterPreferenceScope = {
  actorId: string;
  organizationId: string;
  projectId: string;
  filterId: string;
};

const prefix = "noxhere.filter.v1";

function segment(value: string) {
  return encodeURIComponent(value.trim().toLowerCase());
}

export function filterPreferenceKey(scope: FilterPreferenceScope) {
  return [prefix, scope.actorId, scope.organizationId, scope.projectId, scope.filterId].map(segment).join(".");
}

function readPreference(key: string, defaultValue: string) {
  try {
    return window.localStorage.getItem(key) || defaultValue;
  } catch {
    return defaultValue;
  }
}

function writePreference(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch { /* The preference remains active for this page. */ }
}

/**
 * Result filters start at their explicit all-value, then remember a valid user
 * choice for the current actor, organization, project, and filter.
 */
export function useFilterPreference<Value extends string = string>(scope: FilterPreferenceScope, validValues?: readonly Value[], defaultValue = ALL_FILTER_VALUE as Value) {
  const key = filterPreferenceKey(scope);
  const [selection, setSelection] = useState(() => ({ key, value: readPreference(key, defaultValue) }));
  const storedValue = selection.key === key ? selection.value : readPreference(key, defaultValue);
  const value = (validValues && !validValues.includes(storedValue as Value) ? defaultValue : storedValue) as Value;

  useEffect(() => {
    if (storedValue !== value) writePreference(key, value);
  }, [key, storedValue, value]);

  const setValue = useCallback((next: string) => {
    const valid = !validValues || validValues.includes(next as Value) ? next as Value : defaultValue;
    writePreference(key, valid);
    setSelection({ key, value: valid });
  }, [defaultValue, key, validValues]);

  return [value, setValue] as const;
}
