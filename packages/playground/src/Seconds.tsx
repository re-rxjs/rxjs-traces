import { bind, Subscribe } from "@react-rxjs/core";
import React from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { EMPTY, interval, merge, timer } from "rxjs";
import { addDebugTag } from "rxjs-traces";
import { DevTools } from "rxjs-traces-devtools";
import "rxjs-traces-devtools/dist/bundle.css";
import { scan, share, switchMap, withLatestFrom } from "rxjs/operators";
import "./App.css";

const seconds = interval(1000).pipe(addDebugTag("seconds"), share());
const value = seconds.pipe(
  scan((total, s) => total + s),
  addDebugTag("value")
);

const [useStream] = bind(value);

const RandomComponent = () => {
  const value = useStream();
  return <div>{value}</div>;
};

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
  );
}

export function Seconds() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Subscribe fallback={null}>
        <RandomComponent />
      </Subscribe>
    </ErrorBoundary>
  );
}

export default Seconds;
