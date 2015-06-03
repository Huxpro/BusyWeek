# BusyWeek! 

> A time-based Todo-list App with simple design, which is a side-project of mine


## What is BusyWeek!

BusyWeek! is a **time-based** Todo-list App with simple, elegant design, which can help you manage your schedule by automatically convert time between 

- *What is the date that day?* 
- *What day is it that day?* 
- *How many days before/after that day?*

and present a Todo-list **sorted by date** to you.


## Expectation

*(The Droid - feature is only for Android Version)*

* Out of the box
* No annoying
* Cloud sync
* Droid - Material Design

---

# Changelog

## V1.3.0

##### New

* Migrate to RequireJS as JS module loader
* Using Gulp as workflow tool now
* Using Require.js Optimizer as build tool now

##### Change

* We will no longer using Grunt



## V1.2.2

##### New

* Add weekdays display for newTodoView

## V1.2.1

#### Fix

* Since `window.screen.height != window.innerHeight` in iOS Safari, use `window.innerHeight` to fix intelliScroll issues

## V1.2.0

##### New

* **IntelliScroll!**: we create a *postion system* to calculate to where should the list scroll when a new todo is added in.

#### Change

* Motion improvement


## V1.1.0

##### New

* NewTodoView now display in fullscreen, to fix the input & keyboard issues 
* Add `push.sh` for master and gh-pages branch sync

##### Change

* Fastclick now support by CDN

## V1.0.0

* First release!
* Using Vue.js as MVVM framework
* Using NPM as module management
* Using Grunt as task runner