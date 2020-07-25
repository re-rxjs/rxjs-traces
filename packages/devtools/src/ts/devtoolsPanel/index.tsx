import * as React from "react"
import ReactDOM from "react-dom"
import { connectObservable } from "react-rxjs"
import { DebugTag } from "rxjs-traces"
import { Observable } from "rxjs"
import { startWith } from "rxjs/operators"
import { Visualization } from "./Visualization"
import { deserialize } from "./deserialize"
import { useState } from "react"
import { TagOverlay } from "./TagOverlay"

const tagValue$ = new Observable<Record<string, DebugTag>>(obs => {
  var backgroundPageConnection = chrome.runtime.connect({
    name: "devtools-page_" + chrome.devtools.inspectedWindow.tabId,
  })

  backgroundPageConnection.onMessage.addListener(function(message) {
    obs.next(deserialize(message))
  })

  return () => {
    backgroundPageConnection.disconnect()
  }
})

const [useTagValues] = connectObservable(
  tagValue$.pipe(startWith({} as Record<string, DebugTag>)),
)

interface TagSelection {
  id: string
  x: number
  y: number
}
const App = () => {
  const [selectedTag, setSelectedTag] = useState<TagSelection | null>(null)
  const tags = useTagValues()

  return (
    <>
      <Visualization
        tags={tags}
        onSelectNode={(id, x, y) => setSelectedTag({ id, x, y })}
        onDeselectNode={() => setSelectedTag(null)}
      />
      {selectedTag && (
        <TagOverlay
          tag={tags[selectedTag.id]}
          initialX={selectedTag.x}
          initialY={selectedTag.y}
        />
      )}
    </>
  )
}

ReactDOM.render(<App />, document.getElementById("popup-root"))
