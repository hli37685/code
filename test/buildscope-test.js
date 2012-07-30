
var esprima=require("../parser/esprima"),
    escodegen=require("../parser/escodegen");


var fs = require('fs');

var base=require("../src/base"),
    Syntax=base.Syntax,
    util= base.util;

var ob = require('../src/ob-code');

ob.GlobalScope;
ob.FunctionScope;
ob.Properties;
ob.ScopePathMap;


var testFiles=[
    'my-code.js',
    // 'backbone-0.5.3.js',
    // 'mootools-1.4.1.js',
    // 'prototype-1.7.0.0.js',
    // 'jquery-1.7.1.js',
    // 'ext-core-3.1.0.js'
];

var testcase="./testcase";


function buildscope( idx ){
	var fileName=testFiles[idx||0];
	if (!fileName){
		if (idx=="all"){
			testFiles.forEach(function(f,i){
				buildscope(i);
			});
			return;		
		}else{
			return buildscope(0);
		}		
	}
	var filePath=testcase+"/"+fileName;

	var code = fs.readFileSync(filePath, "UTF-8");
	var options = {
            raw : !true,
            // ,
            // tokens  : !true,
            // tolerant : !true ,
            // comment : !true,
            loc : !true,
            // range : !true
        };

	var start=Date.now();
	var result = esprima.parse(code, options);

	var end1=Date.now();
	var global=new ob.GlobalScope(result);
	var end2=Date.now();

// global.obfuscate();

global.obfuscateChildren();
console.log( JSON.stringify( result, util.adjustRegexLiteral, 2) );
console.log("##################");
console.log( JSON.stringify( global, util.adjustRegexLiteral, 2) );
// console.log( JSON.stringify( ob.Properties, util.adjustRegexLiteral, 2) );

code = escodegen.generate(result, { indent: "    " });
console.log( code );


	console.log("===== ob-code : "+fileName+" =====");
	console.log( "esprima.parse cost time : "+ (end1-start) );
	console.log( "ob-code cost time : "+ (end2-end1) );


	return result;
}

var testFileIdx= process.argv[2]||0;
buildscope(testFileIdx);







