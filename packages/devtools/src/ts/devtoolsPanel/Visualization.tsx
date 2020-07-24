import React, { useEffect, useRef, FC } from "react"
import { DataSet, Network } from "vis-network/standalone"
import type { DebugTag } from "rxjs-traces"

interface Node {
  id: string
  label: string
}
interface Edge {
  id: string
  from: string
  to: string
  arrows: string
}
export const Visualization: FC<{
  tags: Record<string, DebugTag>
}> = ({ tags }) => {
  const container = useRef<HTMLDivElement | null>(null)
  const nodes = useRef<DataSet<Node>>(new DataSet())
  const edges = useRef<DataSet<Edge>>(new DataSet())
  const network = useRef<Network | null>(null)

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
    const currentNodeIds = nodes.current.getIds()
    const allTags = Object.values(tags)
    const nodeUpdates: Node[] = []
    const newNodes: Node[] = []
    const nodesToRemove: string[] = []
    allTags.forEach((tag) => {
      if (Object.keys(tag.latestValues).length < 0) {
        nodesToRemove.push(tag.id)
        return
      }
      const node: Node = {
        id: tag.id,
        label: `${tag.label} (${formatValue(tag.latestValues)})`,
      }
      if (currentNodeIds.includes(tag.id)) {
        nodeUpdates.push(node)
      } else {
        newNodes.push(node)
      }
    })
    nodes.current.forEach(({ id }) => {
      if (!allTags.some((tag) => tag.id === id)) {
        nodesToRemove.push(id)
      }
    })
    if (nodeUpdates.length) nodes.current.update(nodeUpdates)
    if (newNodes.length) nodes.current.add(newNodes)
    if (nodesToRemove.length) nodes.current.remove(nodesToRemove)

    const edgeIds = edges.current.getIds()
    const newEdges: Edge[] = []
    const edgesToRemove = new Set<string>()
    allTags.forEach((tag) => {
      const refs = Array.from(tag.refs)
      refs.forEach((ref) => {
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
    nodesToRemove.forEach((id) => {
      edges.current.forEach((edge) => {
        if (edge.from === id || edge.to === id) {
          edgesToRemove.add(id)
        }
      })
    })
    if (newEdges.length) edges.current.add(newEdges)
    if (edgesToRemove.size) edges.current.remove(Array.from(edgesToRemove))
  })

  return <div ref={container}>Container</div>
}

const formatValue = (value: Record<string, any>) => {
  const valueStr = JSON.stringify(Object.values(value))
  if (!valueStr) {
    return valueStr
  }
  if (valueStr.length > 18) {
    return valueStr.slice(0, 15) + "..."
  }
  return valueStr
}
