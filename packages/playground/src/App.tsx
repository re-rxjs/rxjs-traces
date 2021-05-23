import React from "react";
import { defer, EMPTY, of, timer } from "rxjs";
// import { addDebugTag } from "rxjs-traces";
// import { DevTools } from "rxjs-traces-devtools";
import "rxjs-traces-devtools/dist/bundle.css";
import { share, switchMap } from "rxjs/operators";
import "./App.css";

const time = timer(1000);
(time as any).asdf = 'time'
const loggedUser = time.pipe(share());
(loggedUser as any).asdf = 'loggedUser'

const tradingAccount = defer(() => loggedUser);
(tradingAccount as any).asdf = 'tradingAccount'

const viewConfig = defer(() => tradingAccount);
(viewConfig as any).asdf = 'viewConfig';

const of1 = timer(1000);
(of1 as any).asdf = 'of(1)';
const positionsMap = tradingAccount.pipe(
  // Problem number 2. Happens when loggedUser emits the value
  // 'positionsMap' should have a dependency to '1' and 'tradingAccount' (OK)
  // but a dependency from 'viewConfig' to '1' also appears! (ERR)
  switchMap(() => of1)
);
(positionsMap as any).asdf = 'positionsMap';

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
      {/* <DevTools /> */}
    </div>
  );
}

export default App;
