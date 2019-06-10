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
toolkit.assert = assert;
toolkit.conn.prototype.assert = assert;
toolkit.gameconn.prototype.assert = assert;

toolkit.stringify = stringify;
toolkit.conn.prototype.stringify = stringify;
toolkit.gameconn.prototype.stringify = stringify;

toolkit.encrypt = encrypt;
toolkit.conn.prototype.encrypt = encrypt;
toolkit.gameconn.prototype.encrypt = encrypt;

toolkit.decrypt = decrypt;
toolkit.conn.prototype.decrypt = decrypt;
toolkit.gameconn.prototype.decrypt = decrypt;

toolkit.verifyData = verifyData;
toolkit.conn.prototype.verifyData = verifyData;
toolkit.gameconn.prototype.verifyData = verifyData;

toolkit.generateKey = generateKey;
toolkit.conn.prototype.generateKey = generateKey;
toolkit.gameconn.prototype.generateKey = generateKey;

toolkit.signObj = signObj;
toolkit.conn.prototype.signObj = signObj;
toolkit.gameconn.prototype.signObj = signObj;

toolkit.verifyObj = verifyObj;
toolkit.conn.prototype.verifyObj = verifyObj;
toolkit.gameconn.prototype.verifyObj = verifyObj;

toolkit.verifyAddress = verifyAddress;
toolkit.conn.prototype.verifyAddress = verifyAddress;
toolkit.gameconn.prototype.verifyAddress = verifyAddress;

global.toolkit = toolkit;
