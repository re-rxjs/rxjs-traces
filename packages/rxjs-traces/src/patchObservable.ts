import {
  firstValueFrom,
  Observable,
  Observer,
  Operator,
  Subscriber,
  Subscription,
  TeardownLogic,
  timer,
} from "rxjs";
import { takeUntil, toArray } from "rxjs/operators";
import { getMetadata } from "./metadata";

const Patched = Symbol("patched");
export const isPatched = (fn: object) => Boolean(fn && (fn as any)[Patched]);
export const markAsPatched = (fn: object, patched = true) => {
  (fn as any)[Patched] = patched;
};

const originalSubscribe = Observable.prototype.subscribe as <T>(
  observer: Observer<T>
) => Subscription;
const callOriginalSubscribe = <T>(
  _this: Observable<T>,
  observer: Observer<T>
) =>
  originalSubscribe.call<Observable<T>, [Observer<T>], Subscription>(
    _this,
    observer
  );

const subscriptionStack: Array<Observable<unknown> | null> = [];
const nextStack: Array<Observable<unknown> | null> = [];
export function patchObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe = function <T>(
    this: Observable<T>,
    observerOrNext?: Partial<Observer<T>> | ((value: T) => void) | null,
    error?: ((error: any) => void) | null,
    complete?: (() => void) | null
  ): Subscription {
    const metadata = getMetadata(this);
    const observerArg = getObserver(observerOrNext, error, complete);
    const observer = addErrorDetection(observerArg, this, metadata.getTag());

    /** Imagine this case, the most simple one:

      addDebugTag("tagA"),
      source => new Observable(obs => {
        source.subscribe(obs);
      }),
      addDebugTag("tagB")

      Assuming:
        * `source` has tagA in its metadata
        * The function `obs => {...}` is `this._subscribe`

      We can make `new Observable` reference the parent observable by mocking `this._subscribe`
      and find out what subscribe calls happen in there.
    */

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let overridenThis = this;
    if (
      (this as any)._subscribe !== (Observable.prototype as any)._subscribe &&
      !isPatched((this as any)._subscribe)
    ) {
      const patched_subscribe: (subscriber: Subscriber<any>) => TeardownLogic =
        (subscriber) => {
          nextStack.push(null);
          subscriptionStack.push(this);
          const result = (this as any)._subscribe(subscriber);
          subscriptionStack.pop();
          nextStack.pop();
          return result;
        };
      markAsPatched(patched_subscribe);
      overridenThis = Object.create(overridenThis, {
        _subscribe: {
          value: patched_subscribe,
        },
      });
    }

    if (this.operator && !isPatched(this.operator)) {
      const patchedOperator: Operator<any, T> = {
        call: (subscriber, source) => {
          nextStack.push(null);
          subscriptionStack.push(this);
          const teardown = this.operator?.call(subscriber, source);
          subscriptionStack.pop();
          nextStack.pop();
          return teardown;
        },
      };
      markAsPatched(patchedOperator);
      overridenThis = Object.create(overridenThis, {
        operator: {
          value: patchedOperator,
        },
      });
    }

    if (subscriptionStack.length > 0) {
      /** `this` is `source` in the example above ^^^
       * Meaning we need to pass our ref to the top of the observableStack
       * so it can grab `tagA`
       */
      const top = subscriptionStack[subscriptionStack.length - 1];
      if (top) {
        getMetadata(top).addDependency(this);
      }
    }

    let overridenObserver: Observer<T> = {
      complete: () => observer.complete(),
      next: (value) => {
        if (nextStack.length > 0) {
          // this observable has received something from the previous observable
          // The observable on the top is a dependency of this
          const top = nextStack[nextStack.length - 1];
          if (top) {
            metadata.addDependency(top);
          }
        }

        subscriptionStack.push(null);
        nextStack.push(this);
        observer.next(value);
        nextStack.pop();
        subscriptionStack.pop();
      },
      error: (err) => observer.error(err),
    };
    if (observer instanceof Subscriber) {
      overridenObserver = new Subscriber(overridenObserver);
      observer.add(overridenObserver as Subscriber<any>);
    }

    return callOriginalSubscribe(overridenThis, overridenObserver);
  };
  markAsPatched(ObservableCtor.prototype);

  globalThis.addEventListener("error", onUncaughtException);
}
export function restoreObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe =
    originalSubscribe as typeof ObservableCtor.prototype.subscribe;
  markAsPatched(ObservableCtor.prototype, false);

  globalThis.removeEventListener("error", onUncaughtException);
}

