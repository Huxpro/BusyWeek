# Header Menu and Clear-Style Timeline Motion Design

## Goals

- Show completed todos by default while keeping the app-bar switch as the explicit visibility control.
- Remove the Web-only floating overflow button and expose its existing menu by tapping the BusyWeek header brand area.
- Replace the current enter/leave-only list behavior with continuous displacement motion for retained todos and day cards.

## Constraints and root cause

`vue-lynx@0.4.0` implements `TransitionGroup` enter and leave classes, but its runtime does not implement Vue's FLIP move phase. The `moveClass` prop exists in the public component shape but is never applied. Consequently, a leaving todo can animate horizontally while retained siblings receive their new layout positions in one frame and appear to flash into place.

The solution must run through the same Vue/Lynx template on Native and Web, retain the main timeline's single linear scroll child, and avoid browser-only layout measurement APIs.

## Considered approaches

1. Add `.todo-move` and `.day-move` CSS. This is the normal Vue solution but cannot work until Vue Lynx implements the missing FLIP phase.
2. Delay the data mutation until the exit animation ends. This preserves the exit but only postpones the sibling jump and makes persistence/state timing more complex.
3. Use data-driven position slots, following Evan You's HTML5 Clear v2. Every retained item transitions between explicit order-derived `translateY` positions while the departing item transitions independently. This is deterministic without DOM measurements and is the selected approach.

## Timeline layout model

Create a small pure `timelineMotion` module with the shared geometry:

- todo row height: `52px`
- day header height: `42px`
- gap before each day card: `10px`

For each visible day, the module produces:

- the day slot's cumulative Y offset;
- the day todo container height;
- every todo slot's `index * 52` Y offset;
- the total day-list height.

The template uses two levels of absolute slots inside bounded relative containers:

- `.day-slot` transitions to its new cumulative Y position. Its inner `.day-group` owns the existing card visuals and enter/leave animation.
- `.todo-slot` transitions to its new row Y position. Its inner `.todo` owns the existing row visuals and enter/leave animation.

The `.day-list` and each `.day-todos` container transition their calculated height. Therefore a deletion or completed-filter change produces three coordinated signals: the removed content exits left, retained rows move into their exact new slots, and later day cards move with the collapsing card height. Reduced-motion mode reduces all new transform and height transitions to `0.01ms`.

## Header and Web menu

`showCompleted` starts as `true`, so both pending and completed todos are visible on launch. The switch remains session-only and can hide completed todos.

The Web host removes `.ovf-btn` entirely. The existing copy-bundle and Legacy menu remains in light DOM but has no persistent visual trigger. Its script waits for the Lynx shadow root, binds the `.brand` area, and toggles the menu on click or Enter/Space. The brand receives Web-only button semantics and a focus target. Clicking the completed toggle does not open the menu because it is outside the brand target.

Clicking elsewhere closes the menu. Copy behavior and the full-screen Lynx bundle URL remain unchanged. Native has no Web menu binding, so tapping the brand remains inert there.

## Verification

- Unit-test layout offsets before and after removing rows and entire days.
- Add structural regression tests for default-visible completed state, removal of the floating Web button, header-brand menu binding, nested motion slots, and reduced-motion coverage.
- Run all Node tests, TypeScript, and production Lynx/Web builds.
- In the Web runtime, verify the menu, completed switch, deletion, filtering, retained-row displacement, retained-day displacement, and reduced-motion behavior.
- Treat physical Lynx Explorer verification as the final authority for Native motion timing.

## Reference

The motion model follows the ordering strategy in [yyx990803/HTML5-Clear-v2](https://github.com/yyx990803/HTML5-Clear-v2): items are absolutely positioned and their Y transforms are updated when their order changes, so surrounding content visibly moves instead of being reflowed instantaneously.
