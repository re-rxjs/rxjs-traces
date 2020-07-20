import { Observable, of, from } from 'rxjs';
import { marbles } from 'rxjs-marbles/jest';
import {
  map,
  takeLast,
  withLatestFrom,
  concatMap,
  delay,
} from 'rxjs/operators';
import { addDebugTag, patchObservable } from '../src';
import { resetTag$, tagValue$ } from '../src/debugTag';
import { restoreObservable } from '../src/patchObservable';

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

    expect(tags.result.latestValue).toEqual(1);
  });

  it('keeps track of the latest value', async () => {
    const stream = from([1, 2, 3]).pipe(
      concatMap(v => of(v).pipe(delay(10))),
      addDebugTag('result')
    );

    expect.assertions(3);
    await stream.pipe(withLatestFrom(tagValue$)).forEach(([value, tags]) => {
      expect(tags.result.latestValue).toBe(value);
    });
  });

  // Upcoming features (?)
  it.skip('keeps track of the number of subscriptions', () => void 0);
  it.skip('keeps the latest value for each subscription', () => void 0);
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
