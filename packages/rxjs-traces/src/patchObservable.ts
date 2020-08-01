import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export const Patched = Symbol('patched');

const originalSubscribe = Observable.prototype.subscribe;

export function patchObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe = originalSubscribe;
  (ObservableCtor as any).prototype[Patched] = true;
}
export function restoreObservable(ObservableCtor: typeof Observable) {
  ObservableCtor.prototype.subscribe = originalSubscribe;
  (ObservableCtor as any).prototype[Patched] = false;
}

export const unpatchedMap = map;

export const mapWithoutChildRef = map;
