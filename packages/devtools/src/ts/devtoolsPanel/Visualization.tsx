import React, { useEffect, useRef, FC } from "react";
import { DataSet, Network } from "vis-network/standalone";
import type { DebugTag } from "rxjs-traces";

interface Node {
  id: string;
  label: string;
}
interface Edge {
  id: string;
  from: string;
  to: string;
  arrows: string;
}
export const Visualization: FC<{
  tags: Record<string, DebugTag>;
}> = ({ tags }) => {
  const container = useRef<HTMLDivElement | null>(null);
  const nodes = useRef<DataSet<Node>>(new DataSet());
  const edges = useRef<DataSet<Edge>>(new DataSet());
  const network = useRef<Network | null>(null);

  useEffect(() => {
    const {
      height
    } = container.current!.getBoundingClientRect();

    network.current = new Network(
      container.current!,
      {
        nodes: nodes.current,
        edges: edges.current,
      },
      {
        height: height + 'px',
      }
    );
  }, []);

  useEffect(() => {
    const currentNodeIds = nodes.current.getIds();
    const allTags = Object.values(tags);
    const nodeUpdates: Node[] = [];
    const newNodes: Node[] = [];
    allTags.forEach((tag) => {
      const node: Node = {
        id: tag.id,
        label: `${tag.label} (${formatValue(tag.latestValue)})`,
      };
      if (currentNodeIds.includes(tag.id)) {
        nodeUpdates.push(node);
      } else {
        newNodes.push(node);
      }
    });
    if (nodeUpdates.length) nodes.current.update(nodeUpdates);
    if (newNodes.length) nodes.current.add(newNodes);

    const edgeIds = edges.current.getIds();
    const newEdges: Edge[] = [];
    allTags.forEach((tag) => {
      const refs = Array.from(tag.refs);
      refs.forEach((ref) => {
        const edge: Edge = {
          id: tag.id + "->" + ref,
          from: tag.id,
          to: ref,
          arrows: "from",
        };
        if (!edgeIds.includes(edge.id)) {
          newEdges.push(edge);
        }
      });
    });
    if (newEdges.length) edges.current.add(newEdges);
  });

  return <div ref={container}>
    Container
  </div>;
};

const formatValue = (value: any) => {
  const valueStr = JSON.stringify(value);
  if(!valueStr) {
    return valueStr;
  }
  if(valueStr.length > 13) {
    return valueStr.slice(0, 10) + '...'
  }
  return valueStr;
}
