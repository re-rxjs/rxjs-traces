import * as React from "react"
import ReactDOM from "react-dom"
import { DevTools } from "rxjs-traces-devtools"
import "rxjs-traces-devtools/dist/bundle.css"
import { copy$ } from "./messaging"

ReactDOM.render(
  <DevTools onCopy={(value) => copy$.next(value)} />,
  document.getElementById("popup-root"),
)
