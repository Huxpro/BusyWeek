/*jshint unused:false */

(function (exports) {

    'use strict';
    console.log('store..');
    var STORAGE_KEY = 'busyWeek';

    exports.todoStorage = {
        fetch: function () {
            // modified to {} from [] by Hux
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        },
        save: function (todos) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
        }
    };

})(window);