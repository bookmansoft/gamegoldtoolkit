/**
 * 为数组添加方法：取随机对象
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

const assert = require('./utils/assert')
const {CommStatus, createHmac, ReturnCode, CommMode, NotifyType, encrypt, decrypt, stringify} = require('./utils/util');
let {sha1, hash160, hash256, verifyData, generateKey, signObj, verifyObj, verifyAddress} = require('./utils/verifyData');
const Secret = require('./utils/secret')

const toolkit = exports;

//主网连接器
toolkit.conn = require('./authConn');

//游戏云连接器
toolkit.gameconn = require('./gameConn');

//实用函数列表
toolkit.assert = assert;
toolkit.stringify = stringify;
toolkit.encrypt = encrypt;
toolkit.decrypt = decrypt;
toolkit.verifyData = verifyData;
toolkit.generateKey = generateKey;
toolkit.signObj = signObj;
toolkit.verifyObj = verifyObj;
toolkit.verifyAddress = verifyAddress;
toolkit.CommMode = CommMode;
toolkit.CommStatus = CommStatus;
toolkit.ReturnCode = ReturnCode;
toolkit.NotifyType = NotifyType;
toolkit.createHmac = createHmac;
toolkit.Secret = Secret;
toolkit.hash256 = hash256;
toolkit.hash160 = hash160;
toolkit.sha1 = sha1;

global.toolkit = toolkit;
