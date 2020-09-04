import React, { Suspense } from "react"
import { bind, shareLatest } from "@react-rxjs/macro"
import { interval, of } from "rxjs"
import { addDebugTag } from "rxjs-traces"
import { map, switchMap, take } from "rxjs/operators"
import "./App.css"

const random$ = interval(500).pipe(
  map(() => Math.random()),
  shareLatest(),
  addDebugTag("random"),
)
random$.subscribe()

const stream = interval(2000).pipe(
  addDebugTag("interval"),
  switchMap((v, i) => {
    if (i > 0 && i % 3 === 0) {
      return random$.pipe(take(1))
    } else if (i > 0 && i % 4 === 0) {
      return of(v).pipe(addDebugTag("embedded"))
    }
    return of(v)
  }),
  addDebugTag("result"),
)

const [useStream] = bind(stream)

const RandomComponent = () => {
  useStream()

  return null
}

function App() {
  return (
    <div className="App">
      <Suspense fallback={<div>Loading...</div>}>
        <RandomComponent />
      </Suspense>
    </div>
  )
}

export default App
