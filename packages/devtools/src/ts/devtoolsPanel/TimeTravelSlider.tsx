import { FC, ChangeEvent } from "react"
import { connectObservable } from "react-rxjs"
import { historyLength$ } from "./messaging"
import React from "react"
import "./TimeTravelSlider.css"

const [useHistoryLength] = connectObservable(historyLength$)

export const TimeTravelSlider: FC<{
  slice: number | null
  onSliceChange: (slice: number | null) => void
}> = ({ slice, onSliceChange }) => {
  const max = useHistoryLength() - 1

  const handleOnChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const value = Number(evt.target.value)
    if (value === max) {
      onSliceChange(null)
    } else {
      onSliceChange(value)
    }
  }

  return (
    <div className="time-travel">
      <input
        className="time-travel__slider"
        type="range"
        min={0}
        max={max}
        value={slice === null ? max : slice}
        onChange={handleOnChange}
      />
      <input
        type="number"
        min={0}
        max={max}
        value={slice === null ? max : slice}
        onChange={handleOnChange}
      />
    </div>
  )
}
