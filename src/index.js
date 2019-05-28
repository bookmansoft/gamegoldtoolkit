/**
 * 取数组随机对象
 */
Array.prototype.randObj = function(){
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
const {encrypt, decrypt} = require('./util');

//游戏金链连接器
toolkit.conn = require('./authConn');

//游戏云连接器
toolkit.gameconn = require('./gameConn');

//校验函数
let {verifyData, generateKey, signObj, verifyObj, verifyAddress} = require('./verifyData');
toolkit.generateKey = generateKey;
toolkit.signObj = signObj;
toolkit.verifyObj = verifyObj;
toolkit.verifyData = verifyData;
toolkit.verifyAddress = verifyAddress;

//AES加解密函数
toolkit.encrypt = encrypt;
toolkit.decrypt = decrypt;

global.toolkit = toolkit;
