import { FC, ChangeEvent } from "react"
import { connectObservable } from "react-rxjs"
import { historyLength$, slice$ } from "./messaging"
import React from "react"
import "./TimeTravelSlider.css"

const [useHistoryLength] = connectObservable(historyLength$)
const [useSlice] = connectObservable(slice$)

export const TimeTravelSlider: FC = () => {
  const slice = useSlice()
  const max = useHistoryLength()

  const handleOnChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const value = Number(evt.target.value)
    if (value === max) {
      slice$.next(null)
    } else {
      slice$.next(value)
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
