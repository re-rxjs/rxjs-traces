import { bind } from "@react-rxjs/core";
import React, { FC, useEffect, useRef, useState, useContext } from "react";
import { combineLatest } from "rxjs";
import { DebugTag, skip } from "rxjs-traces";
import { map } from "rxjs/operators";
import { CopyContext } from "../../copy";
import { tagValueById$ } from "../../historySlice";
import { serializeJSON } from "../../jsonSerializer";
import { tagDefById$ } from "../../stateProxy";
import "./TagOverlay.css";

const [useTag] = bind(
  (id: string) =>
    combineLatest({
      info: tagDefById$(id),
      latestValues: tagValueById$(id),
    }).pipe(
      skip,
      map(
        ({ info, latestValues }): DebugTag => ({
          id: info.id,
          label: info.label,
          latestValues,
          refs: info.refs,
        })
      )
    ),
  null
);

export const TagOverlay: FC<{
  id: string;
  initialX: number;
  initialY: number;
}> = ({ id, initialX, initialY }) => {
  const onCopy = useContext(CopyContext);
  const tag = useTag(id);
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const drag = useDrag(ref, initialX + 15, initialY);

  if (!tag) {
    return null;
  }

  const subscriptions = Object.keys(tag.latestValues);

  return (
    <div className="tag-overlay" ref={setRef}>
      <div className="tag-overlay__header" onMouseDown={drag}>
        {tag.label}
      </div>
      <div className="tag-overlay__content">
        {subscriptions.map((sub, index) => (
          <div className="tag-overlay__subscription" key={sub}>
            <ValueInspector
              label={
                subscriptions.length > 1
                  ? "subscription " + (index + 1)
                  : undefined
              }
              value={tag.latestValues[sub]}
              level={0}
              onCopy={onCopy}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const ValueInspector: FC<{
  label?: string;
  value: any;
  level: number;
  onCopy?: (value: string) => void;
}> = ({ label, value, level, onCopy = () => void 0 }) => {
  const [expanded, setExpanded] = useState(level < 2);
  const expandible =
    typeof value === "object" && Object.keys(value || {}).length > 0;

  const renderInline = () => {
    const valueRep = () => {
      if (typeof value === "object") {
        return JSON.stringify(value);
      }
      if (typeof value === "string") {
        return `"${value}"`;
      }
      return String(value);
    };

    return (
      <span
        className={
          "value-inspector__value-rep value-inspector__value-rep--" +
          typeof value
        }
      >
        {valueRep()}
      </span>
    );
  };

  const renderExpanded = () => {
    const keys = Object.keys(value);
    return (
      <div className="value-inspector__expanded">
        {keys.map((key) => (
          <ValueInspector
            key={key}
            label={key}
            value={value[key]}
            level={level + 1}
            onCopy={onCopy}
          />
        ))}
      </div>
    );
  };

  const expandElement = expandible ? (
    <span
      className="value-inspector__expand-toggle"
      onClick={() => setExpanded((e) => !e)}
    >
      {expanded ? "-" : "+"}
    </span>
  ) : (
    <span className="value-inspector__expand-spacer" />
  );
  const labelElement = <span className="value-inspector__label">{label}:</span>;
  const valueElement =
    expanded && expandible ? renderExpanded() : renderInline();

  const showCopy = typeof value === "object" && expandible;
  const copyValue = () => onCopy(serializeJSON(value));

  return (
    <div className="value-inspector">
      {expandElement}
      {label && labelElement}
      {showCopy && (
        <span
          className="value-inspector__copy"
          onClick={copyValue}
          role="img"
          aria-label="copy"
        >
          📄
        </span>
      )}
      {valueElement}
    </div>
  );
};

const useDrag = (
  ref: HTMLElement | null,
  initialX: number,
  initialY: number
) => {
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!ref) {
      return;
    }
    const left = Math.min(
      initialX,
      document.body.clientWidth - ref.clientWidth - 15
    );
    const top = Math.min(
      initialY,
      document.body.clientHeight - ref.clientHeight - 15
    );
    ref.style.visibility = "visible";
    ref.style.left = left + "px";
    ref.style.top = top + "px";
  }, [ref]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return (event: React.MouseEvent) => {
    if (!ref) {
      return;
    }
    if (cleanupRef.current) {
      cleanupRef.current();
    }

    const elementPosition = {
      x: Number.parseFloat(ref.style.left),
      y: Number.parseFloat(ref.style.top),
    };

    const positionRef = {
      x: elementPosition.x - event.pageX,
      y: elementPosition.y - event.pageY,
    };

    let lastFrameUpdateMouseEvent: MouseEvent | null = null;
    const performUpdate = () => {
      if (!ref || !lastFrameUpdateMouseEvent) {
        return;
      }

      ref.style.left = positionRef.x + lastFrameUpdateMouseEvent.pageX + "px";
      ref.style.top = positionRef.y + lastFrameUpdateMouseEvent.pageY + "px";
      lastFrameUpdateMouseEvent = null;
    };

    const updatePosition = (event: MouseEvent) => {
      const scheduleRaf = !lastFrameUpdateMouseEvent;
      lastFrameUpdateMouseEvent = event;

      if (scheduleRaf) {
        requestAnimationFrame(performUpdate);
      }
    };
    const endDrag = (event: MouseEvent) => {
      cleanupRef.current!();
      cleanupRef.current = null;
      updatePosition(event);
    };

    window.addEventListener("mousemove", updatePosition);
    window.addEventListener("mouseup", endDrag);
    cleanupRef.current = () => {
      window.removeEventListener("mousemove", updatePosition);
      window.removeEventListener("mouseup", endDrag);
    };
  };
};
