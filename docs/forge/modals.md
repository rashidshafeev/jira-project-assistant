# Modals — MUI `<Dialog>` vs the native Forge `Modal`

There are **two different things both called "modal"** in a Custom UI Forge app, with very
different costs. Picking the wrong one is the source of both the "the dialog looks cramped in
the issue panel" symptom and the "wait, why would a modal need a whole second bootstrap?"
confusion.

## The two kinds

### MUI `<Dialog>` — plain DOM inside our existing iframe (what we use)
- Renders as ordinary DOM in the **same** iframe the app already runs in.
- **No second bootstrap.** It shares the live React tree and the **same QueryClient cache** —
  so data the opener already loaded (the assignee list, the issue) is right there; the dialog
  opens **instantly** with no refetch.
- **Its only limit:** it's `position: fixed` *within the iframe's box* and can't paint outside
  it. On the **global page** (a big iframe) that's invisible — the dialog overlays the page
  fine. In the **`jira:issueContext` panel** (a tiny, auto-resizing sidebar iframe) there's no
  room to be modal: the backdrop dims only the little panel and the paper is cramped/clipped.
  See [`custom-ui.md`](./custom-ui.md) for why the panel iframe is small (no `viewportSize`,
  auto-resizes to content).

### Native Forge `Modal` (`@forge/bridge`) — a Jira-hosted overlay in a new iframe
Not a React component — an imperative bridge API:

```ts
import { Modal } from '@forge/bridge'

const modal = new Modal({
  resource: 'main',                 // which Custom UI resource Jira loads in the modal
  size: 'medium',                   // 'small' | 'medium' | 'large' | 'max'
  context: { issueKey: 'ABC-1' },   // serializable data handed to the modal iframe
  onClose: (payload) => {           // fires when the modal closes; gets whatever it returned
    queryClient.invalidateQueries({ queryKey: ['issue', payload.issueKey] })
  },
})
modal.open()
```

Inside the modal (a **separate** render of our app) you read the passed data via
`view.getContext()` and dismiss with `view.close(payload)` (from `@forge/bridge`), which
triggers the opener's `onClose`.

**Why it looks right from a tiny panel:** Jira renders the modal chrome **on the host page,
outside our iframe**. Our sandboxed sidebar iframe physically cannot paint over the rest of
Jira; Jira *itself* can — so you get a real, centered, full-product overlay with a proper
backdrop. A MUI Dialog can never escape the iframe's box; this can.

## What the native `Modal` actually costs

The native modal is **a second iframe = a cold second bootstrap of our app.** This is
**intrinsic to it being a separate iframe** (a separate JS realm), not a mistake in how we
wire it. Concretely, opening one means:

- A fresh React tree and a **fresh QueryClient with an empty cache** — the assignee list and
  issue data the opener already has are **not** there; the modal refetches them. (You could
  persist + rehydrate the cache to fake sharing, but that's *more* machinery, not less — and
  still not the same in-memory cache.)
- A new theme `MutationObserver`, new i18n init, new entry-context resolution — all the
  bootstrap work runs again, so it opens with a perceptible **cold-start lag** vs. an instant
  in-iframe Dialog.
- Data **crosses the boundary twice** and must be serializable: opener → modal via `context`,
  modal → opener via `view.close(payload)`. The modal can't touch the opener's cache, so the
  opener invalidates queries off the returned payload.
- A new **"modal" entry mode** in `entry-context.ts` to recognize "I'm mounted inside a modal"
  and route to the right form, plus threading the issue key through `context`. (See
  [`surfaces.md`](./surfaces.md) for how the existing `page`/`panel`/`admin` modes are routed.)

**These costs belong to the native `Modal` specifically — our MUI `<Dialog>` pays none of
them.** So the list above is an argument *against* reaching for the native modal for a small
flow, not a description of something wrong with our current dialogs.

## Which to use where

| Surface | Flow size | Best tool |
| --- | --- | --- |
| Global page (big iframe) | any | **MUI `<Dialog>`** — cache-sharing, instant, no extra bootstrap |
| Issue context (tiny iframe) | small (our Fix: a select + two buttons) | **inline form** (e.g. a `<Collapse>` in the panel) |
| Issue context (tiny iframe) | large / multi-step | native `Modal` — the one place its cost pays off |

**Do not migrate all modals to the native `Modal`.** On the global page it would be a pure
regression (cold start, lost cache, double serialization, more code) to fix a problem the big
iframe doesn't have. Native `Modal` earns its complexity only for a **large flow launched from
a surface too small to host an overlay** — which our two-control Fix is not. The current
direction: keep MUI `<Dialog>` on the page, render the Fix UI **inline** in the issue panel
(extract a shared `FixIssueForm` so both reuse one source of truth), and keep the native
`Modal` in reserve for a future big-flow-from-small-surface case.
Ref: <https://developer.atlassian.com/platform/forge/custom-ui-bridge/modal/>
