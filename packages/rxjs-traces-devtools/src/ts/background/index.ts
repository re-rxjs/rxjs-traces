import { Subject } from 'rxjs';
import type { DebugTag } from 'rxjs-traces';
import { filter, map } from 'rxjs/operators';

const tagValue$ = new Subject<{
  tabId: number,
  tagValues: Record<string, DebugTag>
}>();

chrome.runtime.onMessage.addListener(
  function(message, sender) {
    if(sender.tab && sender.tab.id) {
      tagValue$.next({
        tabId: sender.tab.id,
        tagValues: message
      });
    }
  });

chrome.runtime.onConnect.addListener(function(devToolsConnection) {
  if(!devToolsConnection.name.startsWith('devtools-page_')) {
    return;
  }

  const toolsTabId = Number(devToolsConnection.name.split('_')[1]);
  const subscription = tagValue$.pipe(
    filter(({ tabId }) => tabId === toolsTabId),
    map(({ tagValues }) => tagValues)
  ).subscribe(
    value => devToolsConnection.postMessage(value)
  );
  
  devToolsConnection.onDisconnect.addListener(function() {
    subscription.unsubscribe();
  });
});
