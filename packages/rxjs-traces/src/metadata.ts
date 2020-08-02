import { Observable } from 'rxjs';
import { tagRefDetection$ } from './changes';

const Metadata = Symbol('metadata');
interface ObservableMetadata {
  patched: boolean;
  tag: string | null;
  refs: Set<Observable<unknown>>;

  // Advanced stuff for concatMap
  reverseRefs: Set<Observable<unknown>>; // Useful for tracking the ones that depend on it
}
export const hasMetadata = (observable: Observable<unknown>) =>
  Metadata in observable;

export const getMetadata = (
  observable: Observable<unknown>
): ObservableMetadata => {
  if (!hasMetadata(observable)) {
    const defaultMetadata: ObservableMetadata = {
      // id: Math.random(),
      patched: false,
      tag: null,
      refs: new Set(),
      reverseRefs: new Set(),
    };
    (observable as any)[Metadata] = defaultMetadata;
  }
  return (observable as any)[Metadata];
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
