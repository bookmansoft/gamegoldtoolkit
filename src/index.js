const toolkit = exports;
toolkit.conn = require('./authConn')
if(!global) {
    global = {};
}
global.toolkit = toolkit;
