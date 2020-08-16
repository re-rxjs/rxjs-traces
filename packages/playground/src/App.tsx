import React from "react"
import { ErrorBoundary, FallbackProps } from "react-error-boundary"
import { bind } from "@react-rxjs/core"
import { interval } from "rxjs"
import { addDebugTag } from "rxjs-traces"
import { map, startWith } from "rxjs/operators"
import "./App.css"

const stream = interval(2000).pipe(
  addDebugTag("interval"),
  startWith(0),
  map((v, i) => {
    if (i > 0 && i % 3 === 0) {
      throw new Error("error")
    }
    return v
  }),
  addDebugTag("result"),
)

const [useStream] = bind(stream)

const RandomComponent = () => {
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
        <RandomComponent />
      </ErrorBoundary>
    </div>
  )
}

export default App
