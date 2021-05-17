import { FC, ChangeEvent } from "react";
import { bind } from "@react-rxjs/core";
import { historyLength$, slice$ } from "../historySlice";
import React from "react";
import "./TimeTravelSlider.css";

const [useHistoryLength] = bind(historyLength$, 0);
const [useSlice] = bind(slice$, null);

export const TimeTravelSlider: FC = () => {
  const slice = useSlice();
  const max = useHistoryLength();

  const handleOnChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const value = Number(evt.target.value);
    if (value === max) {
      slice$.next(null);
    } else {
      slice$.next(value);
    }
  };

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
  );
};
