import { bind } from "@react-rxjs/core"

const [useCount, count$] = bind(
  source$.pipe(
    scan((value) => value + 1, 0),
    startWith(0),
  ),
)
