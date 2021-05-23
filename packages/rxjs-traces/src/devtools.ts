import { mergeWithKey } from "@react-rxjs/utils";
import { isObservable, Observable } from "rxjs";
import { bufferWhen, connect, switchMapTo, take } from "rxjs/operators";
import {
  newTag$,
  tagRefDetection$,
  tagSubscription$,
  tagUnsubscription$,
  tagValueChange$,
} from "./changes";
import { skip } from "./skip";

// For subscribers that are late (i.e. devtools take some time to initialize) we must keep old events.
const pastHistory: any[] = [];

window.addEventListener("message", (event: MessageEvent) => {
  const { data, origin } = event;

  if (origin !== window.location.origin) {
    return;
  }

  if (
    typeof data === "object" &&
    data.source === "rxjs-traces-devtools" &&
    data.type === "receive"
  ) {
    window.postMessage(
      {
        source: "rxjs-traces",
        type: "event-history",
        payload: prepareForTransmit(pastHistory),
      },
      window.location.origin
    );
  }
});

declare class WeakRef<T extends object> {
  constructor(target?: T);
  deref(): T | undefined;
}

// For test environment
if (!(window as any).WeakRef) {
  console.warn(
    "Environment doesn't support WeakRef - rxjs-traces won't be able to track objects"
  );
}
const WeakRefCtor: typeof WeakRef =
  (window as any).WeakRef ||
  function NotWeakRef<T extends object>(this: WeakRef<T>) {
    this.deref = () => undefined;
  };

export function initDevtools() {
  skip(
    mergeWithKey({
      newTag$,
      tagSubscription$,
      tagUnsubscription$,
      tagValueChange$: tagValueChange$.pipe(
        connect((shared) =>
          skip(shared).pipe(
            bufferWhen(() =>
              skip(shared).pipe(take(1), switchMapTo(skip(microTask$)))
            )
          )
        )
      ),
      tagRefDetection$,
    })
  ).subscribe((res) => {
    if (res.type === "tagValueChange$") {
      pastHistory.push({
        type: res.type,
        payload: res.payload.map((v) => ({
          ...v,
          value:
            typeof v.value === "object" && v.value !== null
              ? // Wrap the payload into a WeakRef so that it can get garbage collected.
                new WeakRefCtor(v.value)
              : v.value,
        })),
      });
    } else {
      pastHistory.push(res);
    }

    try {
      window.postMessage(
        {
          source: "rxjs-traces",
          type: res.type,
          payload: prepareForTransmit(res.payload),
        },
        window.location.origin
      );
    } catch (ex) {
      if (ex.name === "DataCloneError") {
        console.warn(`Can't transmit object to devtools`, res.payload, ex);
      } else {
        throw ex;
      }
    }
  });

  window.postMessage(
    {
      source: "rxjs-traces-bridge",
      type: "connected",
    },
    window.location.origin
  );
}

/**
 * Clones the object changing the values that can't be transmitted:
 *  - Symbols
 *  - undefined
 *  - WeakRefs
 */
function prepareForTransmit<T>(
  value: T,
  visitedValues = new WeakMap<any, any>()
): any {
  if (value instanceof WeakRefCtor) {
    const ref = value.deref();
    if (ref === undefined) {
      return "Symbol(GCed Object)";
    }
    return prepareForTransmit(ref, visitedValues);
  }
  switch (typeof value) {
    case "symbol":
      return String(value);
    case "undefined":
      return "Symbol(undefined)";
    case "object":
      if (value === null) {
        return value;
      }
      if (isObservable(value)) {
        return "Symbol(Observable)";
      }

      if (value instanceof Map) {
        return prepareForTransmit(
          Array.from(value.entries()).map(([key, value]) => ({ key, value })),
          visitedValues
        );
      }

      if (value instanceof Set) {
        return prepareForTransmit(Array.from(value.values()), visitedValues);
      }

      if (visitedValues.has(value)) {
        return visitedValues.get(value);
      }

      if (Array.isArray(value)) {
        const result: any[] = [];
        visitedValues.set(value, result);
        value.forEach((v) => result.push(prepareForTransmit(v, visitedValues)));
        return result;
      }

      const result: any = {};
      visitedValues.set(value, result);
      Object.keys(value).forEach(
        (key) =>
          (result[key] = prepareForTransmit((value as any)[key], visitedValues))
      );
      return result;
    case "function":
      return `Symbol(function ${value.name})`;
    case "bigint":
      return value.toString() + "n";
    default:
      return value;
  }
}

const microTask$ = new Observable<void>((obs) => {
  const run = () => {
    if (obs.closed) return;
    obs.next();
    obs.complete();
  };
  if ("queueMicrotask" in globalThis) {
    queueMicrotask(run);
  } else {
    Promise.resolve().then(run);
  }
});
