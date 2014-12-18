"use strict";

// filter.js
Vue.filter('getDay', function (_dateStr) {
    var _date = new Date(_dateStr),
        _day = _date.getDay(),
        _dayMap = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

    return _dayMap[_day];
});

Vue.filter('getDayType', function (_dateStr) {
    var _diff = getDateDiff(_dateStr, getTodayDate()),
        _dayMap = ["今天", "明天", "后天", "大后天", "第五天", "第六天", "第七天", "下周今天"];

    //console.log(_diff);

    if (_dayMap[_diff]) {
        return _dayMap[_diff];
    } else {
        return _diff > 0 ? (_diff+"天后") : (-_diff+"天前");
    }

});




// app.js
var app = new Vue({
    el: '#app',
    data: {
        appName: "BusyWeek!",
        loaded:false,
        inputMode: true,
        flagDate:'',
        newTodo: {
            dayType:'0',
            date: getTodayDate(),
            text: '',
            done: false
        },
        _todos: [{
            text: '这个是示例哦～',
            done: false
        }],
        _day:{
            dayType:'0', // 没用，因为需要渲染时 update 
            date: getTodayDate(),
            todos: this._todos
        },
        timeline:todoStorage.fetch()
    },
    // Lifecycle created
    created: function(){
        // detect language
        var _nav = navigator;
        var _lang = (_nav.language || _nav.browserLanguage || _nav.userLanguage || "").substr(0,2);

        if (_lang == "zh"){
            this.appName = "好忙啊";
        }
    },
    // Lifecycle ready 
    ready: function () {
        // locStorage _timeline
        this.$watch('timeline', function (_timeline) {
            //console.log(JSON.stringify(_timeline));
            todoStorage.save(_timeline);
        }, true);

        // vue 11+ 解决了死循环 watch 的稳定问题 (oldVal = newVal && break;)
        this.$watch('newTodo.dayType',function(_dayType, _dayType_old){

            var _dateStr = getDiffDate(_dayType);
            this.newTodo.date = _dateStr;
        });
        this.$watch('newTodo.date',function(_date, _date_old){

            var _diff = getDateDiff(_date, getTodayDate());
            if(_diff >= 0 && _diff<=7){
                this.newTodo.dayType = String(_diff);
            }
        });

    },
    methods: {
        //loading
        onLoaded: function(e){
            this.loaded = true;
        },
        // todo
        addTodo: function (e) {
            e.preventDefault()    

            if(!this.newTodo.text){
                this.newTodo.text = "写点啥呀！"
            }

            // get newTodo
            var _date = this.newTodo.date,
                _timeline = this.timeline;

            // new dayObject in timeline
            if(!_timeline[_date]){
                _timeline.$add(_date,{
                    date: _date,
                    todos:[]
                })
            }

            // push newTodo to corresponding dayObject
            _timeline[_date].todos.push(this.newTodo);

            // reset newTodo
            this.newTodo = {
                dayType:'0',
                date : _date,
                text: '',
                done: false
            }

            this.newTodo.date = _date;

        },
        removeTodo: function (todo) {
            // remove todo
            this.timeline[todo.date].todos.$remove(todo.$data);

            // if day empty
            if (this.timeline[todo.date].todos.length == 0) {
                this.timeline.$delete(todo.date);
            }
        },
        checkTodo: function(todo){
            todo.done = !todo.done;
        },
        editTodo: function(todo){

        },
        hackCheckbox: function(e){
            return false;
        },
        enterInputMode: function(e){
            //this.inputMode = true;
        },
        exitInputMode: function(e){
            //this.inputMode = false;
        },
        ifToday: function(_dateStr){
            if(_dateStr == getTodayDate()){
                return true;
            }
            return false;
        }

    }
})

/* Util Method */

function getDateStr(_date){
    var _y = _date.getFullYear(),
        _m = _date.getMonth()+1,    //  好坑，从0开始
        _d = _date.getDate(),
        _d = _d < 10 ? "0"+_d : _d,
        _s = _y+"-"+_m+"-"+_d;

    return _s;
}
//返回今天的日期格式化字符串
function getTodayDate(){
    var _date = new Date();
    
    return getDateStr(_date);
}

//计算两个日期的相差天数
function getDateDiff(startDate, endDate){

   var aDate, oDate1, oDate2, iDays ;
   aDate = startDate.split('-');
   oDate1 = new Date(aDate[0]+'-'+aDate[1]+'-'+aDate[2]) ;
   aDate = endDate.split('-');
   oDate2 = new Date(aDate[0]+'-'+aDate[1]+'-'+aDate[2]);
   iDays = parseInt((oDate1 -oDate2)/1000/60/60/24); //把相差的毫秒数转换为天数

   return iDays ;
}

// 返回目标天的日期格式化字符串
function getDiffDate(_dayType){
    var _time = new Date().getTime()+ _dayType*24000*3600,
        _date = new Date();

    _date.setTime(_time);

    return getDateStr(_date);; 
}

