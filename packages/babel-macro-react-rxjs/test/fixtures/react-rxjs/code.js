import { bind } from '@react-rxjs/macro';

const [useCount, count$] = bind(source$.pipe(
  scan(value => value + 1, 0),
  startWith(0)
));
