import { addDebugTag, tags } from "./debugObservable"; // It monkey-patches rxjs and operators, so it must be before importing those
import { interval, Observable, of } from "rxjs";
import {
  filter,
  map,
  take,
  debounceTime,
  mergeMap,
  delay,
} from "rxjs/operators";

const custom = () => <T extends number>(source: Observable<T>) =>
  source.pipe(
    addDebugTag("custom"),
    debounceTime(0),
    map((v) => [v, 1] as const),
    /**
     * Mergemap (and similar) has 2 issues:
     * - addDebugTag is creating a new id on every call
     * - Internally it uses the patched `.subscribe`, so it emits an unwrapped value and all the refs get lost.
     */
    mergeMap((v) => {
      if (v[0] > 35) {
        return of(v).pipe(
          delay(100),
          addDebugTag("inner mergeMap")
        );
      }
      return of(v);
    })
  );

interval(1000)
  .pipe(
    take(6),
    addDebugTag("interval"),
    map((v) => v * 10),
    filter(() => true),
    custom(),
    source => new Observable(obs => source.subscribe(obs)),
    addDebugTag("result")
  )
  .subscribe(r => {
    console.log("new result", r);
    console.log(...tags.values());
  });

// of(1).pipe(
//   mergeMap(v => of(v).pipe(
//     addDebugTag('inner')
//   )),
//   addDebugTag('result')
// ).subscribe(value => {
//     console.log('new result', value);
//     console.log(...tags.values());
//   });

// console.log(allNodes);
