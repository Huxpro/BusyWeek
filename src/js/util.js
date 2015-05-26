define([],function(){
    

    /* Util Method */
    console.log('util..');
    function getDateStr(_date) {
        var _y = _date.getFullYear(),
            _m = _date.getMonth() + 1,    //  好坑，从0开始
            _m = _m < 10 ? "0" + _m : _m,
            _d = _date.getDate(),
            _d = _d < 10 ? "0" + _d : _d,
            _s = _y + "-" + _m + "-" + _d;
    
        return _s;
    }
    //返回今天的日期格式化字符串
    function getTodayDate() {
        var _date = new Date();
    
        return getDateStr(_date);
    }
    
    //计算两个日期的相差天数
    function getDateDiff(startDate, endDate) {
    
        var aDate, oDate1, oDate2, iDays;
        aDate = startDate.split('-');
        oDate1 = new Date(aDate[0] + '-' + aDate[1] + '-' + aDate[2]);
        aDate = endDate.split('-');
        oDate2 = new Date(aDate[0] + '-' + aDate[1] + '-' + aDate[2]);
        iDays = parseInt((oDate1 - oDate2) / 1000 / 60 / 60 / 24); //把相差的毫秒数转换为天数
    
        return iDays;
    }
    
    // 返回目标天的日期格式化字符串
    function getDiffDate(_dayType) {
        var _time = new Date().getTime() + _dayType * 24000 * 3600,
            _date = new Date();
    
        _date.setTime(_time);
    
        return getDateStr(_date);
    }
   
   
    window.getDateStr = getDateStr;
    window.getTodayDate = getTodayDate;
    window.getDateDiff = getDateDiff;
    window.getDiffDate = getDiffDate;
})