function getObserver<T>(
  observerOrNext?: Partial<Observer<T>> | ((value: T) => void) | null,
  error?: ((error: any) => void) | null,
  complete?: (() => void) | null
): Observer<T> {
  if (observerOrNext && observerOrNext instanceof Subscriber) {
    return observerOrNext;
  }

  return {
    next: (value) => {
      if (typeof observerOrNext === "function") {
        observerOrNext(value);
      } else if (typeof observerOrNext === "object" && observerOrNext != null) {
        observerOrNext.next && observerOrNext.next(value);
      }
    },
    error: (err) => {
      if (
        observerOrNext &&
        typeof observerOrNext === "object" &&
        observerOrNext.error
      ) {
        observerOrNext.error(err);
      } else if (error) {
        error(err);
      } else {
        throw err;
      }
    },
    complete: () => {
      if (
        observerOrNext &&
        typeof observerOrNext === "object" &&
        observerOrNext.complete
      ) {
        observerOrNext.complete();
      } else if (complete) {
        complete();
      }
    },
  };
}

interface EnhancedError extends Error {
  source?: Observable<unknown>;
  detectedIn?: Array<string>;
}
async function onUncaughtException({ error }: ErrorEvent) {
  if (error instanceof Error) {
    const enhancedError = error as EnhancedError;
    if (enhancedError.source) {
      const refs = await firstValueFrom(
        getMetadata(enhancedError.source)
          .getDependencies$()
          .pipe(takeUntil(timer(0)), toArray())
      );
      if (refs.length)
        console.warn(
          "rxjs-traces detected error came in stream with references to: [" +
            refs.join(", ") +
            "]"
        );
    }
    if (enhancedError.detectedIn) {
      console.warn(
        "rxjs-traces detected error went through tags: [" +
          enhancedError.detectedIn.join(", ") +
          "]"
      );
    }
  }
}

function addErrorDetection<T>(
  observer: Observer<T>,
  source: Observable<T>,
  name: string | null
): Observer<T> {
  let result = {
    next: (value: T) => {
      try {
        observer.next(value);
      } catch (err) {
        // Catch errors thrown from rxjs itself (such as returning undefined in a switchMap)
        if (source && err instanceof Error) {
          const enhancedError = err as EnhancedError;
          enhancedError.source = source;
        }
        throw err;
      }
    },
    error: (err: any) => {
      if (name && err instanceof Error) {
        const enhancedError = err as EnhancedError;
        if (source && !enhancedError.source) {
          enhancedError.source = source;
        }
        enhancedError.detectedIn = enhancedError.detectedIn || [];
        enhancedError.detectedIn.push(name);
      }
      observer.error(err);
    },
    complete: () => observer.complete(),
  };
  if (observer instanceof Subscriber) {
    result = new Subscriber(result);
    observer.add(result as Subscriber<any>);
  }

  if (name) {
    Object.defineProperty(result.next, "name", {
      value: `DebugTag(--------> ${name} <--------).next`,
    });
    Object.defineProperty(result.error, "name", {
      value: `DebugTag(--------> ${name} <--------).error`,
    });
    Object.defineProperty(result.complete, "name", {
      value: `DebugTag(--------> ${name} <--------).complete`,
    });
  }
  return result;
}
