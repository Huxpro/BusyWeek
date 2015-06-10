/****
 * JSON Mock, the template of json data.
 * 
 * Created by Hux at 15/06/10
 *
 ****/

{
    "version": {
        "android": "0",    
        "web": "0",      
    },
    
    "data": {
        "2015-06-10": {                 // @field {object} <yyyy-mm-dd>  
            "date": "2015-06-10",       // @field {string} date
            "todos": [                  // @field {array}  todos
                {   
                    // universal
                    "id" : "",                          // 缺省，未来用于 md5 加密
                    "createdTime" : "1433919615071",    // 创建时间
                    "modifiedTime" : "1563919615071",   // 修改时间，可用于检索冲突
                    "date": "2015-06-10",               // 完成期限 = deadline
                    "done": false,                      // 是否完成 = checked
                    "text": "今天写点啥啊",               // Todo 文字内容
                    
                    // web-only
                    "dayType": "1",                     // 运行时需要
                    
                    // android-only
                }
            ]
        }
    }
}

/**

this JSON is designed to be Semantic, you can fetch your data like that:

var data = json.data;

data["2015-06-10"]                                  // get DayObject
data["2015-06-10"].todos                            // get Todos
data["2015-06-10"].todos[1]                         // get the first todo of that day
data["2015-06-10"].todos[1].text                    // get text of the first todo
data["2015-06-10"].todos[1].date == "2015-06-10"    // true

**/
