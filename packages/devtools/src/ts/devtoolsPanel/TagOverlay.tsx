import React, { FC, RefObject, useEffect, useRef, useState } from "react"
import { DebugTag } from "rxjs-traces"
import "./TagOverlay.css"

export const TagOverlay: FC<{
  tag: DebugTag
  initialX: number
  initialY: number
}> = ({ tag, initialX, initialY }) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const drag = useDrag(ref, initialX, initialY)

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
              label={"subscription " + (index + 1)}
              value={tag.latestValues[sub]}
              level={0}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const ValueInspector: FC<{
  label: string
  value: any
  level: number
}> = ({ label, value, level }) => {
  const [expanded, setExpanded] = useState(level < 2)
  const expandible = typeof value === "object" && value !== null

  const valueRep = () => {
    if (typeof value === "object") {
      return JSON.stringify(value)
    }
    if (typeof value === "string") {
      return `"${value}"`
    }
    return String(value)
  }

  const renderExpanded = () => {
    const keys = Object.keys(value)
    return (
      <div className="value-inspector__expanded">
        {keys.map(key => (
          <ValueInspector
            key={key}
            label={key}
            value={value[key]}
            level={level + 1}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="value-inspector">
      {level > 0 &&
        (expandible ? (
          <span
            className="value-inspector__expand-toggle"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? "-" : "+"}
          </span>
        ) : (
          <span className="value-inspector__expand-spacer" />
        ))}
      <span className="value-inspector__label">{label}:</span>
      {(!expanded || !expandible) && (
        <span
          className={
            "value-inspector__value-rep value-inspector__value-rep--" +
            typeof value
          }
        >
          {valueRep()}
        </span>
      )}
      {expanded && expandible && renderExpanded()}
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

      console.log(lastFrameUpdateMouseEvent)
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
