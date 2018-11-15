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

toolkit.conn = require('./authConn');
toolkit.verifyData = require('./verifyData');
toolkit.gameconn = require('./gameConn');

global.toolkit = toolkit;
