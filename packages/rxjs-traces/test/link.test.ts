import { createLink, addDebugTag, tagValue$, patchObservable } from '../src';
import { of, Observable } from 'rxjs';
import { delay, takeLast, withLatestFrom, map, share } from 'rxjs/operators';
import { restoreObservable } from '../src/patchObservable';
import { resetTag$ } from '../src/changes';

afterEach(() => {
  resetTag$();
});

describe('createLink', () => {
  beforeAll(() => {
    patchObservable(Observable);
  });
  afterAll(() => {
    restoreObservable(Observable);
  });

  it('bridges a gap in the pipe chain', async () => {
    const [from, to] = createLink();

    const stream = of(1).pipe(
      delay(10),
      addDebugTag('source'),
      from(),
      (source$) =>
        new Observable((obs) => {
          setTimeout(() => {
            source$.subscribe(obs);
          });
        }),
      to(),
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
    const values = Object.values(tags.result.latestValues);
    expect(values[0]).toEqual(1);
  });

  it('handles recursivity', async () => {
    const [from, to] = createLink();

    const stream = of(1).pipe(
      addDebugTag('source'),
      to(),
      addDebugTag('middle'),
      share(),
      from(),
      addDebugTag('result')
    );

    const tags = await stream
      .pipe(
        takeLast(1),
        delay(0),
        withLatestFrom(tagValue$),
        map(([_, tags]) => tags)
      )
      .toPromise();

    expect(tags.result.refs).toEqual(['middle']);
    expect(tags.middle.refs).toEqual(['middle', 'source']);
    expect(tags.source.refs).toEqual([]);
  });
});
