const toolkit = exports;

toolkit.conn = require('./authConn');
toolkit.verifyData = require('./verifyData');

global.toolkit = toolkit;
