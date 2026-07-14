# Completed Toggle, Starter Todos, and Native Scrolling Design

## Goals

- Replace the three-way filter bar with one app-bar control that shows or hides completed todos.
- Seed a fresh installation with three instructional todos.
- Preserve an explicitly stored empty timeline instead of reseeding it.
- Make the main timeline and day selector scroll reliably on native Lynx when their content overflows.

## App-bar control

The secondary filter bar and its `all / active / done` state are removed. The app bar keeps the BusyWeek logo on the left and adds a compact `显示已完成` switch on the right.

The switch is off at launch and is session-only:

- Off: show pending todos only.
- On: show both pending and completed todos.

Completed todos keep their current checked and struck-through presentation. When completed todos are hidden and every stored todo is complete, the empty state explains that all pending work is complete and points to the switch. Otherwise the existing empty state remains.

## Fresh-start data

Persistence loading must distinguish two states that are currently both represented by `{}`:

- No stored value: return `null` and create starter data.
- A stored value, including `{}`: return that value unchanged.

The starter timeline contains three pending todos for the current date:

1. `打开右上角查看已完成`
2. `点击文字编辑事项`
3. `点击圆圈完成事项`

The generated ids are deterministic starter-only ids, the date is supplied by the caller, and `dayType` is `0`. On Web, the first load seeds and persists these todos; later loads use localStorage. A stored `{}` remains empty. On a native host without persistent storage, a new process is a fresh start and receives the starter data again, while deletes remain respected for the lifetime of the in-memory store.

Malformed stored JSON is treated as missing data so the application can recover by replacing it with valid starter data.

## Native scroll structure

Lynx documents that direct children of `<scroll-view>` support only linear/sticky layout and recommends a single child wrapper for complex content. Both broken surfaces currently violate that constraint.

- Main timeline: add one `.timeline-content` direct child using linear column layout; keep all empty state, transition groups, and spacer inside it. Give `.timeline` a bounded flex box with `height: 0; flex: 1` so content can overflow the viewport.
- Day selector: add one `.dp-content` direct child using linear column layout inside the already fixed-height `.dp-list`.

This keeps the existing vertical `scroll-orientation`, row sizes, transitions, and Web layout unchanged.

## Testing

- Unit-test starter todo content, date, pending state, and fresh object creation.
- Unit-test persistence distinction between a missing key and a stored `{}`.
- Unit-test pending-only versus show-completed timeline projection.
- Add structural regression tests for the app-bar toggle and single-child linear scroll wrappers.
- Run TypeScript checks and both Lynx/Web production builds.
- Browser-test the switch, fresh-start persistence, stored-empty behavior, long timeline scrolling, and day selector scrolling. Native-specific structure is verified against Lynx's documented scroll-view constraints; final physical-device confirmation remains the decisive native check.
