require.config({
    baseUrl: "js/",
    paths: {
        //FastClick: "http://cdn.bootcss.com/fastclick/1.0.3/fastclick.min",
        FastClick: "lib/fastclick",
        IScroll: "lib/iscroll",
        Router: "lib/director",
        Vue: "lib/vue",
        AV: "https://cdn1.lncld.net/static/js/av-core-mini-0.5.4"
    },
    shim: {
        'IScroll': {
            exports: "IScroll"
        },
        'Router': {
            exports: "Router"
        },
        'AV': {
            exports: "AV"
        }
    }
})

require( [
    'Vue',
    'IScroll',
    'FastClick',
    'Router',
    'AV',
    'store',
    'util',
    'nav'
], function(
    Vue, 
    IScroll,
    FastClick,
    Router,
    AV,
    todoStorage,
    Util
) {   
    'use strict';
    console.log("module app loaded..");

    // Filters
    Vue.filter('getDay', function (_dateStr) {
        var _date = new Date(_dateStr),
            _day = _date.getDay(),
            _dayMap = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    
        return _dayMap[_day];
    });
    
    Vue.filter('getDayType', function (_dateStr) {
        var _diff = Util.getDateDiff(_dateStr, Util.getTodayDate()),
            _dayMap = ["今天", "明天", "后天", "大后天", "第五天", "第六天", "第七天", "下周今天"];
        
        if (_dayMap[_diff]) {
            return _dayMap[_diff];
        } else {
            return _diff > 0 ? (_diff + "天后") : (-_diff + "天前");
        }
    });
    
    
    /**
     * App 的全局状态
     *
     * @enum state
     */
    var states = {
        INPUT : "INPUT",
        LIST  : "LIST"
    }
    
    /**
     * App 
     * 
     * app.js
     */    
    var app = new Vue({
        el: '#app',
        data: {
            appName: "BusyWeek!",
            standalone: false,
            loaded: false,
            state:states.LIST,
            
            /**
             * 登录 类
             *
             * @class login
             */
            login: {
                state: 'default',
                tips: '如果账号不存在，系统会自动为您完成注册',
                username: '',   
                password: '',
                disabled: false,
                logined: false,
                current: null
            },

            /**
             * Todo 类
             *
             * @class todo
             */
            newTodo: {
                date: Util.getTodayDate(),
                dayType: '0',   // dayType 与 Option 绑定，但只在运行时有用
                done: false,
                text: ''
            },
            
            editingTodo: null,
            
            /**
             * 时间轴 Map 对象
             *
             * @object Timeline  { date: {DayObject} }        
             * @object DayObject { date: {Date}, todos: [{Todo}] }
             * @object Todo      { date: {Date}, dayType: {Number}, done: {Bool}, text:{String}}
             */
            timeline: todoStorage.fetch(),
            
            /**
             * 当前过滤器
             * 
             * @param {string} all
             * @param {string} done
             * @param {string} active
             */
             activeFilter: "all"

        },
        created: function () {
            this.detectLanguage();
            this.initAV();
            this.initRouter();
        },
        ready: function () {
            
            this.initScroll();
            this.isStandAlone();
            
            

            // watch filter to refresh IScroll
            this.$watch('activeFilter', function(_filter){
                console.log(_filter);
                this.refreshScroll();
            })

            // store _timeline
            this.$watch('timeline', function (_timeline) {
                //console.log(JSON.stringify(_timeline));
                todoStorage.save(_timeline);
                this.refreshScroll();
            }, true);
    
            // vue 11+ 解决了循环 watch 的稳定问题 (oldVal = newVal && break;)
            this.$watch('newTodo.dayType', function (_dayType, _dayType_old) {
                
                if( _dayType == "8"){
                    document.querySelector('.bw-datepicker').focus();
                }
                
                var _dateStr = Util.getDiffDate(_dayType);
                this.newTodo.date = _dateStr;
            });
            
            this.$watch('newTodo.date', function (_date, _date_old) {
                var _diff = Util.getDateDiff(_date, Util.getTodayDate());
                console.log(_diff);
                
                if (_diff >= 0 && _diff <= 7) {
                    this.newTodo.dayType = String(_diff);
                }else {
                    this.newTodo.dayType = "8";
                }
            });
            
            // App.loaded 
            console.log("vue working...");
            this.loaded = true;
        },
        
        // supported by Vue-TodoMVC
        directives: {
            'todo-focus': function (value) {
                if (!value) {
                    return;
                }
                var el = this.el;
                Vue.nextTick(function(){ 
                    el.focus();
                })
            }
        },
        
        methods: {
            
            onActionAdd: function(e){
                this.state = (this.state == "LIST" ) ? states.INPUT : states.LIST;
            },
            
            // Todo 
            addTodo: function (e) {
                e.preventDefault()
                
                var _new = this.newTodo,
                    _date = _new.date,
                    _dayType = _new.dayType,
                    _timeline = this.timeline; 
                
                // change state and update view
                this.state = states.LIST;
                
                // scroll to Todo
                this.scrollToTodo(_timeline, _date);
                
                // set default todo text 
                if (!this.newTodo.text) {
                    this.newTodo.text = "写点啥呀！"
                }
    
                // create new dayObject in timeline
                if (!_timeline[_date]) {
                    _timeline.$add(_date, {
                        date: _date,
                        todos: []
                    })
                }
    
                // push newTodo to corresponding dayObject
                _timeline[_date].todos.push(this.newTodo);
    
                // reset newTodo
                this.newTodo = {
                    dayType: _dayType,  // save dayType
                    date: _date,        // save date 
                    text: '',
                    done: false
                }
    
            },
            removeTodo: function (todo) {
                // remove todo
                this.timeline[todo.date].todos.$remove(todo.$data);
            
                // if day empty
                if (this.timeline[todo.date].todos.length == 0) {
                    this.timeline.$delete(todo.date);
                }
                this.refreshScroll();
            },
            checkTodo: function (todo) {
                todo.done = !todo.done;
            },
            editTodo: function (todo) {
                this.editingTodo = todo;
            },
            doneEdit: function (todo) {
                if (!this.editingTodo) {
                    return;
                }
                this.editingTodo = null;
                todo.text = todo.text.trim();
                if (!todo.text) {
                    this.removeTodo(todo);
                }
            },
            cancelEdit: function (todo) {
                this.editingTodo = null;
                //todo.title = this.beforeEditCache;
            },
            ifToday: function (_dateStr) {
                if (_dateStr == Util.getTodayDate()) {
                    return true;
                }
                return false;
            },
            // if todo show in activeFilter
            ifTodoShow: function(done){
                if (this.activeFilter == "active"){
                    return !done;
                }else if(this.activeFilter == "done"){
                    return done;
                }else{
                    return true;
                }
                
            },
            // if day show in activeFilter
            ifDayShow: function(todos){
                if(this.ifAboutShow()){
                    return;
                }

                var activeTodos = todos.filter(function(todo){
                    return !todo.done
                })
                
                // 完成数与活动数
                var actives = activeTodos.length;
                var dones = todos.length - actives;
               
                // 只要有未完成的，今天就需要显示
                if (this.activeFilter == "active"){
                    if(actives > 0){
                        return true;
                    }else{
                        return false;
                    }
                
                // 只要有完成的，今天就需要展示
                }else if(this.activeFilter == "done"){
                    if (dones > 0) {
                        return true;
                    }else{
                        return false;
                    }
                }else{
                    return true;
                }
               
            },
            ifAboutShow: function(){
                return this.activeFilter == "about";
            },
            ifLoginShow: function(){
                return this.activeFilter == "login";
            },
            ifCloudShow: function(){
                return this.activeFilter == "cloud";
            },
            // export to scope for vm-template use
            getDiffDate: function(_dayType){
                return Util.getDiffDate(_dayType)
            },
            detectLanguage: function(){
                var _nav = navigator;
                var _lang = (_nav.language || _nav.browserLanguage || _nav.userLanguage || "").substr(0, 2);
            
                if (_lang == "zh") {
                    this.appName = "好忙啊";
                }
            },
            // Router
            initRouter: function(){
                this.router = Router({
                    '/': this.setFilter.bind(null, "all"),
                    '/all': this.setFilter.bind(null, "all"),
                    '/done': this.setFilter.bind(null, "done"),
                    '/about': this.setFilter.bind(null, "about"),
                    '/login': this.setFilter.bind(null, "login"),
                    '/cloud': this.setFilter.bind(null, "cloud"),
                    '/active': this.setFilter.bind(null, "active"),
                });
                this.router.init('/');
            },
            setFilter: function(_filter){
                this.activeFilter = _filter;
            },
            // IScroll function
            initScroll: function(){
                this.BWScroll = new IScroll('.bw-scroller', { 
                    mouseWheel: true, 
                    bindToWrapper: true,
                    click: iScrollClick(),
                    //tap: iScrollClick(),
                    //preventDefault:  iScrollClick(),
                    
                });

                function iScrollClick(){
                    if (/iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent)) return false;
                    if (/Chrome/i.test(navigator.userAgent)) return (/Android/i.test(navigator.userAgent));
                    if (/Silk/i.test(navigator.userAgent)) return false;
                    if (/Android/i.test(navigator.userAgent)) 
                    {
                      var s=navigator.userAgent.substr(navigator.userAgent.indexOf('Android')+8,3);
                      return parseFloat(s[0]+s[3]) < 44 ? false : true
                    }
                }
            },
            refreshScroll: function(){
                var self = this;

                if(this.BWScroll){
                    Vue.nextTick(function(){ 
                        self.BWScroll.refresh();
                        setTimeout(function () {
                            self.BWScroll.refresh();
                        }, 300);
                    })  
                }
            },
            // standalone
            isStandAlone: function(){
                var _isIPhone = navigator.userAgent.indexOf('iPhone') != -1;
                var _isStandalone = window.navigator.standalone == true;
                
                if( _isIPhone && _isStandalone ){    
                    this.standalone = true
                }                 
            },
            /**
             * calculate the newTodo position and Scroll to!
             */ 
            scrollToTodo: function(_timeline, _date){
                // 把 timeline.key 做一次排序
                var sorted = (function(){
                    var arr = [];
                    for(var key in _timeline){
                        arr.push(key);
                    }
                    return arr.sort(function(a,b){
                        return a === b ? 0 : a > b ? 1 : -1
                    })
                })()
                
                // 拿到 _date 之前的 key
                var before = (function(){
                    var arr = [];
                    sorted.forEach(function(val){
                        if(val <= _date){
                            arr.push(val);
                        }
                    })
                    return arr;
                })()
                
                // 根据之前的 key 算出 items 数和位置
                var position = (function(){
                    var day = before.length,
                        items = 0;
                    
                    before.forEach(function (date) {
                        var dayList = _timeline[date];
                        items += dayList.todos.length;
                    }) 
                    
                    //console.log("day:"+day+" items:"+items);
                    
                    return day*36+(items+7)*48;
                })()
                
                // 根据位置算出 ScrollY
                var scrollY = (function(){
                    var edge = window.innerHeight || window.screen.availHeight;
                    
                    if(position < edge){
                        return 0;
                    }else{
                        return position - edge;
                    }
                })()
                
                // jump to the target Scroll Position at NEXT View Update
                // this method falls back to setTimeout(fn, 0)
                var _scroll = this.BWScroll;

                Vue.nextTick(function(){ 
                    //scroll(0, scrollY);
                    _scroll.scrollTo(0, -scrollY)
                })
                
        //      console.log(before);
        //      console.log("position:"+ position);
        //      console.log("scrollTo:"+ scrollY);

        //      console.log("document.body.clientHeight"+document.body.clientHeight);
        //      console.log("document.body.offsetHeight"+document.body.offsetHeight);
        //      console.log("window.innerHeight"+window.innerHeight);
        //      console.log("window.outerHeight"+window.outerHeight);
        //      console.log("window.screen.height"+window.screen.height);
        //      console.log("window.screen.availHeight"+window.screen.availHeight);
            },
            // LeanCloud
            initAV: function(){
                // cloud storage
                AV.initialize("nhgpmpkj0f9uq8hrlf3hq1lwxuhao9dj3kl8z1dye6cjaptq", "5ex5jdqj0pue2xlmaxwljmafrvd9y0il75zjke4cpxr0dzgp");

                var _current = AV.User.current();
                if(_current){
                    this.login.logined = true;
                    this.login.current = _current;
                }
            },
            userLogOut: function(e){
                e.preventDefault();
                AV.User.logOut();
                this.login.tips = '如果账号不存在，系统会自动为您完成注册';
                this.login.current = null;
                this.login.logined = false;
            },
            userLogIn: function(e){
                e.preventDefault()

                this.login.disabled = true;

                var self = this,
                    username = this.login.username,
                    password = this.login.password;

                AV.User.logIn(username, password, {
                    success: function(user) {
                        console.log(user);
                        self.login.state = "default";
                        self.login.tips = "登录成功";
                        self.login.logined = true;
                        self.login.current = user;
                        self.activeFilter = 'all';
                        self.login.disabled = false;
                        self.login.username = "";
                        self.login.password = "";
                    },

                    error: function(user, error){
                        console.log(error);
                        if(error.code == 211){
                            self.login.state = "warning";
                            self.login.tips = "该用户不存在，正在为您自动注册";
                            self.userSignUp(username, password);
                            return;
                        }
                        if(error.code == 210){
                            self.login.state = "warning";
                            self.login.tips = "用户名与密码不匹配";
                            self.login.disabled = false;
                        }
                    }
                })
            },
            userSignUp: function(_u, _p){
                console.log("注册中");
                var self = this,
                    username = _u,
                    password = _p;

                var _user = new AV.User();
                _user.set("username", username);
                _user.set("password", password);

                _user.signUp(null, {
                    success: function(user) {
                        console.log(user);
                        self.login.tips = "注册成功";
                        alert("注册成功！将自动为您登录");

                        self.login.state = "default";
                        self.login.tips = "登录成功";
                        self.login.logined = true;
                        self.login.current = user;
                        self.login.disabled = false;
                        self.login.username = "";
                        self.login.password = "";
                        setTimeout(function(){
                            self.activeFilter = 'all';
                        }, 1000);
                    },

                    error: function(user, error) {
                        console.log(error);
                        self.login.state = "warning";
                        self.login.tips = error.message;
                        self.login.disabled = false;
                    }
                });
            },
            // cloud backup
            uploadData: function(){

                var _todo = {
                    todos: todoStorage.fetch()
                }

                AV.User.current().save(_todo, {
                    success: function(object) {
                        console.log(AV.User.current().get('username')+" push!");
                        console.log(object);
                        alert("上传成功！")
                    },
                    error: function(object, error){
                        alert(error.message);
                    }
                });
            },
            downloadData: function(){
                // 根本没有网络请求！Todos 是跟着 User 一起下来的
                var _todos = AV.User.current().get("todos");
                if(_todos){
                    this.timeline = _todos;
                }
            }
        }
    })
    

    // export app to global
    window.vue = Vue;
    window.app = app;
    
    // deal with load
    //app.loaded = true;
    
    // FastClick
    FastClick.attach(document.body);
    document.addEventListener('touchmove', function (e) { e.preventDefault(); }, false);
    console.log("fastclick working...");
    
        
    
});



