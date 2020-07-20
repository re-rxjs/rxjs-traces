import * as React from "react";
import ReactDOM from "react-dom";
import { connectObservable } from "react-rxjs";
import { DebugTag } from "rxjs-traces";
import { Observable } from "rxjs";
import { startWith } from "rxjs/operators";
import { Visualization } from './Visualization';

const tagValue$ = new Observable<Record<string, DebugTag>>((obs) => {
  var backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page",
  });

  backgroundPageConnection.onMessage.addListener(function (message) {
    obs.next(message);
  });

  return () => {
    backgroundPageConnection.disconnect();
  };
});

const [useTagValues] = connectObservable(tagValue$.pipe(startWith({} as Record<string, DebugTag>)));

const App = () => {
  const tags = useTagValues();

  return <Visualization tags={tags} />;
}

ReactDOM.render(<App />, document.getElementById("popup-root"));
