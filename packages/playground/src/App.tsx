import { bind } from "@react-rxjs/core"
import React, { Suspense } from "react"
import { ErrorBoundary, FallbackProps } from "react-error-boundary"
import { interval } from "rxjs"
import { addDebugTag } from "rxjs-traces"
import { DevTools } from "rxjs-traces-devtools"
import "rxjs-traces-devtools/dist/bundle.css"
import { scan, share } from "rxjs/operators"
import "./App.css"

const seconds = interval(1000).pipe(addDebugTag("seconds"), share())
const value = seconds.pipe(
  scan((total, s) => total + s),
  addDebugTag("value"),
)

const [useStream] = bind(value)

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
