const remote = exports;
remote.conn = require('./authConn')
if(!global) {
    global = {};
}
global.remote = remote;
