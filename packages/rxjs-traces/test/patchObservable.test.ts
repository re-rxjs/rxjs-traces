import { concat, Observable, of } from 'rxjs';
import { marbles } from 'rxjs-marbles/jest';
import {
  concatMap,
  delay,
  map,
  publish,
  scan,
  switchMap,
  takeLast,
  withLatestFrom,
} from 'rxjs/operators';
import { addDebugTag, patchObservable, tagValue$ } from '../src';
import { resetTag$ } from '../src/debugTag';
import { restoreObservable } from '../src/patchObservable';

afterEach(() => {
  resetTag$();
});

describe('patchObservable', () => {
  beforeAll(() => {
    patchObservable(Observable);
  });
  afterAll(() => {
    restoreObservable(Observable);
  });

  describe('keeps the Observable API unchanged', () => {
    it(
      `emits regular values on subscribe`,
      marbles(m => {
        const source = m.cold('a-b-c-|');
        const expected = '     a-b-c-|';

        m.expect(source).toBeObservable(expected);
      })
    );

    it(
      'emits regular values with pipes and standard operators',
      marbles(m => {
        const source = m.cold<string>('a-b-c-|');
        const expected = '             ---m--n--(o|)';
        const delayTime = m.time('     ---|');

        const stream = source.pipe(
          map(char => char.charCodeAt(0)),
          scan((r1, r2) => r1 + r2),
          concatMap((v, i) => of(v / (i + 1)).pipe(delay(delayTime)))
        );

        m.expect(stream).toBeObservable(expected, {
          m: 97,
          n: 97.5,
          o: 98,
        });
      })
    );

    it(
      'emits regular values when used with addDebugTag',
      marbles(m => {
        const source = m.cold<string>('a-b-c-|');
        const expected = '             0-1-2-|';

        const stream = source.pipe(
          addDebugTag('debug'),
          map(char => String(char.charCodeAt(0) - 'a'.charCodeAt(0)))
        );

        m.expect(stream).toBeObservable(expected);
      })
    );

    it(
      `doesn't break when using connectable observables`,
      marbles(m => {
        const source = m.cold<string>('-a-b-c-|');
        const expected = '             -a-b-c-|)';

        const stream = source.pipe(publish());
        (stream as any).connect();

        m.expect(stream).toBeObservable(expected);
        m.expect(stream).toBeObservable(expected);
      })
    );
  });

  describe('watches for relationships between tags', () => {
    it('references only up to the parent', async () => {
      const stream = of(1).pipe(
        addDebugTag('source'),
        addDebugTag('middle'),
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

    it('detects references across standard operators', async () => {
      const stream = of(1).pipe(
        addDebugTag('source'),
        map(value => value + 2),
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

    it('detects references across custom simple operators', async () => {
      const stream = of(1).pipe(
        addDebugTag('source'),
        source => new Observable(obs => source.subscribe(obs)),
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

    it('detects references from async operators', async () => {
      const stream = of(1).pipe(
        switchMap(v => of(v).pipe(delay(10), addDebugTag('source'))),
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

    /** It doesn't :/. Two issues:
     * 1. Values emitted from within `withLatestFrom` are not emitted
     *     synchronously (because semantics)
     * 2. The result of `withLatestFrom` doesn't pass `Object.is` from the
     *     original emission, because it actually emits [value1, value2].
     * Workaround: wrap `withLatestFrom` with `patchOperator`
     */
    it('detects references from argument streams', async () => {
      const createSource = (id: number) =>
        of(id).pipe(delay(10), addDebugTag('source' + id));

      const stream = createSource(1).pipe(
        withLatestFrom(createSource(2)),
        addDebugTag('result')
      );

      const tags = await stream
        .pipe(
          takeLast(1),
          withLatestFrom(tagValue$),
          map(([_, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(['source1', 'source2']);
      expect(tags.source1.refs).toEqual([]);
      expect(tags.source2.refs).toEqual([]);
    });

    it('detects references from creation operators', async () => {
      const createSource = (id: number) =>
        of(id).pipe(delay(10), addDebugTag('source' + id));

      const stream = concat(createSource(1), createSource(2)).pipe(
        addDebugTag('result')
      );

      const tags = await stream
        .pipe(
          takeLast(1),
          withLatestFrom(tagValue$),
          map(([_, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(['source1', 'source2']);
      expect(tags.source1.refs).toEqual([]);
      expect(tags.source2.refs).toEqual([]);
    });
  });
});
