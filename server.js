/**
 * Simple Node Server
 * 
 * created by Hux at 2015.06.17
 */
 
var http = require("http"),
    url  = require("url"),
    path = require("path"),
    fs   = require("fs");
    
var PORT = 9000; 
var MIME = {
    "css": "text/css",
    "gif": "image/gif",
    "html": "text/html",
    "ico": "image/x-icon",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "js": "text/javascript",
    "json": "application/json",
    "pdf": "application/pdf",
    "png": "image/png",
    "svg": "image/svg+xml",
    "swf": "application/x-shockwave-flash",
    "tiff": "image/tiff",
    "txt": "text/plain",
    "wav": "audio/x-wav",
    "wma": "audio/x-ms-wma",
    "wmv": "video/x-ms-wmv",
    "xml": "text/xml"
};
 
function getMIMEType(pathname){
    var ext = path.extname(pathname);
    ext = ext? ext.slice(1) : 'unknown';
    
    return MIME[ext] || "text/plain";
} 

var server = http.createServer(function (request, response) {
    
    // 解析 path
    var pathname = url.parse(request.url).pathname;
    
    // 入口页面
    var index = "/index.html";
    pathname = (pathname == '/') ? index : pathname;
    
    // 静态文件
    var baseURL = "src";
    var realPath = baseURL + pathname;
    
    fs.exists(realPath, function(exists){
        if(!exists){
            response.writeHead(404, {
                'Content-Type': 'text/plain'
            });
            response.write(realPath + "was not found.");
            response.end();
        } else {
            fs.readFile(realPath, "binary", function (err, file) {
                if(err){
                    response.writeHead(500, {
                        'Content-Type': 'text/plain'
                    });
                    console.log(err);
                    response.end();
                } else {
                    response.writeHead(200, {
                        'Content-Type': getMIMEType(pathname)
                    });
                    
                    response.write(file, "binary");
                    response.end();
                }
            })
            
        }
        
    })    
}).listen(PORT);

console.log("Server running at port: " + PORT );