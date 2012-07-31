
var esprima=require("../parser/esprima"),
    escodegen=require("../parser/escodegen");


;(function (exports) {

if (typeof require!=="function"){
    require=function(){};
}


var base=require("./base")||this,
    Reserved=require("./reserved"),
    util= base.util;

var Syntax = { Anonymous : "(Anonymous)" };

for (var key in esprima.Syntax){
    Syntax[key]=esprima.Syntax[key];
}
    


var Config={};


var Hanlder={

    VariableDeclaration : function(node){
        var self=this;
        var declarations=node.declarations;
        declarations.forEach( function(d){
            if (d.type==Syntax.VariableDeclarator){
                var name=d.id.name;
                self.variables[name]=self.variables[name]||[];
                self.variables[name].push(d.id)
            }
        })
    },

   FunctionDeclaration : function(node){
        var self=this;

        var name=node.id?node.id.name:Syntax.Anonymous;
        var functionScope=new FunctionScope(node, self);
        var d=self.functions[functionScope.name]||[];
        if (node.id){
            d.push(node.id);
        }
        self.functions[functionScope.name]=d;
    },

    FunctionExpression : function(node){
        var self=this;
        return Hanlder.FunctionDeclaration.call(self, node);
    },

    Identifier : function(node , key, parentNode ){
        var self=this;
        var name=node.name;

        if (node._ignore_){
            return true;
        }

        var paramMap=self.parameters,
            varMap=self.variables,
            funMap=self.functions;

        var found=false;   

        if (key=="property" && !parentNode.computed ){
            Hanlder._addProperty(node.name, node);
            return;
        }

        if (varMap&&Array.isArray(varMap[name]) ){
            found=true;
            varMap[name].push(node);
        }
        if (funMap&& Array.isArray(funMap[name]) ){
            found=true;
            funMap[name].push(node);
        }
        if (paramMap&&Array.isArray(paramMap[name]) ){
            found=true;
            paramMap[name].push(node);
        }

        if (!found && node.type==Syntax.Identifier){
            self.undefinedIdentifier.push(node);
        }
        return found;
    },



    MemberExpression : function(node){
        var self=this;
        var property=node.property;
        var computed=node.computed;
        if (computed){ // obj[key]
            if (property.type== Syntax.Literal){
                Hanlder._addProperty(property.value, property);
           }          
        }else{ // obj.key
           if (property.type== Syntax.Identifier){
                Hanlder._addProperty(property.name, property);
           }
        }
    },


    // ObjectExpression : function(node){

    // },

    Property : function(node, computed){
        var self=this;
        var property=node.key;
        if (property.type== Syntax.Identifier){
            Hanlder._addProperty(property.name, property);
        }else if(property.type== Syntax.Literal){
            Hanlder._addProperty(property.value, property);
        }
    },

 
    CatchClause : function(node){
        var self=this;
        var catchScope=new CatchScope(node, self);
    },

   
    _addProperty : function(pname, property){
        if (typeof pname =="string"){
            if (!Array.isArray(Properties[pname])){
                Properties[pname]=[];                            
            }
            var list=Properties[pname];
            list.push(property)                         
        }
    }


};

var Properties=Object.create(null);
var ScopePathMap={};

function BaseScope(node, parent){ }

BaseScope.prototype={
    constructor : BaseScope,


    init : function(){
        this.variables=Object.create(null);
        this.functions=Object.create(null);

        this.usedIdentifier=Object.create(null);
        this.undefinedIdentifier=[];

        this.childScopes=[];

    },

    build : function(node){

        this.findDeclaration(node.body);

        this.parseNode(node.body);

        var self=this;
        this.usedIdentifier[self.name]=self.name;
        for (var key in this.variables){
            this.usedIdentifier[key]=key;
        }
        for (var key in this.functions){
            this.usedIdentifier[key]=key;
        }
        this.undefinedIdentifier.forEach(function(u){
             self.usedIdentifier[u.name]=u.name;
        });
        
        
        this.childScopes.forEach(function(child){
            if (child.type==Syntax.CatchClause){
                return;
            }
            var uList=child.undefinedIdentifier;
            uList.forEach(function(u,i){
               var rs=Hanlder.Identifier.call(self, u);
               if(rs===false && self.type== Syntax.Program){
                    self.variables[u.name]=[];
                    rs=true;
               }
               if (rs){
                    var m=null;
                    if ( Array.isArray(self.variables[u.name]) ){
                        m=self.variables[u.name];
                    }else if( Array.isArray(self.functions[u.name]) ){
                        m=self.functions[u.name];
                    }else if( Array.isArray(self.parameters[u.name]) ){
                        m=self.parameters[u.name];
                    }
                    m.push(u);
                    uList[i]=null;
               }else{
                    self.undefinedIdentifier.push(u);
               }
            });
            child.undefinedIdentifier=[];
        });

    },
    obfuscateChildren : function(cache){
        this.childScopes.forEach(function(child){
            var _cache={};
            util.merger(_cache, cache);
            child.obfuscate(_cache);
        });
    },

    obfuscate : function(cache){
        cache=cache||Object.create(null);
        for (var key in this.usedIdentifier){
            cache[key]=true;
        }
 
        var self=this;
        var varKeys=Object.keys(this.variables);
        var funcKeys=Object.keys(this.functions);
        var paramKeys=Object.keys(this.parameters||{});
        
        var count=varKeys.length+funcKeys.length+paramKeys.length;

        var reserved={};
        for (var p in Reserved.keyword){
            reserved[p]=true;
        }
        for (var p in Reserved.global){
            reserved[p]=true;
        }
        for (var p in Reserved.node){
            reserved[p]=true;
        }
        for (var p in Config.blackListV){
            delete reserved[p];
        }
        for (var p in Config.blackList){
            delete reserved[p];
        }
        for (var p in Config.whiteListV){
            reserved[p]=true;
        }
        for (var p in Config.whiteList){
            reserved[p]=true;
        }


        var newNames=util.getRandomNames(count, cache, reserved);
        var i=0;
        varKeys.forEach(function(k){
            if (!reserved[k]){
                self.changeVarName(k, newNames[i++]);
            }
        });
        funcKeys.forEach(function(k){
            if (!reserved[k]){
                self.changeFuncName(k, newNames[i++]);
            }
        });
        paramKeys.forEach(function(k){
             if (!reserved[k]){
                self.changeParamName(k, newNames[i++]);
            }
        });
        this.obfuscateChildren(cache);

    },


    isInCurrentScope : function(node){
        return node.type!=Syntax.FunctionDeclaration
                && node.type!=Syntax.FunctionExpression
                && node.type!=Syntax.CatchClause 
                ;
    },

    changeVarName : function(oldName, newName){
        var list=this.variables[oldName];
        delete this.variables[oldName];
        if (list){
            this.variables[newName]=list;

            list.forEach(function(v){
                v.name=newName;
            })
        }
        if (this.parameters && (oldName in this.parameters)){
            this.changeParamName(oldName, newName);
        }
    },

    changeParamName : function(oldName, newName){
        var list=this.parameters[oldName];
        delete this.parameters[oldName];
        if (list){
            this.parameters[newName]=list;

            list.forEach(function(v){
                v.name=newName;
            })
        }
    },
    changeFuncName : function(oldName, newName){
        var list=this.functions[oldName];
        delete this.functions[oldName];
        if (list){
            this.functions[newName]=list;

            list.forEach(function(v){
                v.name=newName;
            })
        }
        if (this.parameters && (oldName in this.parameters)){
            this.changeParamName(oldName, newName);
        }
    },

    findDeclaration : function(node){
        var self=this;
        if (Array.isArray(node)){
            for (var i=0,len=node.length;i<len;i++){
                var _node=node[i];
                self.findDeclaration(_node);
            }
        }else if (util.isObject(node)){
            if (node.type==Syntax.VariableDeclaration || node.type==Syntax.FunctionDeclaration){
                Hanlder[node.type].call(self, node, self);                
            }
            if ( this.isInCurrentScope(node) ){
                for (var key in node){
                    if (node.type==Syntax.Property && key=="key"){
                        continue;
                    }
                    self.findDeclaration( node[key] );                    
                }
            }
        }
    },

    parseNode : function(node , key, parentNode){
        var self=this;
        if (Array.isArray(node)){
            for (var i=0,len=node.length;i<len;i++){
                var _node=node[i];
                self.parseNode(_node);
            }
        }else if (util.isObject(node)){
            if (node.type!=Syntax.VariableDeclaration && node.type!=Syntax.FunctionDeclaration){
                var handler=Hanlder[node.type];
                if (handler){
                    handler.call(self, node, key, parentNode);
                }
            }
            if ( this.isInCurrentScope(node) ){
                for (var _key in node){
                    if (node.type==Syntax.Property && _key=="key"){
                        continue;
                    }
                    self.parseNode( node[_key] , _key , node);                    
                }
            }
            
        }
    }
}


function GlobalScope(node , config){

    this.name="/";
    this.type=node.type||Syntax.Program;

    this.path="/";

    util.merger(Config, config);

    this.init();

    this.build(node);

    var self=this;
    var uList=this.undefinedIdentifier;
    uList.forEach(function(u,i){
        self.variables[u.name]=self.variables[u.name]||[];
        self.variables[u.name].push(u);
    });
    this.undefinedIdentifier=[];
}

util.merger(GlobalScope.prototype, BaseScope.prototype);
util.merger(GlobalScope.prototype , {
    constructor : GlobalScope ,
    obfuscateProperties : function(properties){
        var properKeys=Object.keys(properties);
        var self=this;
        var count=properKeys.length;
        var cache={};

        var reserved={};
        for (var p in Reserved.keyword){
            reserved[p]=true;
        }
        for (var p in Reserved.global){
            reserved[p]=true;
        }
        for (var p in Reserved.property){
            reserved[p]=true;
        }
        for (var p in Reserved.dom){
            reserved[p]=true;
        }
        for (var p in Config.blackListP){
            delete reserved[p];
        }
        for (var p in Config.blackList){
            delete reserved[p];
        }
        for (var p in Config.whiteListP){
            reserved[p]=true;
        }
        for (var p in Config.whiteList){
            reserved[p]=true;
        }


        var newNames=util.getRandomNames(count, cache, reserved);
        properKeys.forEach(function(k,idx){
            if (!reserved[k]){
                self.changePropertyName(properties,k, newNames[idx]);
            }
        });
    },

    changePropertyName : function(properties,oldName,newName){
            var list=properties[oldName];
            delete properties[oldName];
            if (list){
                properties[newName]=list;
                list.forEach(function(v){
                    v.name=newName;
                })
            }
    }
});

function FunctionScope(node,parent){

    var id=node.id;
    if (!id){
        this.name=Syntax.Anonymous;
    }else{
        this.name=id.name; 
    }
    
    this.init();

    if (parent){
       this.index=parent.childScopes.length;
       parent.childScopes.push( this );
       if (this.name==Syntax.Anonymous){
            this.name+=this.index;
       }
       this.path=parent.path+"/"+this.name; 

       ScopePathMap[this.path]=this;
    }else{
        this.path="/";
    }
    // this.parent=parent||null;
    
    

    this.parameters=Object.create(null);
    if (node.params){

        this.findParams(node.params);
    }

    this.build(node);


}
util.merger(FunctionScope.prototype, BaseScope.prototype);

util.merger(FunctionScope.prototype , {

    constructor : FunctionScope ,

    findParams : function(params){
        for (var i=0,len=params.length;i<len;i++){
            var p=params[i];
            if (p.type==Syntax.Identifier){
                var name=p.name;
                this.parameters[name]=[p];
            }
        }
    }

});

function CatchScope(node , parent){


    this.type=node.type;

    this.paramName=node.param.name;
    node.param._ignore_=true;

    this.init();
    
    this.variables[this.paramName]=[
            node.param
        ];

    this.findIdentifier(node.body);

    parent.childScopes.push( this );
    BaseScope.prototype.build.call(parent, node);

}

util.merger(CatchScope.prototype, BaseScope.prototype);

util.merger(CatchScope.prototype , {

    constructor : CatchScope ,

    findIdentifier : function(node){
        var self=this;
        if (Array.isArray(node)){
            for (var i=0,len=node.length;i<len;i++){
                self.findIdentifier(node[i]);
            }
        }else if (util.isObject(node)){
            
            if (node.type==Syntax.Identifier && node.name==self.paramName){
                var name=node.name;
                var m=this.variables[name]=this.variables[name]||[];
                m.push(node);
                node._ignore_=true;
            }else{
                if ( this.isInCurrentScope(node) ){
                    for (var key in node){
                        if (node.type==Syntax.Property && key=="key"){
                            continue;
                        }
                        self.findIdentifier( node[key] );                    
                    }
                }
            }

        }
    }

});


exports.Config=Config;
exports.GlobalScope=GlobalScope;
exports.FunctionScope=FunctionScope;
exports.Properties=Properties;
exports.ScopePathMap=ScopePathMap;


}(typeof exports === 'undefined' ? (GT = {}) : exports));



