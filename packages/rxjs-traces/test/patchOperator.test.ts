import { Observable, of } from 'rxjs';
import { delay, filter, map, takeLast, withLatestFrom } from 'rxjs/operators';
import { addDebugTag, patchObservable, patchOperator, tagValue$ } from '../src';
import { resetTag$ } from '../src/debugTag';
import { restoreObservable } from '../src/patchObservable';

afterEach(() => {
  resetTag$();
});

describe('patchOperator (contrived custom operators)', () => {
  beforeAll(() => {
    patchObservable(Observable);
  });
  afterAll(() => {
    restoreObservable(Observable);
  });

  it("doesn't break references of existing operators", async () => {
    const stream = of(1).pipe(
      addDebugTag('source'),
      patchOperator(map)(v => v + 1),
      addDebugTag('middle'),
      patchOperator(filter)(v => v > 0),
      addDebugTag('result')
    );
    const tags = await stream
      .pipe(
        takeLast(1),
        withLatestFrom(tagValue$),
        map(([_, tags]) => tags)
      )
      .toPromise();

    expect(tags.result.refs).toEqual(['middle']);
    expect(tags.middle.refs).toEqual(['source']);
    expect(tags.source.refs).toEqual([]);
  });

  it('handles delayed subscriptions', async () => {
    const operator = patchOperator(() => <T>(source: Observable<T>) =>
      new Observable(obs => {
        setTimeout(() => {
          source.subscribe(obs);
        }, 10);
      })
    );
    const stream = of(1).pipe(
      addDebugTag('source'),
      operator(),
      addDebugTag('result')
    );
    const tags = await stream
      .pipe(
        takeLast(1),
        withLatestFrom(tagValue$),
        map(([_, tags]) => tags)
      )
      .toPromise();

    expect(tags.result.refs).toEqual(['source']);
    expect(tags.source.refs).toEqual([]);
  });

  it('handles references through arguments', async () => {
    const concat = <T>(...args: Observable<T>[]) => (source: Observable<T>) =>
      new Observable(obs => {
        const observableList = [source, ...args];
        let i = 0;
        const subscribeNext = () => {
          if (i >= observableList.length) {
            return obs.complete();
          }
          observableList[i].subscribe(
            value => obs.next(value),
            error => obs.error(error),
            subscribeNext
          );
          i++;
        };
        subscribeNext();
      });

    const patchedConcat = patchOperator(concat);

    const createSource = (id: number) =>
      of(id).pipe(delay(10), addDebugTag('source ' + id));

    const stream = createSource(0).pipe(
      patchedConcat(createSource(1), createSource(2)),
      addDebugTag('result')
    );
    const tags = await stream
      .pipe(
        takeLast(1),
        withLatestFrom(tagValue$),
        map(([_, tags]) => tags)
      )
      .toPromise();

    expect(tags.result.refs).toEqual(['source 0', 'source 1', 'source 2']);
    expect(tags['source 0'].refs).toEqual([]);
    expect(tags['source 1'].refs).toEqual([]);
    expect(tags['source 2'].refs).toEqual([]);
  });

  it('handles references from projection arguments', async () => {
    /** Q: shouldn't this operator get handled by default? :thinking_face:
     * A: No - these get detected on operators that use .lift, because we have
     *     better control on "obs.next" tracking.
     * We need to consider all cases if we want to track this globally...
     */
    const mergeMap = <T, R>(mapFn: (value: T) => Observable<R>) => (
      source: Observable<T>
    ) =>
      new Observable(obs => {
        let subscriptions = 1;
        source.subscribe(
          v => {
            subscriptions++;
            mapFn(v).subscribe(
              value => obs.next(value),
              error => obs.error(error),
              () => {
                if (--subscriptions === 0) {
                  obs.complete();
                }
              }
            );
          },
          error => obs.error(error),
          () => {
            if (--subscriptions === 0) {
              obs.complete();
            }
          }
        );
      });

    const patchedMergeMap = patchOperator(mergeMap);

    const stream = of(1).pipe(
      addDebugTag('source'),
      patchedMergeMap(v => of(v).pipe(addDebugTag('inner' + v))),
      addDebugTag('result')
    );
    const tags = await stream
      .pipe(
        takeLast(1),
        withLatestFrom(tagValue$),
        map(([_, tags]) => tags)
      )
      .toPromise();

    expect(tags.result.refs).toEqual(['source', 'inner1']);
    expect(tags.source.refs).toEqual([]);
    expect(tags.inner1.refs).toEqual([]);
  });
});
