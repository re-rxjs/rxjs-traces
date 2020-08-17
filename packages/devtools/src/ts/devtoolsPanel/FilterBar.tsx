import { FC } from "react"
import React from "react"
import "./FilterBar.css"

export const FilterBar: FC<{
  filter: string
  onFilterChange: (filter: string) => void
}> = ({ filter, onFilterChange }) => (
  <div className="filter-bar">
    <input
      type="text"
      placeholder="Search..."
      value={filter}
      onChange={(evt) => onFilterChange(evt.target.value)}
    />
  </div>
)
