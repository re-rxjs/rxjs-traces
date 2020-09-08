import { bind } from "@react-rxjs/core"
import React from "react"
import { ErrorBoundary, FallbackProps } from "react-error-boundary"
import { interval } from "rxjs"
import { addDebugTag } from "rxjs-traces"
import { DevTools } from "rxjs-traces-devtools"
import "rxjs-traces-devtools/dist/bundle.css"
import { startWith } from "rxjs/operators"
import "./App.css"

const stream = interval(2000).pipe(
  addDebugTag("interval"),
  startWith(0),
  addDebugTag("result"),
)

const [useStream] = bind(stream)

const RandomComponent = () => {
  useStream()

  return <DevTools />
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
