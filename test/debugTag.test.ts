import { Observable } from 'rxjs';
import { marbles } from 'rxjs-marbles/jest';
import { map } from 'rxjs/operators';
import { addDebugTag, patchObservable } from '../src';
import { resetTag$ } from '../src/debugTag';
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

  // TODO
  it.skip('keeps track of the latest value', () => void 0);

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
