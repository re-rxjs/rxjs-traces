import {
  Observable,
  Observer,
  Operator,
  PartialObserver,
  Subscriber,
  Subscription,
  TeardownLogic,
} from 'rxjs';
import { detectRefChanges, findReverseTagRefs, getMetadata } from './metadata';

const Patched = Symbol('patched');
export const isPatched = (ObservableCtor: Function) =>
  Boolean((ObservableCtor as any)[Patched]);

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

const observableStack: Array<Observable<unknown>[]> = [];
export function patchObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe = function <T>(
    this: Observable<T>,
    observerOrNext?: PartialObserver<T> | ((value: T) => void) | null,
    error?: ((error: any) => void) | null,
    complete?: (() => void) | null
  ) {
    const observer = getObserver(observerOrNext, error, complete);
    const metadata = getMetadata(this);

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

    let overridenThis = this;
    if (
      !metadata.patched &&
      this._subscribe !== Observable.prototype._subscribe
    ) {
      const patched_subscribe: (
        subscriber: Subscriber<any>
      ) => TeardownLogic = (subscriber) =>
        detectRefChanges(() => {
          observableStack.push([this]);
          const result = this._subscribe(subscriber);
          observableStack.pop();
          return result;
        }, [this]);
      overridenThis = Object.create(overridenThis, {
        _subscribe: {
          value: patched_subscribe,
        },
      });
    }

    if (!metadata.patched && this.operator) {
      const patchedOperator: Operator<any, T> = {
        call: (subscriber, source) =>
          detectRefChanges(() => {
            observableStack.push([this]);
            const teardown = this.operator.call(subscriber, source);
            observableStack.pop();
            return teardown;
          }, [this]),
      };
      overridenThis = Object.create(overridenThis, {
        operator: {
          value: patchedOperator,
        },
      });
    }

    if (observableStack.length > 0) {
      /** `this` is `source` in the example above ^^^
       * Meaning we need to pass our ref to the top of the observableStack
       * so it can grab `tagA`
       */
      const top = observableStack[observableStack.length - 1];
      top.forEach((observable) => {
        getMetadata(observable).refs.add(this);
        metadata.reverseRefs.add(observable);
      });
    }

    const overridenObserver: Observer<T> = {
      ...observer,
      complete: () => {
        /** Case concat: When a source completes, it synchronously causes
         * a subscription to fire of. So we set the child of `this` to be the
         * top of the observable stack, (`this` is the inner
         * observable, and we want its child, the one that `concat` returns)
         */
        if (metadata.reverseRefs.size) {
          const reverseRefValues = Array.from(metadata.reverseRefs.values());
          const dependantTagRefs = reverseRefValues.flatMap((ref) =>
            findReverseTagRefs(ref)
          );
          detectRefChanges(() => {
            observableStack.push(reverseRefValues);
            observer.complete();
            observableStack.pop();
          }, dependantTagRefs);
        } else {
          observer.complete();
        }
      },
      next: (value) => {
        /** Case switchMap: When the source emits, it synchronously causes a new
         * subscription to fire of. In this case `this` is the parent stream
         * of `switchMap`, so we also need to grab its child.
         */
        if (metadata.reverseRefs.size) {
          const reverseRefValues = Array.from(metadata.reverseRefs.values());
          const dependantTagRefs = reverseRefValues.flatMap((ref) =>
            findReverseTagRefs(ref)
          );
          detectRefChanges(() => {
            observableStack.push(reverseRefValues);
            observer.next(value);
            observableStack.pop();
          }, dependantTagRefs);
        } else {
          observer.next(value);
        }
      },
    };

    metadata.patched = true;
    return callOriginalSubscribe(overridenThis, overridenObserver);
  };
  (ObservableCtor as any)[Patched] = true;
}
export function restoreObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe = originalSubscribe as typeof ObservableCtor.prototype.subscribe;
  (ObservableCtor as any)[Patched] = false;
}

function getObserver<T>(
  observerOrNext?: PartialObserver<T> | ((value: T) => void) | null,
  error?: ((error: any) => void) | null,
  complete?: (() => void) | null
): Observer<T> {
  return {
    next: (value) => {
      if (typeof observerOrNext === 'function') {
        observerOrNext(value);
      } else if (typeof observerOrNext === 'object' && observerOrNext != null) {
        observerOrNext.next && observerOrNext.next(value);
      }
    },
    error: (err) => {
      if (
        observerOrNext &&
        typeof observerOrNext === 'object' &&
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
        typeof observerOrNext === 'object' &&
        observerOrNext.complete
      ) {
        observerOrNext.complete();
      } else if (complete) {
        complete();
      }
    },
  };
}
