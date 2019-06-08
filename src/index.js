/**
 * 取数组随机对象
 */
Array.prototype.randObj = function() {
    if(this.length == 0){
        return null;
    }
    else if(this.length == 1){
        return this[0];
    }
    else{
        return this[(Math.random()*this.length)|0];
    }
}

const toolkit = exports;

const assert = require('./utils/assert')
const {encrypt, decrypt, stringify} = require('./utils/util');
let {verifyData, generateKey, signObj, verifyObj, verifyAddress} = require('./utils/verifyData');

//主网连接器
toolkit.conn = require('./authConn');

//游戏云连接器
toolkit.gameconn = require('./gameConn');

//实用函数列表
[assert, stringify, encrypt, decrypt, verifyData, generateKey, signObj, verifyObj, verifyAddress].map(func=>{
    toolkit[func.name] = func;
    toolkit.conn.prototype[func.name] = func;
    toolkit.gameconn.prototype[func.name] = func;
});

global.toolkit = toolkit;
