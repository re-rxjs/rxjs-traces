import * as React from "react"
import { useState } from "react"
import {
  FilterBar,
  TagOverlay,
  TimeTravelSlider,
  Visualization,
} from "./components"

interface TagSelection {
  id: string
  x: number
  y: number
}
export const DevTools: React.FC<{
  onCopy?: (value: string) => void
}> = ({ onCopy = () => void 0 }) => {
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
          onCopy={onCopy}
        />
      )}
      <TimeTravelSlider />
    </>
  )
}
