import { combineKeys, partitionByKey } from "@react-rxjs/utils"
import { tagValueById$ } from "historySlice"
import { BehaviorSubject, combineLatest, EMPTY, from, timer } from "rxjs"
import {
  catchError,
  concatMap,
  filter,
  map,
  mapTo,
  mergeAll,
  pairwise,
  startWith,
  switchMap,
  switchMapTo,
  take,
  takeUntil,
  tap,
} from "rxjs/operators"
import { DataSet, EdgeOptions, NodeOptions } from "vis-network/standalone"
import { mergeKeys } from "../operators/mergeKeys"
import { tagDefById$, tagId$ } from "../stateProxy"

export const filter$ = new BehaviorSubject("")

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

const getVizNodeState = (id: string, label: string) => {
  const highlight$ = tagValueById$(id).pipe(switchMapTo(highlightSequence$))

  const suspenseHit$ = tagValueById$(id).pipe(
    map((value) => Object.values(value).includes("Symbol(SUSPENSE)")),
  )

  const filterHit$ = filter$.pipe(
    map(
      (filter) =>
        Boolean(filter) &&
        label.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
    ),
  )

  // If filterHit or suspenseHit = true, color = filterHit. Otherwise, default color / flashing
  const color$ = combineLatest({
    filter: filterHit$,
    suspense: suspenseHit$,
    highlight: highlight$,
  }).pipe(
    map(({ filter, suspense, highlight }) => {
      if (filter || suspense) {
        return nodeColors.filterHit
      }
      return highlight
    }),
    startWith(nodeColors.default),
  )

  const opacity$ = tagValueById$(id).pipe(
    startWith(null),
    pairwise(),
    map(([oldValue, newValue]) => {
      const hadSubscriptions = oldValue
        ? Object.keys(oldValue.subscriptions).length > 0
        : false
      const activeSubscriptions = Object.keys(newValue!.subscriptions)
      const hasSubscriptions = activeSubscriptions.length > 0

      return hasSubscriptions ? 1 : hadSubscriptions ? 0.5 : 0
    }),
  )

  return combineLatest({
    opacity: opacity$,
    color: color$,
  }).pipe(
    map(({ opacity, color }) =>
      opacity === 0
        ? null
        : {
            id,
            label,
            color,
            opacity,
          },
    ),
  )
}

const [vizNodeStateById$, vizNodesIds$] = partitionByKey(
  tagId$.pipe(mergeAll()),
  (id) => id,
  (_, id) =>
    tagDefById$(id).pipe(
      take(1),
      switchMap((tagDef) => getVizNodeState(tagDef.id, tagDef.label)),
      takeUntil(tagId$.pipe(filter((v) => !v.includes(id)))),
    ),
)

combineKeys(vizNodesIds$, (id) =>
  vizNodeStateById$(id).pipe(
    tap({
      next: (node) => {
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
      },
      complete: () => {
        nodes.remove(id)
      },
    }),
    catchError((ex) => {
      console.error(ex)
      return EMPTY
    }),
  ),
).subscribe()

export interface Edge extends EdgeOptions {
  id: string
  from: string
  to: string
}
export const edges = new DataSet<Edge>()

mergeKeys(tagId$, (id) =>
  tagDefById$(id).pipe(map((def) => def.refs.map((to) => ({ from: id, to })))),
).subscribe((refs) => {
  const existingIds = edges.getIds()

  refs.forEach(({ from, to }) => {
    const id = `${from}->${to}`
    if (existingIds.includes(id)) return
    edges.add({
      id: `${from}->${to}`,
      from,
      to,
      arrows: "to",
    })
  })
})
