import { BehaviorSubject, combineLatest as cL, from, timer } from "rxjs"
import {
  combineLatest,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  mapTo,
  share,
  startWith,
  switchMapTo,
  take,
  takeUntil,
} from "rxjs/operators"
import { DataSet, EdgeOptions, NodeOptions } from "vis-network/standalone"
import { incrementalHistory$, tagState$ } from "../messaging"
import { skipResetBursts } from "../operators/incremental"
import { scanMap } from "../operators/scanMap"

export const filter$ = new BehaviorSubject("")

const sharedIncrementalHistory$ = incrementalHistory$.pipe(share())

export const nodes = new DataSet<Node>()
export interface Node extends NodeOptions {
  id: string
}

const nodeColors = {
  filterHit: "#fc9797",
  default: "#97c2fc",
  highlight: "#ffb347",
}

/**
 * Can't alpha-blend with vis-network afaik.
 * Used https://meyerweb.com/eric/tools/color-blend/#97C2FC:FFB347:10:hex to
 * generate this sequence.
 */
const highlightSequence = [
  "#FFB347",
  "#F6B457",
  "#ECB668",
  "#E3B778",
  "#D9B889",
  "#D0BA99",
  "#C6BBAA",
  "#BDBDBA",
  "#B3BECB",
  "#AABFDB",
  "#A0C1EC",
  "#97C2FC",
]
const highlightSequence$ = from(highlightSequence).pipe(
  concatMap((v) => timer(500 / highlightSequence.length).pipe(mapTo(v))),
)

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

  const highlight$ = sharedIncrementalHistory$.pipe(
    takeUntil(tagRemoved$),
    skipResetBursts(),
    filter(
      (action) => action.type === "tagValueChange$" && action.payload.id === id,
    ),
    switchMapTo(highlightSequence$),
  )

  const filterHit$ = filter$.pipe(
    takeUntil(tagRemoved$),
    map(
      (filter) =>
        Boolean(filter) &&
        label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
    ),
  )

  // If filterHit = true, color = filterHit. Otherwise, default color / flashing
  const color$ = cL(filterHit$, highlight$).pipe(
    map(([filter, highlight$]) => {
      if (filter) {
        return nodeColors.filterHit
      }
      return highlight$
    }),
    startWith(nodeColors.default),
  )

  const nodeChange$ = sharedIncrementalHistory$.pipe(
    takeUntil(tagRemoved$),
    combineLatest(color$),
    scanMap((activeSubscriptions, [action, targetColor]) => {
      if (action.type === "reset") {
        activeSubscriptions.clear()
        return [activeSubscriptions, null]
      }

      const historyAction = action.payload

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
  Object.values(tags).forEach((tag: any) => {
    const from = tag.id
    tag.refs.forEach((to: any) => {
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
