import { bind, SUSPENSE } from "@react-rxjs/core"
import React, { Suspense } from "react"
import { ErrorBoundary, FallbackProps } from "react-error-boundary"
import { interval, merge, Observable } from "rxjs"
import { addDebugTag } from "rxjs-traces"
import { DevTools } from "rxjs-traces-devtools"
import "rxjs-traces-devtools/dist/bundle.css"
import { map, startWith, take } from "rxjs/operators"
import "./App.css"

const auto$ = interval(0).pipe(take(102))

const manual$ = new Observable<number>((obs) => {
  let i = 502
  ;(window as any).bump = () => obs.next(i++)
  return () => ((window as any).bump = null)
})

const stream = merge(auto$, manual$).pipe(
  addDebugTag("interval"),
  startWith(0),
  map((v) => (v % 3 === 0 ? v : SUSPENSE)),
  addDebugTag("result"),
)

const [useStream] = bind(stream)

const RandomComponent = () => {
  // const value = useStream()
  // return <div>{value}</div>

  useStream()
  return null
}

function ErrorFallback({
  error,
  componentStack,
  resetErrorBoundary,
}: FallbackProps) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error?.message}</pre>
      <pre>{componentStack}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

function App() {
  return (
    <div className="App">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Suspense fallback={null}>
          <RandomComponent />
        </Suspense>
      </ErrorBoundary>
      <DevTools />
    </div>
  )
}

export default App
