import * as React from "react"
import { useState } from "react"
import ReactDOM from "react-dom"
import { FilterBar } from "./FilterBar"
import { copy$ } from "./messaging"
import { TagOverlay } from "./TagOverlay"
import { TimeTravelSlider } from "./TimeTravelSlider"
import { Visualization } from "./Visualization"

interface TagSelection {
  id: string
  x: number
  y: number
}
const App = () => {
  const [selectedTag, setSelectedTag] = useState<TagSelection | null>(null)
  const [filter, setFilter] = useState("")

  return (
    <>
      <FilterBar filter={filter} onFilterChange={setFilter} />
      <Visualization
        filter={filter}
        onSelectNode={(id, x, y) => setSelectedTag({ id, x, y })}
        onDeselectNode={() => setSelectedTag(null)}
      />
      {selectedTag && (
        <TagOverlay
          id={selectedTag.id}
          initialX={selectedTag.x}
          initialY={selectedTag.y}
          onCopy={(value) => copy$.next(value)}
        />
      )}
      <TimeTravelSlider />
    </>
  )
}

ReactDOM.render(<App />, document.getElementById("popup-root"))
