// Deploy-only stub for the LeanCloud (AV) SDK so BusyWeek boots without the
// external CDN. Login / cloud-sync are inert; the todo app is unaffected.
window.AV = {
  initialize: function () {},
  User: {
    current: function () { return null; },
    logIn: function () {},
    logOut: function () {}
  }
};
define('AV', [], function () { return window.AV; });
