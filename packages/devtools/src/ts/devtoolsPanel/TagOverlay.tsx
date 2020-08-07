import React, { FC, RefObject, useEffect, useRef, useState } from "react"
import "./TagOverlay.css"
import { connectFactoryObservable } from "react-rxjs"
import { tagInfo$, tagValue$ } from "./messaging"
import { combineLatest } from "rxjs"
import { map } from "rxjs/operators"
import { DebugTag } from "rxjs-traces"

const [useTag] = connectFactoryObservable((id: string) =>
  combineLatest(tagInfo$(id), tagValue$(id)).pipe(
    map(
      ([info, latestValues]): DebugTag => ({
        id: info.id,
        label: info.label,
        latestValues,
        refs: info.refs,
      }),
    ),
  ),
)

export const TagOverlay: FC<{
  id: string
  initialX: number
  initialY: number
  onCopy?: (value: string) => void
}> = ({ id, initialX, initialY, onCopy }) => {
  const tag = useTag(id)
  const ref = useRef<HTMLDivElement | null>(null)
  const drag = useDrag(ref, initialX + 15, initialY)

  const subscriptions = Object.keys(tag.latestValues)

  return (
    <div className="tag-overlay" ref={ref}>
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
  )
}

const ValueInspector: FC<{
  label?: string
  value: any
  level: number
  onCopy?: (value: string) => void
}> = ({ label, value, level, onCopy = () => void 0 }) => {
  const [expanded, setExpanded] = useState(level < 2)
  const expandible =
    typeof value === "object" && Object.keys(value || {}).length > 0

  const renderInline = () => {
    const valueRep = () => {
      if (typeof value === "object") {
        return JSON.stringify(value)
      }
      if (typeof value === "string") {
        return `"${value}"`
      }
      return String(value)
    }

    return (
      <span
        className={
          "value-inspector__value-rep value-inspector__value-rep--" +
          typeof value
        }
      >
        {valueRep()}
      </span>
    )
  }

  const renderExpanded = () => {
    const keys = Object.keys(value)
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
    )
  }

  const expandElement = expandible ? (
    <span
      className="value-inspector__expand-toggle"
      onClick={() => setExpanded((e) => !e)}
    >
      {expanded ? "-" : "+"}
    </span>
  ) : (
    <span className="value-inspector__expand-spacer" />
  )
  const labelElement = <span className="value-inspector__label">{label}:</span>
  const valueElement =
    expanded && expandible ? renderExpanded() : renderInline()

  const showCopy = typeof value === "object" && expandible
  const copyValue = () => {
    const stringified = new WeakSet<object>()
    onCopy(
      JSON.stringify(
        value,
        (_, value) => {
          if (value === undefined) {
            return "Symbol(undefined)"
          }
          if (typeof value === "object" && value !== null) {
            if (stringified.has(value)) {
              return "Symbol(Circular reference)"
            }
            stringified.add(value)
          }
          return value
        },
        2,
      ),
    )
  }

  return (
    <div className="value-inspector">
      {expandElement}
      {label && labelElement}
      {showCopy && (
        <span className="value-inspector__copy" onClick={copyValue}>
          📄
        </span>
      )}
      {valueElement}
    </div>
  )
}

const useDrag = (
  ref: RefObject<HTMLElement>,
  initialX: number,
  initialY: number,
) => {
  const cleanupRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!ref.current) {
      return
    }
    const left = Math.min(
      initialX,
      document.body.clientWidth - ref.current.clientWidth - 15,
    )
    const top = Math.min(
      initialY,
      document.body.clientHeight - ref.current.clientHeight - 15,
    )
    ref.current.style.visibility = "visible"
    ref.current.style.left = left + "px"
    ref.current.style.top = top + "px"
  }, [])

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return (event: React.MouseEvent) => {
    if (!ref.current) {
      return
    }
    if (cleanupRef.current) {
      cleanupRef.current()
    }

    const elementPosition = {
      x: Number.parseFloat(ref.current.style.left),
      y: Number.parseFloat(ref.current.style.top),
    }

    const positionRef = {
      x: elementPosition.x - event.pageX,
      y: elementPosition.y - event.pageY,
    }

    let lastFrameUpdateMouseEvent: MouseEvent | null = null
    const performUpdate = () => {
      if (!ref.current || !lastFrameUpdateMouseEvent) {
        return
      }

      ref.current.style.left =
        positionRef.x + lastFrameUpdateMouseEvent.pageX + "px"
      ref.current.style.top =
        positionRef.y + lastFrameUpdateMouseEvent.pageY + "px"
      lastFrameUpdateMouseEvent = null
    }

    const updatePosition = (event: MouseEvent) => {
      const scheduleRaf = !lastFrameUpdateMouseEvent
      lastFrameUpdateMouseEvent = event

      if (scheduleRaf) {
        requestAnimationFrame(performUpdate)
      }
    }
    const endDrag = (event: MouseEvent) => {
      cleanupRef.current!()
      cleanupRef.current = null
      updatePosition(event)
    }

    window.addEventListener("mousemove", updatePosition)
    window.addEventListener("mouseup", endDrag)
    cleanupRef.current = () => {
      window.removeEventListener("mousemove", updatePosition)
      window.removeEventListener("mouseup", endDrag)
    }
  }
}
