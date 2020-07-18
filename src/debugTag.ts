import { unpatchedMap } from 'patchObservable';
import { Observable } from 'rxjs';
import { Refs, valueIsWrapped } from './wrappedValue';

interface DebugTag {
  id: string;
  label: string;
  refs: Set<string>;
  latestValue: any;
}

export const tags = new Map<string, DebugTag>();
export const addDebugTag = (label: string, id = label) => <T>(
  source: Observable<T>
) => {
  const debugTag: DebugTag = tags.has(id)
    ? tags.get(id)!
    : {
        id,
        label,
        refs: new Set<string>(),
        latestValue: undefined,
      };
  tags.set(debugTag.id, debugTag);

  const childRefs = new Set<string>();
  childRefs.add(debugTag.id);

  return (source.pipe(
    unpatchedMap(v => {
      if (valueIsWrapped(v)) {
        debugTag.latestValue = v.value;
        v[Refs].forEach(ref => debugTag.refs.add(ref));
        return {
          value: v.value,
          [Refs]: childRefs,
        };
      }
      debugTag.latestValue = v;
      return {
        value: v,
        [Refs]: childRefs,
      };
    })
  ) as any) as Observable<T>;
};
