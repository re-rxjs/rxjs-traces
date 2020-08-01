import { Observable } from 'rxjs';

export const patchOperator = <
  T extends (...args: any[]) => (source: Observable<any>) => Observable<any>
>(
  operator: T
): T => {
  return operator;
};
