import { Observable, PartialObserver, Subscriber } from 'rxjs';
import { Refs, unwrapValue, valueIsWrapped } from './wrappedNext';

const Patched = Symbol('patched');

const observableStack: any[] = [];
const valuesStack: any[] = [];
const originalSubscribe = Observable.prototype.subscribe;
const subscribeWithPatch: typeof originalSubscribe = function<T>(
  this: Observable<T>,
  observerOrNext?: PartialObserver<T> | ((value: T) => void) | null,
  error?: ((error: any) => void) | null,
  complete?: (() => void) | null
) {
  if (this.operator) {
    const originalOperator = this.operator;
    this.operator = {
      call: (subscriber, source: Observable<any>) => {
        const refs = new Set<string>();
        return originalOperator.call(
          new Subscriber({
            next: value => {
              const lastValue = valuesStack.pop();
              if (lastValue && Object.is(lastValue.value, unwrapValue(value))) {
                lastValue.refs.forEach((ref: string) => refs.add(ref));
              }
              if (valueIsWrapped(value)) {
                value[Refs].forEach(ref => refs.add(ref));
                subscriber.next({
                  value: value.value,
                  [Refs]: refs,
                } as any);
              } else {
                subscriber.next({
                  value,
                  [Refs]: refs,
                } as any);
              }
              if (lastValue) {
                valuesStack.push(lastValue);
              }
            },
            error: subscriber.error.bind(subscriber),
            complete: subscriber.complete.bind(subscriber),
          }),
          source.pipe(
            unpatchedMap(value => {
              if (valueIsWrapped(value)) {
                value[Refs].forEach(ref => refs.add(ref));
                return value.value;
              }
              return value;
            })
          )
        );
      },
    };
  }

  /** Imagine this case, the most simple one:

    addDebugTag("tagA"),
    source => new Observable(obs => {
      source.subscribe(obs);
    }),
    addDebugTag("tagB")

   * What we want to do is tie the source to the `new Observable` so `tagA` flows to `tagB`.
   * The inner `obs => { ... }` function is stored as `this._subscribe`
   * So what we need to:
   * - Detect the subscription to the source when we call `this._subscribe`
   * => To do that, We have the `observableStack` stack.
   *    We'll push before calling `this._subscribe`, and pop afterwards.
   *    We also need to pop and push when `.subscribe()` happens, because that
   *       might propagate more subscriptions we really don't care about.
   * - Propagate refs from the `source.subscribe()` to the observer `obs`.
   */

  if (
    this._subscribe !== Observable.prototype._subscribe &&
    !(this._subscribe as any)[Patched]
  ) {
    const originalSubscribeFn = this._subscribe;
    this._subscribe = (subscriber: Subscriber<T>) => {
      const originalNext = subscriber.next;
      subscriber.next = (value: T) => {
        const wrapped = valueIsWrapped(value)
          ? value
          : {
              value,
              [Refs]: new Set(),
            };

        if ((this as any)[Refs]) {
          (this as any)[Refs].forEach((ref: string) => wrapped[Refs].add(ref));
        }
        originalNext.call(subscriber, wrapped as T);
      };

      observableStack.push(this);
      const result = originalSubscribeFn.call(this, subscriber);
      observableStack.pop();
      return result;
    };
    (this._subscribe as any)[Patched] = true;
  }

  // Call the original `Observable.subscribe` by unwrapping the values
  const childObservable = observableStack.pop();
  if (childObservable && !childObservable[Refs]) {
    childObservable[Refs] = new Set();
  }
  const result = (() => {
    if (observerOrNext == null) {
      return (originalSubscribe as any).call(
        this,
        observerOrNext,
        error,
        complete
      );
    }
    if (typeof observerOrNext === 'function') {
      return (originalSubscribe as any).call(
        this,
        (value: T) => {
          if (childObservable && valueIsWrapped(value)) {
            value[Refs].forEach(ref => childObservable[Refs].add(ref));
          }
          observerOrNext(value);
        },
        error,
        complete
      );
    }
    return (originalSubscribe as any).call(this, {
      next:
        observerOrNext.next &&
        ((value: T) => {
          if (childObservable && valueIsWrapped(value)) {
            value[Refs].forEach(ref => childObservable[Refs].add(ref));
          }
          observerOrNext.next!(value);
        }),
      error: observerOrNext.error?.bind(observerOrNext),
      complete: observerOrNext.complete?.bind(observerOrNext),
    });
  })();
  observableStack.push(childObservable);
  return result;
};
Observable.prototype.subscribe = function<T>(
  this: Observable<T>,
  observerOrNext?: PartialObserver<T> | ((value: T) => void) | null,
  error?: ((error: any) => void) | null,
  complete?: (() => void) | null
) {
  if (observerOrNext == null) {
    return (subscribeWithPatch as any).call(
      this,
      observerOrNext,
      error,
      complete
    );
  }
  if (typeof observerOrNext === 'function') {
    return (subscribeWithPatch as any).call(
      this,
      (value: T) => {
        const unwrappedValue = unwrapValue(value);
        valuesStack.push({
          value: unwrappedValue,
          refs: valueIsWrapped(value) ? value[Refs] : null,
        });
        observerOrNext(unwrapValue(value));
        valuesStack.pop();
      },
      error,
      complete
    );
  }
  return (subscribeWithPatch as any).call(this, {
    next:
      observerOrNext.next &&
      ((value: T) => {
        const unwrappedValue = unwrapValue(value);
        valuesStack.push({
          value: unwrappedValue,
          refs: valueIsWrapped(value) ? value[Refs] : null,
        });
        observerOrNext.next!(unwrapValue(value));
        valuesStack.pop();
      }),
    error: observerOrNext.error?.bind(observerOrNext),
    complete: observerOrNext.complete?.bind(observerOrNext),
  });
};

export const unpatchedMap = <T, R>(mapFn: (value: T) => R) => (
  source$: Observable<T>
): Observable<R> =>
  new Observable(obs =>
    (subscribeWithPatch as any).call(source$, {
      next: (value: T) => obs.next(mapFn(value)),
      error: obs.error?.bind(obs),
      complete: obs.complete?.bind(obs),
    })
  );

interface DebugTag {
  id: string;
  label: string;
  refs: Set<string>;
  latestValue: any;
}

export const tags = new Map<string, DebugTag>();
export const addDebugTag = (label: string, id = label) => <T>(
  source: Observable<T>
) => {
  const debugTag: DebugTag = tags.has(id)
    ? tags.get(id)!
    : {
        id,
        label,
        refs: new Set<string>(),
        latestValue: undefined,
      };
  tags.set(debugTag.id, debugTag);

  const childRefs = new Set<string>();
  childRefs.add(debugTag.id);

  return (source.pipe(
    unpatchedMap(v => {
      if (valueIsWrapped(v)) {
        debugTag.latestValue = v.value;
        v[Refs].forEach(ref => debugTag.refs.add(ref));
        return {
          value: v.value,
          [Refs]: childRefs,
        };
      }
      debugTag.latestValue = v;
      return {
        value: v,
        [Refs]: childRefs,
      };
    })
  ) as any) as Observable<T>;
};
