import { Observable } from 'rxjs';
import { tagRefDetection$ } from './changes';

interface ObservableMetadata {
  patched: boolean;
  tag: string | null;
  refs: Set<Observable<unknown>>;

  // Advanced stuff for concatMap
  reverseRefs: Set<Observable<unknown>>; // Useful for tracking the ones that depend on it
}

/**
 * We can't put this info in each Observable instance because `multicast`
 * creates a copy of the observables when it makes a connectable one, messing up
 * references.
 */
const metadataStore = new WeakMap<Observable<unknown>, ObservableMetadata>();

export const hasMetadata = (observable: Observable<unknown>) =>
  metadataStore.has(observable);
export const getMetadata = (
  observable: Observable<unknown>
): ObservableMetadata => {
  if (!hasMetadata(observable)) {
    const defaultMetadata: ObservableMetadata = {
      patched: false,
      tag: null,
      refs: new Set(),
      reverseRefs: new Set(),
    };
    metadataStore.set(observable, defaultMetadata);
  }
  return metadataStore.get(observable)!;
};

export const detectRefChanges = <T>(
  fn: () => T,
  targetInstances: Observable<unknown>[]
) => {
  const filteredInstances = targetInstances.filter(
    (instance) => getMetadata(instance).tag
  );
  const before = filteredInstances.map(
    (instance) => new Set(findTagRefs(instance))
  );
  const result = fn();
  const after = filteredInstances.map((instance) => findTagRefs(instance));
  for (let i = 0; i < filteredInstances.length; i++) {
    if (after[i].length > before[i].size) {
      after[i].forEach((ref) => {
        if (!before[i].has(ref)) {
          tagRefDetection$.next({
            id: getMetadata(filteredInstances[i]).tag!,
            ref,
          });
        }
      });
    }
  }

  return result;
};

export function findTagRefs(observable: Observable<unknown>) {
  const metadata = getMetadata(observable);

  const tags = new Set<string>();
  metadata.refs.forEach((ref) => {
    const refMetadata = getMetadata(ref);
    if (refMetadata.tag) {
      tags.add(refMetadata.tag);
    } else {
      const tagRefs = findTagRefs(ref);
      tagRefs.forEach((tag) => tags.add(tag));
    }
  });

  return Array.from(tags.values());
}

export function findReverseTagRefs(observable: Observable<unknown>) {
  const metadata = getMetadata(observable);

  const refs = new Set<Observable<unknown>>();
  metadata.reverseRefs.forEach((ref) => {
    const refMetadata = getMetadata(ref);
    if (refMetadata.tag) {
      refs.add(ref);
    } else {
      const tagRefs = findReverseTagRefs(ref);
      tagRefs.forEach((ref) => refs.add(ref));
    }
  });

  return Array.from(refs.values());
}
