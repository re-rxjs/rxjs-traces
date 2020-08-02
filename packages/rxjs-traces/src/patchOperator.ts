import { Observable } from 'rxjs';
import { getMetadata, findReverseTagRefs, detectRefChanges } from './metadata';

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
  const resultOperator = (...args: any[]) => {
    // Get the list of stream arguments to link refs.
    const streamArgs = args.filter((arg) => arg instanceof Observable);

    return (source: Observable<unknown>) => {
      // Map arguments to mock out functions and find out if they're projections
      const mappedArgs = args.map((arg) => {
        if (typeof arg !== 'function') {
          return arg;
        }
        return (...argFnArgs: any[]) => {
          const argFnResult = arg(...argFnArgs);
          // Synchronous calls won't work, because `result` hasn't been created yet
          if (!(argFnResult instanceof Observable) || !result) {
            return argFnResult;
          }

          // It's a projection, we can link refs
          const dependantTagRefs = findReverseTagRefs(source);
          detectRefChanges(() => {
            const resultMetadata = getMetadata(result);
            resultMetadata.refs.add(argFnResult);
            getMetadata(argFnResult).reverseRefs.add(result);
          }, dependantTagRefs);
          return argFnResult;
        };
      });

      const applied = operator(...mappedArgs);
      const result = applied(source);
      const resultMetadata = getMetadata(result);
      const sourceMetadata = getMetadata(source);

      resultMetadata.refs.add(source);
      sourceMetadata.reverseRefs.add(result);

      streamArgs.forEach((arg) => {
        const argMetadata = getMetadata(arg);
        resultMetadata.refs.add(arg);
        argMetadata.reverseRefs.add(result);
      });
      return result;
    };
  };

  return resultOperator as T;
};
