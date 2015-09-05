# BusyWeek!

> A time-based Todo-list App with simple design, which is a side-project of mine


## What is BusyWeek!

BusyWeek! is a **time-based** Todo-list App with simple, elegant design, which can help you manage your schedule by automatically convert time between

- *What is the date that day?*
- *What day is it that day?*
- *How many days before/after that day?*

and present a Todo-list **sorted by date** to you.


## Expectation


* Out of the box
* No annoying
* Cloud sync
* Material Design


# Changelog

## Warning

This project is no longer maintained and would be rewrite using React.js.

Although Vue.js is a very simple, awesome, light-weight MVVM library and support Component System now days, but React.js does better in many way:

- Model and View is not strictly bound(limit each other), which is more flexible than ViewModel data-binding
- The Old Back-end MVC way is more simple and focused when deal with UI rendering than MVVM
- Represent UI as a **state machine** making UI logic predictable and easy to maintain
- UI template is more declarative with JSX than a template engine DSL
- Communication between components is clear with `props`, `context` and `callback`.
- Ecosystem is more active and strong.
- etc.

## V2.1.1

##### Change

* Vue.js upgrade to 0.12.12 (from 0.11)
* Migrate to `gulp-connect` instead of own wrote `server.js`


## V2.1.0

##### New

* Optimize for Cordova use
* Add npm script


## V2.0.0

##### New

* LogIn/SignUp/CloudSync support!
* Router use director.js

##### Fixed

* Fix scrollTo() unusable when migrating to iScroll


## V1.8.0

##### New

* Using [iScroll](http://iscrolljs.com/) to fake native scrolling now!
* iOS `standalone` style support! (and Hybrid is ready!)

##### Change

* `require.js` config optimize
* `Gulpfile.js` add `watch` feature




## V1.7.2

##### New

* Using new vanilla-node `server.js` instead of `grunt-connect` to local used server
* Add `gulp serve` to exec the `supervisor server.js` (need supervisor installed globally)

##### Change

* `mpi.scss` shrink down
* `Gruntfile.js` move to the `outdated` dir
* Drop all grunt-dependencies in `package.json`



## V1.7.1

##### Change

* Try best to load all js file more async
    * Add `async` `defer` attr to the script tag load require.js
    * And using require.js `data-main` attr to load entry js file asynchronously



## V1.7.0

##### New

* Brand new Loading Screen! Gorgeous splash animation

##### Fix

* After using Require.js as the module loader, I put all `<script>` tag at the end of `<body>`, which expose the rendering process in desktop ( Mobile will be waiting all script ready then render)
* The second reason help to trigger this problem is that desktop will perform all "transition" at the beginning if you set `transiton: all`
* So I fixed this issue by hack the CSS of Loading Screen
* If you try to use `display:none` to hidden all UI except Loading, It is truly expensive.



## V1.6.2

##### New

* DayPicker in newTodoView now support "选个日期" as the option out of range
* Using Autoprefixer as one task of the CSS pre-compile, mainly for Flexbox.

##### Fix

* Fix layout of the 3 pickers in newTodoView, by re-write the Flexbox style
* Code Optimization



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

* [Keep optimize Desktop Experience](https://github.com/Huxpro/BusyWeek/commit/3ab63ceb90b5438a71447611785161e7196aee44)



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
