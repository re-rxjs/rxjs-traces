import { BehaviorSubject, Observable, of, ReplaySubject } from "rxjs";
import { distinct, mergeAll, share, switchMap } from "rxjs/operators";
import { skip } from "./skip";

class ObservableMetadata {
  private dependencies$ = skip(new ReplaySubject<Observable<string>>());
  private tag$ = skip(new BehaviorSubject<string | null>(null));
  private tagDependencies$ = this.dependencies$.pipe(
    mergeAll(),
    distinct(),
    share({
      connector: () => skip(new ReplaySubject<string>()),
      resetOnRefCountZero: true,
    })
  );

  public setTag(tag: string) {
    this.tag$.next(tag);
  }

  public getTag() {
    return this.tag$.getValue();
  }

  public getDependencies$() {
    return this.tagDependencies$;
  }

  public addDependency(observable: Observable<unknown>) {
    this.dependencies$.next(getMetadata(observable).getChainedDependencies$());
  }

  // When chaining we want to stop if this observable has a tag.
  public getChainedDependencies$() {
    return this.tag$.pipe(
      switchMap((value) => (value === null ? this.tagDependencies$ : of(value)))
    );
  }

  /**
   * We need reverse dependencies (Dependants) to track new references in some operators (e.g. concat and switchMap)
   */
  public dependants = new Set<Observable<unknown>>();
}

/**
 * We can't put this info in each Observable instance because `multicast`
 * creates a copy of the observables when it makes a connectable one, messing up
 * references.
 */
const metadataStore = new WeakMap<Observable<unknown>, ObservableMetadata>();

export const hasMetadata = (observable: Observable<unknown>) =>
  metadataStore.has(observable);
export const getMetadata = (
  observable: Observable<unknown>
): ObservableMetadata => {
  if (!hasMetadata(observable)) {
    metadataStore.set(observable, new ObservableMetadata());
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return metadataStore.get(observable)!;
};
