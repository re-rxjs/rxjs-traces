import { merge, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  newTag$,
  tagRefDetection$,
  tagSubscription$,
  tagUnsubscription$,
  tagValueChange$,
} from './changes';

let extensionSubscription: Subscription | null = null;
window.addEventListener('message', (event: MessageEvent) => {
  const { data, origin } = event;

  if (origin !== window.location.origin) {
    return;
  }

  if (
    typeof data === 'object' &&
    data.source === 'rxjs-traces-devtools' &&
    data.type === 'receive'
  ) {
    if (extensionSubscription) {
      extensionSubscription.unsubscribe();
    }
    extensionSubscription = merge(
      newTag$.pipe(
        map(payload => ({
          type: 'new-tag',
          payload,
        }))
      ),
      tagSubscription$.pipe(
        map(payload => ({
          type: 'tag-subscription',
          payload,
        }))
      ),
      tagUnsubscription$.pipe(
        map(payload => ({
          type: 'tag-unsubscription',
          payload,
        }))
      ),
      tagValueChange$.pipe(
        map(payload => ({
          type: 'tag-value-change',
          payload,
        }))
      ),
      tagRefDetection$.pipe(
        map(payload => ({
          type: 'tag-ref-detection',
          payload,
        }))
      )
    ).subscribe(({ type, payload }) => {
      window.postMessage(
        {
          source: 'rxjs-traces',
          type,
          payload: prepareForTransmit(payload),
        },
        window.location.origin
      );
    });
  }
});

export function initDevtools() {
  window.postMessage(
    {
      source: 'rxjs-traces-bridge',
      type: 'connected',
    },
    window.location.origin
  );
}

/**
 * Clones the object changing the values that can't be transmitted:
 *  - Symbols
 *  - undefined
 */
function prepareForTransmit<T>(
  value: T,
  visitedValues = new WeakMap<any, any>()
) {
  switch (typeof value) {
    case 'symbol':
      return String(value);
    case 'undefined':
      return 'Symbol(undefined)';
    case 'object':
      if (value === null) {
        return value;
      }

      if (visitedValues.has(value)) {
        return visitedValues.get(value);
      }

      if (Array.isArray(value)) {
        const result: any[] = [];
        visitedValues.set(value, result);
        value.forEach(v => result.push(prepareForTransmit(v, visitedValues)));
        return result;
      }

      const result: any = {};
      visitedValues.set(value, result);
      Object.keys(value).forEach(
        key =>
          (result[key] = prepareForTransmit((value as any)[key], visitedValues))
      );
      return result;
    default:
      return value;
  }
}
