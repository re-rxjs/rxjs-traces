import { bind, shareLatest } from "@react-rxjs/core";
import { combineKeys, createSignal } from "@react-rxjs/utils";
import React, { useContext } from "react";
import { animationFrames, combineLatest, merge, ReplaySubject } from "rxjs";
import { skip as skipTraces } from "rxjs-traces";
import {
  distinctUntilChanged,
  map,
  scan,
  share,
  skip,
  startWith,
  switchMap,
  take,
} from "rxjs/operators";
import { filter$ } from "../../components";
import { CopyContext } from "../../copy";
import { tagValueById$ } from "../../historySlice";
import { serializeJSON } from "../../jsonSerializer";
import { tagDefById$, tagId$ } from "../../stateProxy";
import "./ListView.css";
import graph from "./graph_16.png";

const tagGroups$ = combineLatest({
  filter: filter$,
  tags: combineKeys(
    tagId$,
    (id) => tagDefById$(id).pipe(take(1)) // We only care about id + label, which don't change
  ).pipe(
    skipTraces,
    map((map) => Array.from(map.values()))
  ),
}).pipe(
  skipTraces,
  map(({ filter, tags }) =>
    filter
      ? tags.filter((tag) =>
          tag.label.toLocaleLowerCase().includes(filter.toLocaleLowerCase())
        )
      : tags
  ),
  distinctUntilChanged(
    (previous, current) =>
      previous.length === current.length &&
      previous.every((v, i) => current[i].id === v.id)
  ),
  map((tags) => {
    // group name -> id[]
    const groups: Record<string, string[]> = {};
    tags.forEach((tag) => {
      groups[tag.label] = groups[tag.label] || [];
      groups[tag.label].push(tag.id);
    });
    return groups;
  }),
  shareLatest()
);

const [useTagGroupKeys] = bind(
  tagGroups$.pipe(map((groups) => Object.keys(groups).sort())),
  []
);

export const ListView = ({ onSwitchView }: { onSwitchView: () => void }) => {
  const labels = useTagGroupKeys();

  return (
    <>
      <button className="graphAll" onClick={onSwitchView}>
        <img src={graph} alt="graph" />
        Graph all nodes
      </button>
      <ul className="listView">
        {labels.map((label) => (
          <TagLabel key={label} label={label} />
        ))}
      </ul>
    </>
  );
};

const [useTagGroup, tagGroup$] = bind(
  (label: string) => tagGroups$.pipe(map((groups) => groups[label])),
  null
);
const [useTagGroupHighlight] = bind(
  (label: string) =>
    tagGroup$(label).pipe(
      switchMap((ids) =>
        ids
          ? merge(...ids?.map((id) => tagValueById$(id).pipe(skip(1)))).pipe(
              skipTraces,
              switchMap(() =>
                animationFrames().pipe(
                  skipTraces,
                  scan((v) => !v, false), // Will emit true-false-true-false...
                  take(2) // We only keep one cycle of true-false
                )
              )
            )
          : [false]
      )
    ),
  false
);

const [labelClick$, onLabelClick] = createSignal<string>();
const selectedSignal$ = labelClick$.pipe(
  scan(
    (acc: string | null, selected) => (acc === selected ? null : selected),
    null
  ),
  startWith(null),
  share({
    connector: () => skipTraces(new ReplaySubject(1)),
    resetOnRefCountZero: false,
  })
);
const [useIsExpanded] = bind(
  (label: string) =>
    selectedSignal$.pipe(map((selected) => label === selected)),
  false
);

const TagLabel = ({ label }: { label: string }) => {
  const group = useTagGroup(label);
  const highlight = useTagGroupHighlight(label);
  const isExpanded = useIsExpanded(label);

  if (!group) {
    return null;
  }

  const expandedContent = isExpanded ? (
    <ul className="TagExpandedContent">
      {group.map((id) => (
        <TagDetail key={id} id={id} />
      ))}
    </ul>
  ) : null;

  return (
    <li className="TagLabel">
      <button
        type="button"
        className={`TagLabel_title ${
          highlight ? "TagLabel_title--highlight" : ""
        }`}
        onClick={() => onLabelClick(label)}
      >
        {label}
        <div className="badge">{group.length}</div>
      </button>
      {expandedContent}
    </li>
  );
};

const [useTagValues] = bind(tagValueById$, null);

const TagDetail = ({ id }: { id: string }) => {
  const values = useTagValues(id);
  const copy = useContext(CopyContext);

  if (!values) return null;

  const sids = Object.keys(values);

  return (
    <li className="TagDetail">
      <div>{id}</div>
      {sids.map((sid) => (
        <div key={sid} className="TagDetail_value">
          <textarea
            value={serializeJSON(values[sid])}
            readOnly
            rows={5}
          ></textarea>
          <button onClick={() => copy(serializeJSON(values[sid]))}>📄</button>
        </div>
      ))}
    </li>
  );
};
