import React, { Suspense } from "react"
import { connectObservable, shareLatest } from "react-rxjs"
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

const stream = interval(3000).pipe(
  addDebugTag("interval"),
  switchMap((v, i) => {
    if (i > 0 && i % 3 === 0) {
      return random$.pipe(take(1))
    }
    return of(v)
  }),
  addDebugTag("result"),
)

const [useStream] = connectObservable(stream)

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
