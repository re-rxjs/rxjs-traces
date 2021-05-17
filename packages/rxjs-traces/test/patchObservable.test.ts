import { shareLatest } from "@react-rxjs/core";
import {
  concat,
  connectable,
  defer,
  from,
  interval,
  firstValueFrom,
  merge,
  Observable,
  of,
} from "rxjs";
import { marbles } from "rxjs-marbles/jest";
import {
  catchError,
  concatMap,
  delay,
  endWith,
  map,
  scan,
  share,
  startWith,
  switchMap,
  take,
  takeLast,
  timeout,
  withLatestFrom,
} from "rxjs/operators";
import { addDebugTag, patchObservable, tagValue$ } from "../src";
import { resetTag$ } from "../src/changes";
import { findTagRefs } from "../src/metadata";
import { restoreObservable } from "../src/patchObservable";

afterEach(() => {
  resetTag$();
});

describe("patchObservable", () => {
  beforeAll(() => {
    patchObservable(Observable);
  });
  afterAll(() => {
    restoreObservable(Observable);
  });

  describe("keeps the Observable API unchanged", () => {
    it(
      `emits regular values on subscribe`,
      marbles((m) => {
        const source = m.cold("a-b-c-|");
        const expected = "     a-b-c-|";

        m.expect(source).toBeObservable(expected);
      })
    );

    it(
      "emits regular values with pipes and standard operators",
      marbles((m) => {
        const source = m.cold<string>("a-b-c-|");
        const expected = "             ---m--n--(o|)";
        const delayTime = m.time("     ---|");

        const stream = source.pipe(
          map((char) => char.charCodeAt(0)),
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
      "emits regular values when used with addDebugTag",
      marbles((m) => {
        const source = m.cold<string>("a-b-c-|");
        const expected = "             0-1-2-|";

        const stream = source.pipe(
          addDebugTag("debug"),
          map((char) => String(char.charCodeAt(0) - "a".charCodeAt(0)))
        );

        m.expect(stream).toBeObservable(expected);
      })
    );

    it(
      `doesn't break when using connectable observables`,
      marbles((m) => {
        const source = m.cold<string>("-a-b-c-|");
        const expected = "             -a-b-c-|)";

        const stream = connectable(source);
        stream.connect();

        m.expect(stream).toBeObservable(expected);
        m.expect(stream).toBeObservable(expected);
      })
    );

    it(
      `doesn't break synchronous share`,
      marbles((m) => {
        const source = from(["a", "b", "c"]);
        const expected = "(abc|)";
        const stream = source.pipe(share());

        m.expect(stream).toBeObservable(expected);
      })
    );

    it(
      `propagates unsubscriptions through share`,
      marbles((m) => {
        const source = m.cold("-------|");
        const subs = "         ^---!";
        const time = m.time("  ----|");
        const expected = "     ----#";

        const stream = source.pipe(
          share(),
          timeout(time),
          catchError(() => {
            throw "error"; // eslint-disable-line no-throw-literal
          })
        );

        m.expect(stream).toBeObservable(expected);
        m.expect(source).toHaveSubscriptions(subs);
      })
    );

    it(
      `doesn't break recursive observables`,
      marbles((m) => {
        const deferredCount = defer(() => source).pipe(startWith(0));

        const source: Observable<string> = m.cold("123|").pipe(
          withLatestFrom(deferredCount),
          map(([a, b]) => String(Number(a) + Number(b))),
          share()
        );
        const expected = "136|";

        m.expect(source).toBeObservable(expected);
      })
    );
  });

  describe("watches for relationships between tags", () => {
    it("references only up to the parent", async () => {
      const stream = of(1).pipe(
        addDebugTag("source"),
        addDebugTag("middle"),
        addDebugTag("result")
      );
      const tags = await stream
        .pipe(
          takeLast(1),
          /**
           * With the current implementation, refs are detected after
           * `subscribe` call is finished. As `of` is synchrnous, we'll get
           * "complete" before the ref has been emitted.
           * We only care that the ref needs to be there, not that it should be
           * synchronous, so we delay the result to the next event loop tick.
           */
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["middle"]);
      expect(tags.middle.refs).toEqual(["source"]);
      expect(tags.source.refs).toEqual([]);
    });

    it("references only the parent with custom operator followed by standard operator", async () => {
      const stream = of(1).pipe(
        addDebugTag("source"),
        (source) => new Observable((obs) => source.subscribe(obs)),
        map(() => 0),
        addDebugTag("middle"),
        addDebugTag("result")
      );

      const tags = (await stream
        .pipe(
          takeLast(1),
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise()) as any;

      expect(tags.result.refs).toEqual(["middle"]);
      expect(tags.middle.refs).toEqual(["source"]);
      expect(tags.source.refs).toEqual([]);
    });

    it("references only up to the parent followed by a refcount", async () => {
      const stream = of(1).pipe(
        addDebugTag("source"),
        addDebugTag("middle"),
        share(),
        addDebugTag("result")
      );

      const tags = await stream
        .pipe(
          takeLast(1),
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["middle"]);
      expect(tags.middle.refs).toEqual(["source"]);
      expect(tags.source.refs).toEqual([]);
    });

    it("detects references across standard operators", async () => {
      const stream = of(1).pipe(
        addDebugTag("source"),
        map((value) => value + 2),
        addDebugTag("result")
      );
      const tags = await stream
        .pipe(
          takeLast(1),
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["source"]);
      expect(tags.source.refs).toEqual([]);
    });

    it("detects references across custom simple operators", async () => {
      const stream = of(1).pipe(
        addDebugTag("source"),
        (source) => new Observable((obs) => source.subscribe(obs)),
        addDebugTag("result")
      );

      const tags = await stream
        .pipe(
          takeLast(1),
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["source"]);
      expect(tags.source.refs).toEqual([]);
    });

    it("detects references from async operators", async () => {
      const stream = of(1).pipe(
        delay(0),
        addDebugTag("source"),
        switchMap((v) => of(v).pipe(delay(10), addDebugTag("inner"))),
        addDebugTag("result")
      );
      const tags = await stream
        .pipe(
          takeLast(1),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["source", "inner"]);
      expect(tags.source.refs).toEqual([]);
      expect(tags.inner.refs).toEqual([]);
    });

    it("detects references from argument streams", async () => {
      const createSource = (id: number) =>
        of(id).pipe(delay(10), addDebugTag("source" + id));

      const stream = createSource(1).pipe(
        withLatestFrom(createSource(2)),
        addDebugTag("result")
      );

      const tags = await stream
        .pipe(
          takeLast(1),
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs.length).toBe(2);
      expect(tags.result.refs).toContain("source1");
      expect(tags.result.refs).toContain("source2");
      expect(tags.source1.refs).toEqual([]);
      expect(tags.source2.refs).toEqual([]);
    });

    /** It fails because current implementation uses synchronous subscriptions
     * to link streams toghether, and concat won't subscribe to the next
     * observable until the first hasn't completed
     */
    it("detects references from creation operators", async () => {
      const createSource = (id: number) =>
        of(id).pipe(delay(10), addDebugTag("source" + id));

      const stream = concat(createSource(1), createSource(2)).pipe(
        addDebugTag("result")
      );

      const tags = await stream
        .pipe(
          takeLast(1),
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["source1", "source2"]);
      expect(tags.source1.refs).toEqual([]);
      expect(tags.source2.refs).toEqual([]);
    });

    it("works across custom shared operators", async () => {
      const source = interval(10).pipe(
        take(5),
        addDebugTag("source"),
        shareLatest()
      );

      const stream1 = source.pipe(addDebugTag("result1"));
      const stream2 = source.pipe(addDebugTag("result2"));
      tagValue$.subscribe();

      const tags = await firstValueFrom(
        merge(stream1, stream2).pipe(
          takeLast(1),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
      );

      expect(tags.result1.refs).toEqual(["source"]);
      expect(tags.result2.refs).toEqual(["source"]);
      expect(tags.source.refs).toEqual([]);
    });

    it("detects recursive references", async () => {
      const deferredCount = defer(() => source).pipe(startWith(0));

      const source: Observable<number> = interval(10).pipe(
        take(2),
        addDebugTag("source"),
        withLatestFrom(deferredCount),
        addDebugTag("merged"),
        map(([a, b]) => a + b),
        addDebugTag("result"),
        share()
      );

      const tags = await source
        .pipe(
          takeLast(1),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["merged"]);
      expect(tags.merged.refs).toEqual(["result", "source"]);
      expect(tags.source.refs).toEqual([]);
    });

    it("references up to the parent with multiple subscriptions", async () => {
      const stream = of(1).pipe(
        addDebugTag("source"),
        addDebugTag("middle"),
        endWith(5),
        addDebugTag("result")
      );
      stream.subscribe();
      const tags = await stream
        .pipe(
          takeLast(1),
          delay(0),
          withLatestFrom(tagValue$),
          map(([, tags]) => tags)
        )
        .toPromise();

      expect(tags.result.refs).toEqual(["middle"]);
      expect(tags.middle.refs).toEqual(["source"]);
      expect(tags.source.refs).toEqual([]);
    });
  });

  it("improves stack traces", async () => {
    const source: Observable<number> = interval(10).pipe(
      take(5),
      addDebugTag("source"),
      map((a) => {
        if (a > 2) {
          throw new Error("next error");
        }
        return a;
      }),
      addDebugTag("result")
    );

    const result = source
      .pipe(takeLast(1), withLatestFrom(tagValue$))
      .toPromise();
    await expect(result).rejects.toThrow();

    try {
      await result;
    } catch (ex) {
      expect(ex.detectedIn).toEqual(["result"]);
      expect(findTagRefs(source)).toEqual(["source"]);
    }
  });
});
