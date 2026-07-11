({
    appDir: './src/',
    baseUrl: './js/',
    dir: './dist',
    modules: [
        {
            name: 'app'
        }
    ],
    fileExclusionRegExp: /^(r|build)\.js$/,
    optimizeCss: 'standard',
    removeCombined: true,
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
