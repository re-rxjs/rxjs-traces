import React, { FC, useEffect, useRef } from "react";
import { Network } from "vis-network/standalone";
import "./Visualization.css";
import { edges, nodes } from "./visualizationState";

const noop = () => void 0;
export const Visualization: FC<{
  onSelectNode?: (id: string, x: number, y: number) => void;
  onDeselectNode?: (id: string) => void;
}> = ({ onSelectNode = noop, onDeselectNode = noop }) => {
  const container = useRef<HTMLDivElement | null>(null);
  const network = useRef<Network | null>(null);

  useEffect(() => {
    const { height } = container.current!.getBoundingClientRect();

    network.current = new Network(
      container.current!,
      {
        nodes,
        edges,
      },
      {
        height: height + "px",
      }
    );
  }, []);

  useEffect(() => {
    if (!network.current) {
      return;
    }
    const handleSelectEvent = (event: EdgeSelectEvent) => {
      onSelectNode(event.nodes[0], event.pointer.DOM.x, event.pointer.DOM.y);
    };
    const handleDeselectEvent = (event: EdgeDeselectEvent) => {
      onDeselectNode(event.previousSelection.nodes[0]);
    };

    network.current.on("selectNode", handleSelectEvent);
    network.current.on("deselectNode", handleDeselectEvent);
    return () => {
      network.current!.off("selectNode", handleSelectEvent);
      network.current!.off("deselectNode", handleDeselectEvent);
    };
  }, [onSelectNode, onDeselectNode]);

  return <div ref={container} className="visualization"></div>;
};

interface EdgeSelectEvent {
  edges: string[];
  event: {
    center: { x: number; y: number };
  };
  nodes: string[];
  pointer: {
    DOM: { x: number; y: number };
    canvas: { x: number; y: number };
  };
}
interface EdgeDeselectEvent extends EdgeSelectEvent {
  previousSelection: {
    edges: string[];
    nodes: string[];
  };
}
