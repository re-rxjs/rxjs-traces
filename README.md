# RxJS-Traces

Devtools to visualise the latest values of RxJS streams and the dependencies
between them.

## Features

- Tag-based API.
- Get the latest value for each tag, for each subscription.
- Time traveling (read-only)
- Shows tags in uncaught error traces.
- Integrates with react-rxjs

## Usage

```ts
import { Observable, interval } from "rxjs"
import { scan } from "rxjs/operators"
import { patchObservable, addDebugTag } from "rxjs-traces"

// Hook into Observable
patchObservable(Observable)

const seconds = interval(1000).pipe(addDebugTag("seconds"))

const value = seconds.pipe(
  scan((total, s) => total + s),
  addDebugTag("value"),
)

value.subscribe() // Use them as needed
```

### Visualiser

Either compile + install the DevTools in chrome, or use them as standalone
with:

```tsx
import ReactDOM from "react-dom"
import { DevTools, connectStandalone } from "rxjs-traces-devtools"

connectStandalone()

ReactDOM.render(<DevTools />, htmlElement)
```

Note: It doesn't need to run in a separate ReactDOM tree if you already use
React.

![Demo of visualizer](https://i.imgur.com/OqWj4WO.gif)

### Error stack

When an uncaught exception happens in RxJS, the stack trace provides very
little information on what is the stream that went wrong, as the stack trace
mainly points to internal code of RxJS code.

RxJS-Traces adds the tag name in its internals, so that when there's an error,
the stack trace will show those as some of the function names, making it easier
to follow where the exact error might be happening.

In the following example, after a tag `addDebugTag('interval')` there's a
`switchMap` that sometimes would not return an observable, raising an exception:

![Stack trace](https://user-images.githubusercontent.com/5365487/90341169-9bb0da00-dffd-11ea-9def-49de23f8fe0f.png)

Note that now the stack trace displays `DebugTag(----> interval <----)` as one
of the function names in the stack that raised that exception.

## Development

This package uses yarn workspaces. The inner packages are:

- rxjs-traces: Main package - Hooks into Observable to detect relationships between tags. Pushes events through `window.postMessage`.
- devtools: Visualiser - Can be set up as standalone, hooking up to
  `rxjs-traces` through postMessage, or manually through other means.
- chrome-devtools: Chrome extension that adds the Visualiser to the inspector.
- babel-plugin-react-rxjs: Babel plugin that adds a `addDebugTag` on every
  `bind()`, setting the tag name to that one of the hook returned by bind.
- playground: Example CRA application used to quickly try new features.

### Commands

- yarn start: Builds and watches all packages.
- yarn build: Builds all packages ready for production.

## Disclaimer

This heavily relies on the internals of rxjs v6 - It's an experimental tool
that might not work with some versions of rxjs, even for non-major updates. Use at your own risk.
