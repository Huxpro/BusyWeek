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


# Changelog


## V1.6.1

##### Fix

* FAB now using iconfont instead of text, to fix the line-height issue
* Drawer is speeding up while touch moving by add a class to control



## V1.6.0

##### New

* Todo item now support **Multi line**!
* [The view and edit of todo now decouple](https://github.com/Huxpro/BusyWeek/commit/55af7edf24fc7571952b17d1e5683ea45a3b8dce)



## V1.5.1

##### New

[Keep optimize Desktop Experience](https://github.com/Huxpro/BusyWeek/commit/3ab63ceb90b5438a71447611785161e7196aee44)



## V1.5.0

##### New

* Brand new **Material design**! including icons and FAB (Floating Action Button)
* Responsive Design for Desktop is working

##### Change

* Icon now support by icomoon (no more iconfont.cn)
* MPI.css is tiny down

##### Todo

* Abandon MPI.css



## V1.4.0

##### New

* **Navigation Drawer** is coming!
* Now you can **FILTER** todos by done or not
* [Filter Mechanism](https://github.com/Huxpro/BusyWeek/commit/73de11a8875ca649adb3542965e335363aba9ef7)

##### Change

* No more border of todo items now, seeing the render issues



## V1.3.0

##### New

* Migrate to **RequireJS** as the JS module loader
* Using **Gulp** as workflow tool now
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

* NewTodoView now display in **fullscreen**, to fix the input & keyboard issues (always in mobile)
* Add `push.sh` for master and gh-pages branch sync

##### Change

* Fastclick now support by CDN

## V1.0.0

* First release!
* Using **Vue.js** as MVVM framework
* Using **NPM** as module management
* Using **Grunt** as task runner
