const toolkit = exports;

toolkit.conn = require('./authConn');
toolkit.verifyData = require('./verifyData');
toolkit.gameconn = require('./gameConn');

global.toolkit = toolkit;
