import React from "react";
import { useState } from "react";
import { TagOverlay } from "./TagOverlay";
import { Visualization } from "./Visualization";

interface TagSelection {
  id: string;
  x: number;
  y: number;
}

export const GraphView = ({ onSwitchView }: { onSwitchView: () => void }) => {
  const [selectedTag, setSelectedTag] = useState<TagSelection | null>(null);

  return (
    <>
      <button onClick={onSwitchView}>Back to List</button>
      <Visualization
        onSelectNode={(id, x, y) => setSelectedTag({ id, x, y })}
        onDeselectNode={() => setSelectedTag(null)}
      />
      {selectedTag && (
        <TagOverlay
          id={selectedTag.id}
          initialX={selectedTag.x}
          initialY={selectedTag.y}
        />
      )}
    </>
  );
};
