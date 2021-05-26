import { bind } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import React from "react";
import "./FilterBar.css";

const [filterChange$, setFilter] = createSignal<string>();

export const [useFilter, filter$] = bind(filterChange$, "");

export const FilterBar = () => {
  const filter = useFilter();

  return (
    <div className="filter-bar">
      <input
        type="text"
        placeholder="Search by label"
        value={filter}
        onChange={(evt) => setFilter(evt.target.value)}
      />
    </div>
  );
};
