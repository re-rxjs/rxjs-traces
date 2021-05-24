import * as React from "react";
import { FilterBar, TimeTravelSlider } from "./components";
import { CopyContext } from "./copy";
import { GraphView, ListView } from "./views";

const defaultCopy = (value: string) => navigator.clipboard.writeText(value);

export const DevTools: React.FC<{
  onCopy?: (value: string) => void;
}> = ({ onCopy = defaultCopy }) => {
  const [view, setView] = React.useState<"list" | "graph">("list");

  return (
    <CopyContext.Provider value={onCopy}>
      <FilterBar />
      {view === "list" ? (
        <ListView onSwitchView={() => setView("graph")} />
      ) : (
        <GraphView onSwitchView={() => setView("list")} />
      )}
      <TimeTravelSlider />
    </CopyContext.Provider>
  );
};
