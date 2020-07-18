import { unpatchedMap } from 'patchObservable';
import { Observable, BehaviorSubject, merge } from 'rxjs';
import { switchMap, map, scan } from 'rxjs/operators';
import { Refs, valueIsWrapped } from './wrappedValue';

export interface DebugTag {
  id: string;
  label: string;
  refs: string[];
  latestValue: any;
}

const tagStream = new BehaviorSubject<
  Record<string, BehaviorSubject<DebugTag>>
>({});

export const tag$ = tagStream as Observable<
  Record<string, Observable<DebugTag>>
>;
export const tagValue$ = tag$.pipe(
  switchMap(tagsMap =>
    merge(
      ...Object.entries(tagsMap).map(([key, stream]) =>
        stream.pipe(map(v => [key, v] as const))
      )
    ).pipe(
      scan(
        (previous, [key, value]) => ({
          ...previous,
          [key]: value,
        }),
        {} as Record<string, DebugTag>
      )
    )
  )
);

export const addDebugTag = (label: string, id = label) => <T>(
  source: Observable<T>
) => {
  const tagsMap = tagStream.getValue();
  const tagSubject =
    tagsMap[id] ??
    new BehaviorSubject<DebugTag>({
      id,
      label,
      refs: [],
      latestValue: undefined,
    });
  if (!tagsMap[id]) {
    tagStream.next({
      ...tagsMap,
      [id]: tagSubject,
    });
  }

  const childRefs = new Set<string>();
  childRefs.add(id);

  return (source.pipe(
    unpatchedMap(v => {
      const { value, valueRefs } = valueIsWrapped(v)
        ? {
            value: v.value,
            valueRefs: v[Refs],
          }
        : {
            value: v,
            valueRefs: undefined,
          };

      let refs = tagSubject.getValue().refs;
      if (valueRefs) {
        valueRefs.forEach(ref => {
          if (!refs.includes(ref)) {
            refs = [...refs, ref];
          }
        });
      }
      tagSubject.next({
        ...tagSubject.getValue(),
        refs,
        latestValue: value,
      });

      return {
        value,
        [Refs]: childRefs,
      };
    })
  ) as any) as Observable<T>;
};
