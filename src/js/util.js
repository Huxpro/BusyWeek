define([],function(){
    'use strict'
    console.log('module util loaded..');
    
    var Util = {

        /**
         * @param {Date}
         * @return {String} 格式化字符串
         */
        getDateStr: function(_date){
            var _y = _date.getFullYear(),
                _m = _date.getMonth() + 1,    //  好坑，从0开始
                _m = _m < 10 ? "0" + _m : _m,
                _d = _date.getDate(),
                _d = _d < 10 ? "0" + _d : _d,
                _s = _y + "-" + _m + "-" + _d;
            return _s;
        },

        //返回今天的日期格式化字符串
        getTodayDate: function() {
            var _date = new Date();
        
            return this.getDateStr(_date);
        },

        //计算两个日期的相差天数
        getDateDiff: function(startDate, endDate) {
        
            var aDate, oDate1, oDate2, iDays;
            aDate = startDate.split('-');
            oDate1 = new Date(aDate[0] + '-' + aDate[1] + '-' + aDate[2]);
            aDate = endDate.split('-');
            oDate2 = new Date(aDate[0] + '-' + aDate[1] + '-' + aDate[2]);
            iDays = parseInt((oDate1 - oDate2) / 1000 / 60 / 60 / 24); //把相差的毫秒数转换为天数
        
            return iDays;
        },
    
        // 返回目标天的日期格式化字符串
        getDiffDate: function(_dayType) {
            var _time = new Date().getTime() + _dayType * 24000 * 3600,
                _date = new Date();
        
            _date.setTime(_time);
        
            return this.getDateStr(_date);
        },

        /**
         * @param {String}
         * @return {String}  X 月 X 日
         */
        getChineseDateStr: function(_dateStr){
            var _date = new Date(_dateStr);
            var _str = 
                (_date.getMonth()+1) 
                + "月"
                + (_date.getDate())
                + "日" 

            return _str;
        },
        getChineseDateStrWithDay: function(_dateStr){
            var _date = new Date(_dateStr);
            var _str = 
                (_date.getMonth()+1) 
                + "月"
                + (_date.getDate())
                + "日 "
                + Util.getDay(_dateStr)

            return _str;
        },

        /**
         * @param {String} 格式化字符串
         * @return {String} 星期几
         */
        getDay: function(_dateStr){
            var _date = new Date(_dateStr),
            _day = _date.getDay(),
            _dayMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    
            return _dayMap[_day];
        }        
    } 
    
   return Util;
})