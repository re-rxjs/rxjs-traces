import { bind, Subscribe } from "@react-rxjs/core";
import React from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { interval, merge, timer } from "rxjs";
import { addDebugTag } from "rxjs-traces";
import { DevTools } from "rxjs-traces-devtools";
import "rxjs-traces-devtools/dist/bundle.css";
import { scan, share, switchMap, withLatestFrom } from "rxjs/operators";
import "./App.css";

const loggedUser = timer(100).pipe(share());
const tradingAccount = loggedUser.pipe(
  switchMap(() => timer(100)),
  share(),
  addDebugTag("tradingAccount")
);
const userViewConfig = loggedUser.pipe(addDebugTag("userViewConfig"));
const viewConfig = tradingAccount.pipe(
  withLatestFrom(userViewConfig),
  addDebugTag("viewConfig")
);
const selectedAccount = tradingAccount.pipe(addDebugTag("selectedAccount"));

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

const dep = merge(viewConfig, selectedAccount);

function App() {
  return (
    <div className="App">
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Subscribe fallback={null} source$={dep}>
          <RandomComponent />
        </Subscribe>
      </ErrorBoundary>
      <DevTools />
    </div>
  );
}

export default App;
