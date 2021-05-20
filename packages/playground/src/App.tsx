import React from "react";
import { EMPTY, timer } from "rxjs";
import { addDebugTag } from "rxjs-traces";
import { DevTools } from "rxjs-traces-devtools";
import "rxjs-traces-devtools/dist/bundle.css";
import { share, switchMap } from "rxjs/operators";
import "./App.css";

const loggedUser = timer(1000).pipe(addDebugTag("loggedUser"), share());
// Problem number 1. Only happens if loggedUser is async and shared
// This top-level subscription causes loggedUser to be disconnected from any dependant.
loggedUser.subscribe();

const tradingAccount = loggedUser.pipe(addDebugTag("tradingAccount"));

const viewConfig = tradingAccount.pipe(addDebugTag("viewConfig"));

const positionsMap = tradingAccount.pipe(
  // Problem number 2. Happens when loggedUser emits the value
  // 'positionsMap' should have a dependency to '1' and 'tradingAccount' (OK)
  // but a dependency from 'viewConfig' to '1' also appears! (ERR)
  switchMap(() => EMPTY.pipe(addDebugTag("1"))),
  addDebugTag("positionsMap")
);

// Problem 3. Maybe related/same to [1]
// Removing this setTimeout causes everything to be disconnected
setTimeout(() => {
  viewConfig.subscribe();
  positionsMap.subscribe();
});

function App() {
  return (
    <div className="App">
      {/* <Subscribe fallback={null} source$={dep}> */}
      Hey
      {/* </Subscribe> */}
      <DevTools />
    </div>
  );
}

export default App;
