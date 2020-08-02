import { Observable, of, from, merge } from 'rxjs';
import { marbles } from 'rxjs-marbles/jest';
import {
  map,
  takeLast,
  withLatestFrom,
  concatMap,
  delay,
  mergeMap,
  ignoreElements,
} from 'rxjs/operators';
import { addDebugTag, patchObservable } from '../src';
import { resetTag$, tagValue$ } from '../src/changes';
import { restoreObservable } from '../src/patchObservable';
import { eachValueFrom } from 'rxjs-for-await';

afterEach(() => {
  resetTag$();
});

describe('addDebugTag', () => {
  beforeAll(() => {
    patchObservable(Observable);
  });
  afterAll(() => {
    restoreObservable(Observable);
  });

  it("sets the initial value when it's synchronous", async () => {
    const stream = of(1).pipe(addDebugTag('result'));

    const tags = await stream
      .pipe(
        takeLast(1),
        withLatestFrom(tagValue$),
        map(([_, tags]) => tags)
      )
      .toPromise();

    const values = Object.values(tags.result.latestValues);
    expect(values.length).toEqual(1);
    expect(values[0]).toEqual(1);
  });

  it('keeps track of the latest value', async () => {
    const stream = from([1, 2, 3]).pipe(
      concatMap(v => of(v).pipe(delay(10))),
      addDebugTag('result')
    );

    expect.assertions(3 * 2);
    await stream.pipe(withLatestFrom(tagValue$)).forEach(([value, tags]) => {
      const values = Object.values(tags.result.latestValues);
      expect(values.length).toEqual(1);
      expect(values[0]).toBe(value);
    });
  });

  it('keeps the latest value for each subscription', async () => {
    const stream = from([1, 2]).pipe(
      concatMap(v => of(v).pipe(delay(10))),
      addDebugTag('result')
    );

    const subscriptionStream = from([1, 2]).pipe(
      concatMap(v => of(v).pipe(delay(5))),
      mergeMap(() => stream),
      ignoreElements()
    );

    const valueIterator = eachValueFrom(
      merge(tagValue$, subscriptionStream).pipe(
        map(tags => tags.result.latestValues)
      )
    );

    let value: Record<string, any>;

    value = (await valueIterator.next()).value;
    expect(Object.keys(value).length).toBe(1);

    value = (await valueIterator.next()).value;
    expect(Object.keys(value).length).toBe(2);
    const [id1, id2] = Object.keys(value);
    expect(value[id1]).toBeUndefined();
    expect(value[id2]).toBeUndefined();

    value = (await valueIterator.next()).value;
    expect(value[id1]).toEqual(1);
    expect(value[id2]).toBeUndefined();

    value = (await valueIterator.next()).value;
    expect(value[id1]).toEqual(1);
    expect(value[id2]).toEqual(1);

    value = (await valueIterator.next()).value;
    expect(value[id1]).toEqual(2);
    expect(value[id2]).toEqual(1);

    value = (await valueIterator.next()).value;
    expect(Object.keys(value).length).toBe(1);
    expect(value[id1]).toBeUndefined();
    expect(value[id2]).toEqual(1);
  });
});

describe('without patching', () => {
  it(
    `doesn't polute the stream when using addDebugTag`,
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
});
