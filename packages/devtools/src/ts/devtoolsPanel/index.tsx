import * as React from "react"
import ReactDOM from "react-dom"
import { connectFactoryObservable } from "react-rxjs"
import { Visualization } from "./Visualization"
import { useState } from "react"
import { TagOverlay } from "./TagOverlay"
import { FilterBar } from "./FilterBar"
import { tagValue$, copy$ } from "./messaging"
import { TimeTravelSlider } from "./TimeTravelSlider"

const [useTagValues] = connectFactoryObservable((slice: number | null) =>
  tagValue$(slice),
)

interface TagSelection {
  id: string
  x: number
  y: number
}
const App = () => {
  const [selectedTag, setSelectedTag] = useState<TagSelection | null>(null)
  const [slice, setSlice] = useState<null | number>(null)
  const tags = useTagValues(slice)
  const [filter, setFilter] = useState("")

  return (
    <>
      <FilterBar filter={filter} onFilterChange={setFilter} />
      <Visualization
        filter={filter}
        tags={tags}
        onSelectNode={(id, x, y) => setSelectedTag({ id, x, y })}
        onDeselectNode={() => setSelectedTag(null)}
      />
      {selectedTag && (
        <TagOverlay
          tag={tags[selectedTag.id]}
          initialX={selectedTag.x}
          initialY={selectedTag.y}
          onCopy={value => copy$.next(value)}
        />
      )}
      <TimeTravelSlider slice={slice} onSliceChange={setSlice} />
    </>
  )
}

ReactDOM.render(<App />, document.getElementById("popup-root"))
