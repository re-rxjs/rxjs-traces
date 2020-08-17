import { BehaviorSubject, Subject } from "rxjs"
import { combineLatest, debounceTime, filter, map, share } from "rxjs/operators"
import { DataSet, EdgeOptions, NodeOptions } from "vis-network/standalone"
import { incrementalHistory$ } from "./messaging"

export const filter$ = new BehaviorSubject("")

const sharedIncrementalHistory$ = incrementalHistory$.pipe(share())

export const nodes = new DataSet<Node>()
export interface Node extends NodeOptions {
  id: string
}

const nodeColors = {
  default: "#fc9797",
  filterMiss: "#97c2fc",
  highlight: "#ffb347",
}

const activeNodeWatches = new Set<string>()
const createNodeWatch = (id: string, label: string) => {
  if (activeNodeWatches.has(id)) {
    return
  }
  activeNodeWatches.add(id)

  const nodeChange$ = new Subject<Node | null>()

  const activeSubscriptions = new Set<string>()
  let isActive = false
  const historySubscription = sharedIncrementalHistory$
    .pipe(combineLatest(filter$))
    .subscribe(([action, filter]) => {
      if (action.type === "reset") {
        nodeChange$.next(null)
        activeSubscriptions.clear()
        isActive = false
        return
      }

      const historyAction = action.payload
      const filterHit =
        filter && label.toLocaleLowerCase().includes(filter.toLocaleLowerCase())
      const targetColor =
        historyAction.type == "tagValueChange$" &&
        historyAction.payload.id === id
          ? nodeColors.highlight
          : filterHit
          ? nodeColors.default
          : nodeColors.filterMiss

      if (historyAction.payload.id === id) {
        switch (historyAction.type) {
          case "tagValueChange$":
          case "tagSubscription$":
            activeSubscriptions.add(historyAction.payload.sid)
            break
          case "tagUnsubscription$":
            activeSubscriptions.delete(historyAction.payload.sid)
        }
      }
      if (
        historyAction.payload.id === id ||
        (historyAction.type === "tagRefDetection$" &&
          historyAction.payload.ref === id)
      ) {
        isActive = true
      }

      if (isActive) {
        nodeChange$.next({
          id,
          label,
          color: targetColor,
          opacity: activeSubscriptions.size === 0 ? 0.5 : 1,
        })
      }
    })

  const changeSubscription = nodeChange$
    .pipe(debounceTime(0))
    .subscribe((node) => {
      const nodeExists = nodes.get(id)
      if (!node) {
        if (nodeExists) {
          nodes.remove(id)
        }
        historySubscription.unsubscribe()
        changeSubscription.unsubscribe()
        activeNodeWatches.delete(id)
        return
      }

      if (activeSubscriptions.size > 0) {
        if (!nodeExists) {
          nodes.add(node)
        } else {
          nodes.update(node)
        }
      } else if (nodeExists) {
        nodes.remove(id)
      }
    })
}

sharedIncrementalHistory$
  .pipe(
    filter((action) => action.type === "incremental"),
    map((action) => (action.type === "reset" ? null! : action.payload)),
    filter(({ type }) => type === "newTag$"),
  )
  .subscribe((newTag) => {
    if (newTag.type !== "newTag$") {
      return
    }
    createNodeWatch(newTag.payload.id, newTag.payload.label)
  })

const edgeQtyChanges = sharedIncrementalHistory$.pipe(
  filter((action) => {
    if (action.type === "reset") {
      return true
    }
    const { type } = action.payload
    const interestingTypes: typeof type[] = ["tagRefDetection$"]
    return interestingTypes.includes(type)
  }),
  map((action) => {
    if (action.type === "reset" || action.payload.type !== "tagRefDetection$") {
      return {
        type: "remove-all" as const,
      }
    }
    return {
      type: "add" as const,
      from: action.payload.payload.id,
      to: action.payload.payload.ref,
    }
  }),
)

export interface Edge extends EdgeOptions {
  id: string
  from: string
  to: string
}
export const edges = new DataSet<Edge>()

edgeQtyChanges.subscribe((action) => {
  switch (action.type) {
    case "add":
      const { from, to } = action
      edges.add({
        id: `${from}->${to}`,
        from,
        to,
        arrows: "from",
      })
      return
    case "remove-all":
      edges.clear()
      return
  }
})
