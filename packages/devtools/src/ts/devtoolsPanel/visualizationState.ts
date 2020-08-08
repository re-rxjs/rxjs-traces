import { BehaviorSubject } from "rxjs"
import {
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  share,
  take,
  takeUntil,
} from "rxjs/operators"
import { DataSet, EdgeOptions, NodeOptions } from "vis-network/standalone"
import { incrementalHistory$, tagState$ } from "./messaging"
import { scanMap } from "./operators/scanMap"

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

  const tagRemoved$ = tagState$.pipe(
    filter((v) => !(id in v)),
    take(1),
  )

  const nodeChange$ = sharedIncrementalHistory$.pipe(
    takeUntil(tagRemoved$),
    combineLatest(filter$),
    scanMap((activeSubscriptions, [action, filter]) => {
      if (action.type === "reset") {
        activeSubscriptions.clear()
        return [activeSubscriptions, null]
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

      const actionIsTarget = historyAction.payload.id === id
      const hadSubscriptions = activeSubscriptions.size > 0

      if (actionIsTarget) {
        switch (historyAction.type) {
          case "tagValueChange$":
          case "tagSubscription$":
            activeSubscriptions.add(historyAction.payload.sid)
            break
          case "tagUnsubscription$":
            activeSubscriptions.delete(historyAction.payload.sid)
            break
        }
      }

      const hasSubscriptions = activeSubscriptions.size > 0

      if (hasSubscriptions || hadSubscriptions) {
        return [
          activeSubscriptions,
          {
            id,
            label,
            color: targetColor,
            opacity: activeSubscriptions.size === 0 ? 0.5 : 1,
          },
        ]
      } else {
        return [activeSubscriptions, null]
      }
    }, new Set<string>()),
  )

  nodeChange$
    .pipe(
      takeUntil(tagRemoved$),
      debounceTime(0),
      distinctUntilChanged(),
      finalize(() => {
        nodes.remove(id)
        activeNodeWatches.delete(id)
      }),
    )
    .subscribe((node) => {
      const nodeExists = nodes.get(id)
      if (!node) {
        if (nodeExists) {
          nodes.remove(id)
        }
        return
      }

      if (!nodeExists) {
        nodes.add(node)
      } else {
        nodes.update(node)
      }
    })
}

tagState$.subscribe((tags) => {
  const tagKeys = Object.keys(tags)
  tagKeys.forEach((id) => {
    if (activeNodeWatches.has(id)) return
    createNodeWatch(id, tags[id].label)
  })
})

export interface Edge extends EdgeOptions {
  id: string
  from: string
  to: string
}
export const edges = new DataSet<Edge>()

tagState$.subscribe((tags) => {
  if (Object.keys(tags).length <= 1) {
    edges.clear()
  }

  const existingIds = edges.getIds()
  Object.values(tags).forEach((tag) => {
    const from = tag.id
    tag.refs.forEach((to) => {
      const id = `${from}->${to}`
      if (existingIds.includes(id)) return
      edges.add({
        id: `${from}->${to}`,
        from,
        to,
        arrows: "from",
      })
    })
  })
})
