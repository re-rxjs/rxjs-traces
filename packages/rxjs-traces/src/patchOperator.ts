import { Observable } from 'rxjs';
import { mapWithoutChildRef } from './patchObservable';
import { valueIsWrapped, Refs, WrappedValue } from './wrappedValue';

export const patchOperator = <
  T extends (...args: any[]) => (source: Observable<any>) => Observable<any>
>(
  operator: T
): T => {
  /**
   * This will control:
   * - Regular top-to-bottom refernces
   * - Parameter references (e.g. withLatestFrom(something$))
   * - inner observable references (e.g. mergeAll)
   */
  const result = (...args: any[]) => {
    const argRefs = new Set<string>();
    const mappedArgs = args.map(arg => {
      if (arg instanceof Observable) {
        return arg.pipe(
          mapWithoutChildRef(value => {
            if (valueIsWrapped(value)) {
              value[Refs].forEach(ref => argRefs.add(ref));
            }
            return value;
          })
        );
      }
      if (typeof arg === 'function') {
        return function(this: any, ...argFnArgs: any[]) {
          const argFnResult = arg.call(this, ...argFnArgs);
          if (argFnResult instanceof Observable) {
            return argFnResult.pipe(
              mapWithoutChildRef(value => {
                if (valueIsWrapped(value)) {
                  value[Refs].forEach(ref => argRefs.add(ref));
                }
                return value;
              })
            );
          }
          return argFnResult;
        };
      }
      return arg;
    });
    const applied = operator(...mappedArgs);

    return function(stream: Observable<unknown>) {
      const refs = new Set<string>();
      return applied(
        stream.pipe(
          mapWithoutChildRef(v => {
            if (valueIsWrapped(v)) {
              v[Refs].forEach(ref => refs.add(ref));
              return v.value;
            }
            return v;
          })
        )
      ).pipe(
        mapWithoutChildRef(
          (value): WrappedValue => {
            argRefs.forEach(ref => refs.add(ref));
            if (valueIsWrapped(value)) {
              value[Refs].forEach(ref => refs.add(ref));
              return {
                value: value.value,
                [Refs]: refs,
              };
            }
            return {
              value,
              [Refs]: refs,
            };
          }
        )
      );
    };
  };

  return result as T;
};
