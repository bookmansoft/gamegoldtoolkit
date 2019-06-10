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
let {hash256, verifyData, generateKey, signObj, verifyObj, verifyAddress} = require('./utils/verifyData');
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

toolkit.conn.prototype.assert = assert;
toolkit.conn.prototype.stringify = stringify;
toolkit.conn.prototype.encrypt = encrypt;
toolkit.conn.prototype.decrypt = decrypt;
toolkit.conn.prototype.verifyData = verifyData;
toolkit.conn.prototype.generateKey = generateKey;
toolkit.conn.prototype.signObj = signObj;
toolkit.conn.prototype.verifyObj = verifyObj;
toolkit.conn.prototype.verifyAddress = verifyAddress;
toolkit.conn.prototype.CommMode = CommMode;
toolkit.conn.prototype.CommStatus = CommStatus;
toolkit.conn.prototype.ReturnCode = ReturnCode;
toolkit.conn.prototype.NotifyType = NotifyType;
toolkit.conn.prototype.createHmac = createHmac;
toolkit.conn.prototype.Secret = Secret;
toolkit.conn.prototype.hash256 = hash256;

toolkit.gameconn.prototype.assert = assert;
toolkit.gameconn.prototype.stringify = stringify;
toolkit.gameconn.prototype.encrypt = encrypt;
toolkit.gameconn.prototype.decrypt = decrypt;
toolkit.gameconn.prototype.verifyData = verifyData;
toolkit.gameconn.prototype.generateKey = generateKey;
toolkit.gameconn.prototype.signObj = signObj;
toolkit.gameconn.prototype.verifyObj = verifyObj;
toolkit.gameconn.prototype.verifyAddress = verifyAddress;
toolkit.gameconn.prototype.CommMode = CommMode;
toolkit.gameconn.prototype.CommStatus = CommStatus;
toolkit.gameconn.prototype.ReturnCode = ReturnCode;
toolkit.gameconn.prototype.NotifyType = NotifyType;
toolkit.gameconn.prototype.createHmac = createHmac;
toolkit.gameconn.prototype.Secret = Secret;
toolkit.gameconn.prototype.hash256 = hash256;

global.toolkit = toolkit;
