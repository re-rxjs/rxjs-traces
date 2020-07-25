import React, { useEffect, useRef, FC } from "react"
import {
  DataSet,
  Network,
  NodeOptions,
  EdgeOptions,
} from "vis-network/standalone"
import type { DebugTag } from "rxjs-traces"
import "./Visualization.css"

interface Node extends NodeOptions {
  id: string
}
interface Edge extends EdgeOptions {
  id: string
  from: string
  to: string
}

const noop = () => void 0
export const Visualization: FC<{
  tags: Record<string, DebugTag>
  onSelectNode?: (id: string, x: number, y: number) => void
  onDeselectNode?: (id: string) => void
}> = ({ tags, onSelectNode = noop, onDeselectNode = noop }) => {
  const container = useRef<HTMLDivElement | null>(null)
  const nodes = useRef<DataSet<Node>>(new DataSet())
  const edges = useRef<DataSet<Edge>>(new DataSet())
  const network = useRef<Network | null>(null)

  const handleSelectEvent = (event: EdgeSelectEvent) => {
    console.log(event)
    onSelectNode(event.nodes[0], event.pointer.DOM.x, event.pointer.DOM.y)
  }
  const handleDeselectEvent = (event: EdgeDeselectEvent) => {
    console.log(event)
    onDeselectNode(event.previousSelection.nodes[0])
  }

  useEffect(() => {
    const { height } = container.current!.getBoundingClientRect()

    network.current = new Network(
      container.current!,
      {
        nodes: nodes.current,
        edges: edges.current,
      },
      {
        height: height + "px",
      },
    )
  }, [])

  useEffect(() => {
    if (!network.current) {
      return
    }
    network.current.on("selectNode", handleSelectEvent)
    network.current.on("deselectNode", handleDeselectEvent)
    return () => {
      network.current!.off("selectNode", handleSelectEvent)
      network.current!.off("deselectNode", handleDeselectEvent)
    }
  }, [handleSelectEvent, handleDeselectEvent])

  useEffect(() => {
    const currentNodeIds = nodes.current.getIds()
    const allTags = Object.values(tags)
    const nodeUpdates: Node[] = []
    const newNodes: Node[] = []
    const nodesToRemove: string[] = []
    allTags.forEach(tag => {
      const activeSubscriptions = Object.keys(tag.latestValues).length

      const node: Node = {
        id: tag.id,
        label: tag.label,
        color: activeSubscriptions === 0 ? "#cadffc" : "#97c2fc",
      }
      if (currentNodeIds.includes(tag.id)) {
        nodeUpdates.push(node)
      } else {
        newNodes.push(node)
      }
    })
    nodes.current.forEach(({ id }) => {
      if (!allTags.some(tag => tag.id === id)) {
        nodesToRemove.push(id)
      }
    })
    if (nodeUpdates.length) nodes.current.update(nodeUpdates)
    if (newNodes.length) nodes.current.add(newNodes)
    if (nodesToRemove.length) nodes.current.remove(nodesToRemove)

    const edgeIds = edges.current.getIds()
    const newEdges: Edge[] = []
    const edgesToRemove = new Set<string>()
    allTags.forEach(tag => {
      const refs = Array.from(tag.refs)
      refs.forEach(ref => {
        const edge: Edge = {
          id: tag.id + "->" + ref,
          from: tag.id,
          to: ref,
          arrows: "from",
        }
        if (!edgeIds.includes(edge.id)) {
          newEdges.push(edge)
        }
      })
    })
    nodesToRemove.forEach(id => {
      edges.current.forEach(edge => {
        if (edge.from === id || edge.to === id) {
          edgesToRemove.add(id)
        }
      })
    })
    if (newEdges.length) edges.current.add(newEdges)
    if (edgesToRemove.size) edges.current.remove(Array.from(edgesToRemove))
  })

  return (
    <div ref={container} className="visualization">
      Container
    </div>
  )
}

interface EdgeSelectEvent {
  edges: string[]
  event: {
    center: { x: number; y: number }
  }
  nodes: string[]
  pointer: {
    DOM: { x: number; y: number }
    canvas: { x: number; y: number }
  }
}
interface EdgeDeselectEvent extends EdgeSelectEvent {
  previousSelection: {
    edges: string[]
    nodes: string[]
  }
}
