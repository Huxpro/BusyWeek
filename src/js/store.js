/*jshint unused:false */

(function (exports) {

    'use strict';
    console.log('module store loaded..');
    
    var STORAGE_KEY = 'busyWeek';

    exports.todoStorage = {
        fetch: function () {
            // for debug use. 
            window.data = JSON.parse(localStorage.getItem(STORAGE_KEY)); 
                
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        },
        save: function (data) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
    };

    /**
     * Polyfill to the isArray()
     */
    function isArray(o) {        
        if (!Array.isArray) {
            Array.isArray = function(arg) {
                return Object.prototype.toString.call(arg) === '[object Array]';
            };
        }
        return Array.isArray(o);
    }
    
    /**
     * Data Structure Forward Compatible
     * 
     * Created by @Hux at 2015/06/09
     * Unused by @Hux at 2015/06/10
     * Someday it will be used
     * 
     */
    function ConvertData(data){
        
        // timeline = {} 
        if (typeof data == "object" && !isArray(data)) {
            console.log("Old Struct: Timeline is a Object");
        }
        
        // timeline = [];
        if (typeof data == "object"  && isArray(data)) {
            console.log("Timeline is a Array, get its version");
        }
    }
   
})(window);