import { ReplaySubject } from 'rxjs';
import type { DebugTag } from 'rxjs-traces';

const tagValue$ = new ReplaySubject<Record<string, DebugTag>>(1);

chrome.runtime.onMessage.addListener(
  function(message, sender) {
    if(sender.tab) {
      tagValue$.next(message);
    }
  });

chrome.runtime.onConnect.addListener(function(devToolsConnection) {
  const subscription = tagValue$.subscribe(
    value => devToolsConnection.postMessage(value)
  );
  
  devToolsConnection.onDisconnect.addListener(function() {
    subscription.unsubscribe();
  });
});
