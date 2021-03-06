"use strict";

var lists = {
    keyword: require("./keyword"),
    global: require("./global"),
    property: require("./property"),
    dom: require("./dom"),
    domClass: require("./domClass"),
    node: require("./node")
}

module.exports = {};

var allMap = Object.create(null);
for (var key in lists) {
    var o = module.exports[key] = {};
    lists[key].forEach(function(item) {
        o[item] = true;
        allMap[item] = true;
    })
}
module.exports.allMap = allMap;
