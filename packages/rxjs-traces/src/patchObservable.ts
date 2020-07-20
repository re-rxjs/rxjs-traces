import {
  Observable,
  PartialObserver,
  Subscriber,
  Subscription,
  Observer,
} from 'rxjs';
import { Refs, unwrapValue, valueIsWrapped } from './wrappedValue';

export const Patched = Symbol('patched');

const observableStack: any[] = [];
const valuesStack: any[] = []; // TODO document this is for mergeMap case
const originalSubscribe = Observable.prototype.subscribe;
type ComposableSubscribe<T> = (
  this: Observable<T>,
  observer: Partial<Observer<T>>
) => Subscription;
const findChildRefsSubscribe = <T>(
  parent: ComposableSubscribe<T>
): ComposableSubscribe<T> =>
  function(this: Observable<T>, observer: Partial<Observer<T>>) {
    const childObservable = observableStack.pop();
    if (childObservable && !childObservable[Refs]) {
      childObservable[Refs] = new Set();
    }
    const result = parent.call(this, {
      next:
        observer.next &&
        ((value: T) => {
          if (childObservable && valueIsWrapped(value)) {
            value[Refs].forEach(ref => childObservable[Refs].add(ref));
          }
          observer.next!(value);
        }),
      error: observer.error?.bind(observer),
      complete: observer.complete?.bind(observer),
    });
    if (childObservable) {
      observableStack.push(childObservable);
    }
    return result;
  };
const subscribeWithPatch = <T>(
  parent: ComposableSubscribe<T>
): ComposableSubscribe<T> =>
  function(this: Observable<T>, observer: Partial<Observer<T>>) {
    if (this.operator && !(this.operator as any)[Patched]) {
      const originalOperator = this.operator;
      this.operator = {
        call: (subscriber, source: Observable<any>) => {
          const refs = new Set<string>();
          /**
           * We want to detect what observables does it subscribe to from parameters
           * think of withLatestFrom/combineLatest.
           * What we'll do is create a fake source which won't subscribe straight
           * away, so those subscribes that happen synchronously will be legit.
           */
          let innerOperatorSubscriber: any = null;
          const fakeSource = {
            subscribe: (subscriber: any) => {
              innerOperatorSubscriber = subscriber;
            },
          } as Observable<any>;
          observableStack.push(this);
          originalOperator.call(
            new Subscriber({
              next: value => {
                const lastValue = valuesStack.pop();
                if (
                  lastValue &&
                  Object.is(lastValue.value, unwrapValue(value))
                ) {
                  lastValue.refs.forEach((ref: string) => refs.add(ref));
                }

                if ((this as any)[Refs]) {
                  (this as any)[Refs].forEach((ref: string) => refs.add(ref));
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
            fakeSource
          );
          observableStack.pop();
          return source
            .pipe(
              unpatchedMap(value => {
                if (valueIsWrapped(value)) {
                  value[Refs].forEach(ref => refs.add(ref));
                  return value.value;
                }
                return value;
              })
            )
            .subscribe(innerOperatorSubscriber);
        },
      };
      (this.operator as any)[Patched] = true;
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

    let overridenThis = this;
    if (this._subscribe !== Observable.prototype._subscribe) {
      const originalSubscribeFn = this._subscribe;
      // When using multicast => ConnectableObservables, rxjs uses Object.create
      // that sets '_subscribe' to not writteable, so we can't patch it that way.
      // It seems like creating a copy of the object like this solves it.
      overridenThis = Object.create(this, {
        _subscribe: {
          value: (subscriber: Subscriber<T>) => {
            if (!(this as any).isDebugTag) {
              const originalNext = subscriber.next;
              subscriber.next = (value: T) => {
                const wrapped = valueIsWrapped(value)
                  ? value
                  : {
                      value,
                      [Refs]: new Set(),
                    };

                if ((this as any)[Refs]) {
                  (this as any)[Refs].forEach((ref: string) =>
                    wrapped[Refs].add(ref)
                  );
                }
                originalNext.call(subscriber, wrapped as T);
              };
            }

            observableStack.push(this);
            const result = originalSubscribeFn.call(this, subscriber);
            observableStack.pop();
            return result;
          },
        },
      });
    }

    return parent.call(overridenThis, observer);
  };
const unwrappedSubscribe = <T>(
  parent: ComposableSubscribe<T>
): ComposableSubscribe<T> =>
  function(this: Observable<T>, observer: Partial<Observer<T>>) {
    return parent.call(this, {
      next:
        observer.next &&
        ((value: T) => {
          const unwrappedValue = unwrapValue(value);
          valuesStack.push({
            value: unwrappedValue,
            refs: valueIsWrapped(value) ? value[Refs] : new Set(),
          });
          observer.next!(unwrapValue(value));
          valuesStack.pop();
        }),
      error: observer.error?.bind(observer),
      complete: observer.complete?.bind(observer),
    });
  };

export function patchObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe = function<T>(
    this: Observable<T>,
    observerOrNext?: PartialObserver<T> | ((value: T) => void) | null,
    error?: ((error: any) => void) | null,
    complete?: (() => void) | null
  ) {
    const composedSubscribe = unwrappedSubscribe(
      subscribeWithPatch(findChildRefsSubscribe<T>(originalSubscribe as any))
    );

    return composedSubscribe.call(this, {
      next: value => {
        if (typeof observerOrNext === 'function') {
          observerOrNext(value);
        } else if (
          typeof observerOrNext === 'object' &&
          observerOrNext != null
        ) {
          observerOrNext.next && observerOrNext.next(value);
        }
      },
      error: err => {
        if (
          observerOrNext &&
          typeof observerOrNext === 'object' &&
          observerOrNext.error
        ) {
          observerOrNext.error(err);
        } else if (error) {
          error(err);
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
    });
  };
  (ObservableCtor as any).prototype[Patched] = true;
}
export function restoreObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe = originalSubscribe;
  (ObservableCtor as any).prototype[Patched] = false;
}

export const unpatchedMap = <T, R>(mapFn: (value: T) => R) => (
  source$: Observable<T>
): Observable<R> =>
  new Observable(obs =>
    subscribeWithPatch(
      findChildRefsSubscribe<T>(originalSubscribe as any)
    ).call(source$, {
      next: (value: T) => obs.next(mapFn(value)),
      error: obs.error?.bind(obs),
      complete: obs.complete?.bind(obs),
    })
  );

export const mapWithoutChildRef = <T, R>(mapFn: (value: T) => R) => (
  source$: Observable<T>
): Observable<R> =>
  new Observable(obs =>
    subscribeWithPatch<T>(originalSubscribe as any).call(source$, {
      next: (value: T) => obs.next(mapFn(value)),
      error: obs.error?.bind(obs),
      complete: obs.complete?.bind(obs),
    })
  );
