/*!
 * util.js - utils for gamegold
 * Copyright (c) 2018-2020, Bookman Software (MIT License).
 */

'use strict';

const assert = require('assert');
const nodeUtil = require('util');
const aes = require('./aes');
const createHmac = require('create-hmac/browser');
const io = require('socket.io-client');
const Buffer = require('safe-buffer').Buffer

/**
 * @exports utils/util
 */

const util = exports;

/*
 * Constants
 */

const inspectOptions = {
  showHidden: false,
  depth: 20,
  colors: false,
  customInspect: true,
  showProxy: false,
  maxArrayLength: Infinity,
  breakLength: 60
};

function str_repeat(i, m) {
  for (var o = []; m > 0; o[--m] = i);
  return o.join('');
}

/**
 * 字符串模板打印函数，可以从配置表中读取字符串模板而在内存中拼装
 */
util.sprintf = function sprintf() {
  var i = 0, a, f = arguments[i++], o = [], m, p, c, x, s = '';
  while (f) {
      if (m = /^[^\x25]+/.exec(f)) {
          o.push(m[0]);
      }
      else if (m = /^\x25{2}/.exec(f)) {
          o.push('%');
      }
      else if (m = /^\x25(?:(\d+)\$)?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(f)) {
          if (((a = arguments[m[1] || i++]) == null) || (a == undefined)) {
              throw('Too few arguments.');
          }
          if (/[^s]/.test(m[7]) && (typeof(a) != 'number')) {
              throw('Expecting number but found ' + typeof(a));
          }
          switch (m[7]) {
              case 'b': a = a.toString(2); break;
              case 'c': a = String.fromCharCode(a); break;
              case 'd': a = parseInt(a); break;
              case 'e': a = m[6] ? a.toExponential(m[6]) : a.toExponential(); break;
              case 'f': a = m[6] ? parseFloat(a).toFixed(m[6]) : parseFloat(a); break;
              case 'o': a = a.toString(8); break;
              case 's': a = ((a = String(a)) && m[6] ? a.substring(0, m[6]) : a); break;
              case 'u': a = Math.abs(a); break;
              case 'x': a = a.toString(16); break;
              case 'X': a = a.toString(16).toUpperCase(); break;
          }
          a = (/[def]/.test(m[7]) && m[2] && a >= 0 ? '+'+ a : a);
          c = m[3] ? m[3] == '0' ? '0' : m[3].charAt(1) : ' ';
          x = m[5] - String(a).length - s.length;
          p = m[5] ? str_repeat(c, x) : '';
          o.push(s + (m[4] ? a + p : p + a));
      }
      else {
          throw('Huh ?!');
      }
      f = f.substring(m[0].length);
  }
  return o.join('');
}

/**
* 加密方法
* @param key    加密key
* @param iv     向量
* @param data   需要加密的数据
* @returns string
*/
util.encrypt = function encrypt(key, iv, data) {
    if(!Buffer.isBuffer(key)) {
        assert(typeof key === 'string');
        key = Buffer.from(key, 'binary')
    }

    if(!Buffer.isBuffer(iv)) {
        assert(typeof iv === 'string');
        iv = Buffer.from(iv, 'binary')
    }

    if(!Buffer.isBuffer(data)) {
        assert(typeof data === 'string');
        data = Buffer.from(data, 'binary')
    }

    var crypted = aes.encipher(data, key, iv);

    crypted = Buffer.from(crypted, 'binary');
    
    let ret = Buffer.alloc(crypted.length*2);
    for(let i = 0; i < crypted.length; i++){
        ret[2*i] = (crypted[i] >> 4) + 97;
        ret[2*i+1] = (crypted[i] & 0x0F) + 97;
    }
    return ret.toString('binary');
};

/**
* 解密方法
* @param key    解密的key
* @param iv     向量
* @param data   密文
* @returns string
*/
util.decrypt = function decrypt(key, iv, data) {
    if(!Buffer.isBuffer(key)) {
        assert(typeof key === 'string');
        key = Buffer.from(key, 'binary')
    }

    if(!Buffer.isBuffer(iv)) {
        assert(typeof iv === 'string');
        iv = Buffer.from(iv, 'binary')
    }

    if(!Buffer.isBuffer(data)) {
        assert(typeof data === 'string');
        data = Buffer.from(data, 'binary')
    }

    let ret = Buffer.alloc(data.length/2);
    for(let i = 0; i < ret.length; i++){
        ret[i] = ((data[i*2]-97)<<4) | (data[i*2+1]-97);
    }

    var decoded = aes.decipher(ret, key, iv);
    return decoded.toString('binary');
};

/**
 * Test whether a number is Number,
 * finite, and below MAX_SAFE_INTEGER.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isNumber = function isNumber(value) {
  return typeof value === 'number'
    && isFinite(value)
    && value >= -Number.MAX_SAFE_INTEGER
    && value <= Number.MAX_SAFE_INTEGER;
};

util.waiting = async function waiting(ms) {
  await (async function(){return new Promise((resolve, reject)=>{setTimeout(
    ()=>{resolve();}, ms);});})();
}

/**
 * Test whether an object is an int.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isInt = function isInt(value) {
  return Number.isSafeInteger(value);
};

/**
 * Test whether an object is a uint.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isUint = function isUint(value) {
  return util.isInt(value) && value >= 0;
};

/**
 * Test whether a number is a float.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isFloat = function isFloat(value) {
  return typeof value === 'number' && isFinite(value);
};

/**
 * Test whether a number is a positive float.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isUfloat = function isUfloat(value) {
  return util.isFloat(value) && value >= 0;
};

/**
 * Test whether an object is an int8.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI8 = function isI8(value) {
  return (value | 0) === value && value >= -0x80 && value <= 0x7f;
};

/**
 * Test whether an object is an int16.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI16 = function isI16(value) {
  return (value | 0) === value && value >= -0x8000 && value <= 0x7fff;
};

/**
 * 序列化对象，和 JSON.stringify 不同之处在于：
 *    1、排除了属性排序变化带来的影响
 *    2、主动去除了 exclude 中的属性
 * @param {Object} data      待序列化的对象
 * @param {Array?} exclude   包含所有待排除的属性名的数组
 */
util.stringify = function stringify(data, exclude) {
  if(typeof data == 'undefined') {
    return '';
  }

  if(Array.isArray(data)) {
    return data.reduce((sofar,cur)=>{
      sofar += util.stringify(cur);
      return sofar;
    }, '');
  } else if(typeof data == 'number' || typeof data == 'boolean') {
    return data.toString();
  } else if(typeof data == 'object') {
    let base = '';
    Object.keys(data).sort().map(key=>{
      if(!exclude || !exclude.includes[key]) {
          base += key + data[key];
      }
    });
    return base;
  } else if(Buffer.isBuffer(data)) {
    return data.toString('base64');
  }
  
  return data;
}

/**
 * 解析JSON数据，当发生错误时，返回传入的默认值
 */
util.parseJson = function parseJson(data, defVal) {
  try {
    return JSON.parse(data);
  }
  catch(e) {
    if(!defVal) {
      defVal = null;
    }
    
    return defVal;
  }
}

/**
 * Test whether an object is an int32.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI32 = function isI32(value) {
  return (value | 0) === value;
};

/**
 * Test whether an object is a int53.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isI64 = function isI64(value) {
  return util.isInt(value);
};

/**
 * Test whether an object is a uint8.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU8 = function isU8(value) {
  return (value & 0xff) === value;
};

/**
 * Test whether an object is a uint16.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU16 = function isU16(value) {
  return (value & 0xffff) === value;
};

/**
 * Test whether an object is a uint32.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU32 = function isU32(value) {
  return (value >>> 0) === value;
};

/**
 * Test whether an object is a uint53.
 * @param {Number?} value
 * @returns {Boolean}
 */

util.isU64 = function isU64(value) {
  return util.isUint(value);
};

/**
 * Test whether a string is a plain
 * ascii string (no control characters).
 * @param {String} str
 * @returns {Boolean}
 */

util.isAscii = function isAscii(str) {
  return typeof str === 'string' && /^[\t\n\r -~]*$/.test(str);
};

/**
 * Test whether a string is base58 (note that you
 * may get a false positive on a hex string).
 * @param {String?} str
 * @returns {Boolean}
 */

util.isBase58 = function isBase58(str) {
  return typeof str === 'string' && /^[1-9A-Za-z]+$/.test(str);
};

/**
 * Test whether a string is bech32 (note that
 * this doesn't guarantee address is bech32).
 * @param {String?} str
 * @returns {Boolean}
 */

util.isBech32 = function isBech32(str) {
  if (typeof str !== 'string')
    return false;

  if (str.toUpperCase() !== str && str.toLowerCase() !== str)
    return false;

  if (str.length < 8 || str.length > 90)
    return false;

  // it's unlikely any network will have hrp other than a-z symbols.
  return /^[a-z]{2}1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/i.test(str);
};

/**
 * Test whether a string is hex (length must be even).
 * Note that this _could_ await a false positive on
 * base58 strings.
 * @param {String?} str
 * @returns {Boolean}
 */

util.isHex = function isHex(str) {
  if (typeof str !== 'string')
    return false;
  return str.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(str);
};

/**
 * Test whether an object is a 160 bit hash (hex string).
 * @param {String?} hash
 * @returns {Boolean}
 */

util.isHex160 = function isHex160(hash) {
  if (typeof hash !== 'string')
    return false;
  return hash.length === 40 && util.isHex(hash);
};

/**
 * Test whether an object is a 256 bit hash (hex string).
 * @param {String?} hash
 * @returns {Boolean}
 */

util.isHex256 = function isHex256(hash) {
  if (typeof hash !== 'string')
    return false;
  return hash.length === 64 && util.isHex(hash);
};

/**
 * Test whether the result of a positive
 * addition would be below MAX_SAFE_INTEGER.
 * @param {Number} value
 * @returns {Boolean}
 */

util.isSafeAddition = function isSafeAddition(a, b) {
  // We only work on positive numbers.
  assert(a >= 0);
  assert(b >= 0);

  // Fast case.
  if (a <= 0xfffffffffffff && b <= 0xfffffffffffff)
    return true;

  // Do a 64 bit addition and check the top 11 bits.
  let ahi = (a * (1 / 0x100000000)) | 0;
  const alo = a | 0;

  let bhi = (b * (1 / 0x100000000)) | 0;
  const blo = b | 0;

  // Credit to @indutny for this method.
  const lo = (alo + blo) | 0;

  const s = lo >> 31;
  const as = alo >> 31;
  const bs = blo >> 31;

  const c = ((as & bs) | (~s & (as ^ bs))) & 1;

  let hi = (((ahi + bhi) | 0) + c) | 0;

  hi >>>= 0;
  ahi >>>= 0;
  bhi >>>= 0;

  // Overflow?
  if (hi < ahi || hi < bhi)
    return false;

  return (hi & 0xffe00000) === 0;
};

/**
 * util.inspect() with 20 levels of depth.
 * @param {Object|String} obj
 * @param {Boolean?} color
 * @return {String}
 */

util.inspectify = function inspectify(obj, color) {
  if (typeof obj === 'string')
    return obj;

  inspectOptions.colors = color !== false;

  return nodeUtil.inspect(obj, inspectOptions);
};

/**
 * Format a string.
 * @function
 * @param {...String} args
 * @returns {String}
 */

util.fmt = nodeUtil.format;

/**
 * Format a string.
 * @param {Array} args
 * @param {Boolean?} color
 * @return {String}
 */

util.format = function format(args, color) {
  if (args.length > 0 && args[0] && typeof args[0] === 'object') {
    if (color == null)
      color = Boolean(process.stdout && process.stdout.isTTY);
    return util.inspectify(args[0], color);
  }
  return util.fmt(...args);
};

/**
 * Write a message to stdout (console in browser).
 * @param {Object|String} obj
 * @param {...String} args
 */

util.log = function log(...args) {
  if (!process.stdout) {
    let msg;
    if (args.length > 0) {
      msg = typeof args[0] !== 'object'
        ? util.fmt(...args)
        : args[0];
    }
    console.log(msg);
    return;
  }

  const msg = util.format(args);

  process.stdout.write(msg + '\n');
};

/**
 * Write a message to stderr (console in browser).
 * @param {Object|String} obj
 * @param {...String} args
 */

util.error = function error(...args) {
  if (!process.stderr) {
    let msg;
    if (args.length > 0) {
      msg = typeof args[0] !== 'object'
        ? util.fmt(...args)
        : args[0];
    }
    console.error(msg);
    return;
  }

  const msg = util.format(args);

  process.stderr.write(msg + '\n');
};

/**
 * Return hrtime (shim for browser).
 * @param {Array} time
 * @returns {Array} [seconds, nanoseconds]
 */

util.hrtime = function hrtime(time) {
  if (!process.hrtime) {
    const now = util.ms();

    if (time) {
      const [hi, lo] = time;
      const start = hi * 1000 + lo / 1e6;
      return now - start;
    }

    const ms = now % 1000;

    // Seconds
    const hi = (now - ms) / 1000;

    // Nanoseconds
    const lo = ms * 1e6;

    return [hi, lo];
  }

  if (time) {
    const [hi, lo] = process.hrtime(time);
    return hi * 1000 + lo / 1e6;
  }

  return process.hrtime();
};

/**
 * Get current time in unix time (seconds).
 * @returns {Number}
 */

util.now = function now() {
  return Math.floor(util.ms() / 1000);
};

/**
 * Get current time in unix time (milliseconds).
 * @returns {Number}
 */

util.ms = function ms() {
  return Date.now();
};

/**
 * Create a Date ISO string from time in unix time (seconds).
 * @param {Number?} time - Seconds in unix time.
 * @returns {String}
 */

util.date = function date(time) {
  if (time == null)
    time = util.now();

  return new Date(time * 1000).toISOString().slice(0, -5) + 'Z';
};

util.dataOfUTC = function(plus) {
  if(typeof plus != 'number' || plus > 14 || plus < -12) {
    plus = (new Date().getTimezoneOffset()/60)*-1;
  }

  return new Date(Date.now() + 3600000*plus).toISOString().slice(0, -5) + (plus>=0?` +${plus}`:` ${plus}`);
}

/**
 * Get unix seconds from a Date string.
 * @param {String?} date - Date ISO String.
 * @returns {Number}
 */

util.time = function time(date) {
  if (date == null)
    return util.now();

  return new Date(date) / 1000 | 0;
};

/**
 * Get random range.
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */

util.random = function random(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
};

/**
 * Create a 32 or 64 bit nonce.
 * @param {Number} size
 * @returns {Buffer}
 */

util.nonce = function nonce(size) {
  let n, data;

  if (!size)
    size = 8;

  switch (size) {
    case 8:
      data = Buffer.allocUnsafe(8);
      n = util.random(0, 0x100000000);
      data.writeUInt32LE(n, 0, true);
      n = util.random(0, 0x100000000);
      data.writeUInt32LE(n, 4, true);
      break;
    case 4:
      data = Buffer.allocUnsafe(4);
      n = util.random(0, 0x100000000);
      data.writeUInt32LE(n, 0, true);
      break;
    default:
      assert(false, 'Bad nonce size.');
      break;
  }

  return data;
};

/**
 * String comparator (memcmp + length comparison).
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {Number} -1, 1, or 0.
 */

util.strcmp = function strcmp(a, b) {
  const len = Math.min(a.length, b.length);

  for (let i = 0; i < len; i++) {
    if (a[i] < b[i])
      return -1;
    if (a[i] > b[i])
      return 1;
  }

  if (a.length < b.length)
    return -1;

  if (a.length > b.length)
    return 1;

  return 0;
};

/**
 * Convert bytes to mb.
 * @param {Number} size
 * @returns {Number} mb
 */

util.mb = function mb(size) {
  return Math.floor(size / 1024 / 1024);
};

/**
 * Find index of a buffer in an array of buffers.
 * @param {Buffer[]} items
 * @param {Buffer} data - Target buffer to find.
 * @returns {Number} Index (-1 if not found).
 */

util.indexOf = function indexOf(items, data) {
  assert(Array.isArray(items));
  assert(Buffer.isBuffer(data));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    assert(Buffer.isBuffer(item));

    if (item.equals(data))
      return i;
  }

  return -1;
};

/**
 * Convert a number to a padded uint8
 * string (3 digits in decimal).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.pad8 = function pad8(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(10);

  switch (num.length) {
    case 1:
      return '00' + num;
    case 2:
      return '0' + num;
    case 3:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Convert a number to a padded uint32
 * string (10 digits in decimal).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.pad32 = function pad32(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(10);

  switch (num.length) {
    case 1:
      return '000000000' + num;
    case 2:
      return '00000000' + num;
    case 3:
      return '0000000' + num;
    case 4:
      return '000000' + num;
    case 5:
      return '00000' + num;
    case 6:
      return '0000' + num;
    case 7:
      return '000' + num;
    case 8:
      return '00' + num;
    case 9:
      return '0' + num;
    case 10:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Convert a number to a padded uint8
 * string (2 digits in hex).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.hex8 = function hex8(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(16);

  switch (num.length) {
    case 1:
      return '0' + num;
    case 2:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Convert a number to a padded uint32
 * string (8 digits in hex).
 * @param {Number} num
 * @returns {String} Padded number.
 */

util.hex32 = function hex32(num) {
  assert(typeof num === 'number');
  assert(num >= 0);

  num = num.toString(16);

  switch (num.length) {
    case 1:
      return '0000000' + num;
    case 2:
      return '000000' + num;
    case 3:
      return '00000' + num;
    case 4:
      return '0000' + num;
    case 5:
      return '000' + num;
    case 6:
      return '00' + num;
    case 7:
      return '0' + num;
    case 8:
      return num;
  }

  throw new Error('Number too big.');
};

/**
 * Reverse a hex-string (used because of
 * bitcoind's affinity for uint256le).
 * @param {String} data - Hex string.
 * @returns {String} Reversed hex string.
 */

util.revHex = function revHex(data) {
  assert(typeof data === 'string');
  assert(data.length > 0);
  assert(data.length % 2 === 0);

  let out = '';

  for (let i = 0; i < data.length; i += 2)
    out = data.slice(i, i + 2) + out;

  return out;
};

/**
 * Reverse an object's keys and values.
 * @param {Object} obj
 * @returns {Object} Reversed object.
 */

util.reverse = function reverse(obj) {
  const reversed = {};

  for (const key of Object.keys(obj))
    reversed[obj[key]] = key;

  return reversed;
};

/**
 * Perform a binary search on a sorted array.
 * @param {Array} items
 * @param {Object} key
 * @param {Function} compare
 * @param {Boolean?} insert
 * @returns {Number} Index.
 */

util.binarySearch = function binarySearch(items, key, compare, insert) {
  let start = 0;
  let end = items.length - 1;

  while (start <= end) {
    const pos = (start + end) >>> 1;
    const cmp = compare(items[pos], key);

    if (cmp === 0)
      return pos;

    if (cmp < 0)
      start = pos + 1;
    else
      end = pos - 1;
  }

  if (!insert)
    return -1;

  return start;
};

/**
 * Perform a binary insert on a sorted array.
 * @param {Array} items
 * @param {Object} item
 * @param {Function} compare
 * @returns {Number} index
 */

util.binaryInsert = function binaryInsert(items, item, compare, uniq) {
  const i = util.binarySearch(items, item, compare, true);

  if (uniq && i < items.length) {
    if (compare(items[i], item) === 0)
      return -1;
  }

  if (i === 0)
    items.unshift(item);
  else if (i === items.length)
    items.push(item);
  else
    items.splice(i, 0, item);

  return i;
};

/**
 * Perform a binary removal on a sorted array.
 * @param {Array} items
 * @param {Object} item
 * @param {Function} compare
 * @returns {Boolean}
 */

util.binaryRemove = function binaryRemove(items, item, compare) {
  const i = util.binarySearch(items, item, compare, false);

  if (i === -1)
    return false;

  items.splice(i, 1);

  return true;
};

/**
 * Quick test to see if a string is uppercase.
 * @param {String} str
 * @returns {Boolean}
 */

util.isUpperCase = function isUpperCase(str) {
  assert(typeof str === 'string');

  if (str.length === 0)
    return false;

  return (str.charCodeAt(0) & 32) === 0;
};

/**
 * Test to see if a string starts with a prefix.
 * @param {String} str
 * @param {String} prefix
 * @returns {Boolean}
 */

util.startsWith = function startsWith(str, prefix) {
  assert(typeof str === 'string');

  if (!str.startsWith)
    return str.indexOf(prefix) === 0;

  return str.startsWith(prefix);
};

/**
 * Get memory usage info.
 * @returns {Object}
 */

util.memoryUsage = function memoryUsage() {
  if (!process.memoryUsage) {
    return {
      total: 0,
      jsHeap: 0,
      jsHeapTotal: 0,
      nativeHeap: 0,
      external: 0
    };
  }

  const mem = process.memoryUsage();

  return {
    total: util.mb(mem.rss),
    jsHeap: util.mb(mem.heapUsed),
    jsHeapTotal: util.mb(mem.heapTotal),
    nativeHeap: util.mb(mem.rss - mem.heapTotal),
    external: util.mb(mem.external)
  };
};

/**
 * Convert int to fixed number string and reduce by a
 * power of ten (uses no floating point arithmetic).
 * @param {Number} num
 * @param {Number} exp - Number of decimal places.
 * @returns {String} Fixed number string.
 */

util.toFixed = function toFixed(num, exp) {
  assert(typeof num === 'number');
  assert(Number.isSafeInteger(num), 'Invalid integer value.');

  let sign = '';

  if (num < 0) {
    num = -num;
    sign = '-';
  }

  const mult = pow10(exp);

  let lo = num % mult;
  let hi = (num - lo) / mult;

  lo = lo.toString(10);
  hi = hi.toString(10);

  while (lo.length < exp)
    lo = '0' + lo;

  lo = lo.replace(/0+$/, '');

  assert(lo.length <= exp, 'Invalid integer value.');

  if (lo.length === 0)
    lo = '0';

  if (exp === 0)
    return `${sign}${hi}`;

  return `${sign}${hi}.${lo}`;
};

/**
 * Parse a fixed number string and multiply by a
 * power of ten (uses no floating point arithmetic).
 * @param {String} str
 * @param {Number} exp - Number of decimal places.
 * @returns {Number} Integer.
 */

util.fromFixed = function fromFixed(str, exp) {
  assert(typeof str === 'string');
  assert(str.length <= 32, 'Fixed number string too large.');

  let sign = 1;

  if (str.length > 0 && str[0] === '-') {
    str = str.substring(1);
    sign = -1;
  }

  let hi = str;
  let lo = '0';

  const index = str.indexOf('.');

  if (index !== -1) {
    hi = str.substring(0, index);
    lo = str.substring(index + 1);
  }

  hi = hi.replace(/^0+/, '');
  lo = lo.replace(/0+$/, '');

  assert(hi.length <= 16 - exp,
    'Fixed number string exceeds 2^53-1.');

  assert(lo.length <= exp,
    'Too many decimal places in fixed number string.');

  if (hi.length === 0)
    hi = '0';

  while (lo.length < exp)
    lo += '0';

  if (lo.length === 0)
    lo = '0';

  assert(/^\d+$/.test(hi) && /^\d+$/.test(lo),
    'Non-numeric characters in fixed number string.');

  hi = parseInt(hi, 10);
  lo = parseInt(lo, 10);

  const mult = pow10(exp);
  const maxLo = modSafe(mult);
  const maxHi = divSafe(mult);

  assert(hi < maxHi || (hi === maxHi && lo <= maxLo),
    'Fixed number string exceeds 2^53-1.');

  return sign * (hi * mult + lo);
};

/**
 * Convert int to float and reduce by a power
 * of ten (uses no floating point arithmetic).
 * @param {Number} num
 * @param {Number} exp - Number of decimal places.
 * @returns {Number} Double float.
 */

util.toFloat = function toFloat(num, exp) {
  return Number(util.toFixed(num, exp));
};

util.checkNum = function checkNum(num) {
  return /^[1-9]+[0-9]*]*$/.test(num);
}

/**
 * Parse a double float number and multiply by a
 * power of ten (uses no floating point arithmetic).
 * @param {Number} num
 * @param {Number} exp - Number of decimal places.
 * @returns {Number} Integer.
 */

util.fromFloat = function fromFloat(num, exp) {
  assert(typeof num === 'number' && isFinite(num));
  assert(Number.isSafeInteger(exp));
  return util.fromFixed(num.toFixed(exp), exp);
};

/*
 * Helpers
 */

function pow10(exp) {
  switch (exp) {
    case 0:
      return 1;
    case 1:
      return 10;
    case 2:
      return 100;
    case 3:
      return 1000;
    case 4:
      return 10000;
    case 5:
      return 100000;
    case 6:
      return 1000000;
    case 7:
      return 10000000;
    case 8:
      return 100000000;
  }
  throw new Error('Exponent is too large.');
}

function modSafe(mod) {
  switch (mod) {
    case 1:
      return 0;
    case 10:
      return 1;
    case 100:
      return 91;
    case 1000:
      return 991;
    case 10000:
      return 991;
    case 100000:
      return 40991;
    case 1000000:
      return 740991;
    case 10000000:
      return 4740991;
    case 100000000:
      return 54740991;
  }
  throw new Error('Exponent is too large.');
}

function divSafe(div) {
  switch (div) {
    case 1:
      return 9007199254740991;
    case 10:
      return 900719925474099;
    case 100:
      return 90071992547409;
    case 1000:
      return 9007199254740;
    case 10000:
      return 900719925474;
    case 100000:
      return 90071992547;
    case 1000000:
      return 9007199254;
    case 10000000:
      return 900719925;
    case 100000000:
      return 90071992;
  }
  throw new Error('Exponent is too large.');
}

/**
 * 客户端请求返回值，统一定义所有的错误码，每100个为一个大类
 */
const ReturnCode = {
    Success: 0,         //操作成功
};

/**
 * 通讯连接状态
 */
const CommStatus = {
  lb:         1,      //已经执行了LB重定位
  sign:       2,      //已经获得签名数据
  signCode:   4,      //已经获得签名数据
  logined:    8,      //已经成功登录
  reqSign:    2^30,   //需要获取两阶段认证的签名数据
  reqLb:      2^31,   //需要执行负载均衡
}

const ReturnCodeName = {
	0: '操作成功',
}

const CommMode = {
    ws: "webSocket",    //Web Socket
    get: "get",         //HTTP GET
    post: "post",       //HTTP POST
}

/**
 * 下行消息类型
 */
const NotifyType = {
    none: 0,            //测试消息
    test: 9999,            //测试消息
};

function Base64() {
	// private property
	const _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
 
	// private method for UTF-8 encoding
	const _utf8_encode = function (string) {
		string = string.replace(/\r\n/g,"\n");
		var utftext = "";
		for (var n = 0; n < string.length; n++) {
			var c = string.charCodeAt(n);
			if (c < 128) {
				utftext += String.fromCharCode(c);
			} else if((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			} else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
 
		}
		return utftext;
	}
 
	// private method for UTF-8 decoding
	const _utf8_decode = function (utftext) {
		var string = "";
		var i = 0;
		var c = c1 = c2 = 0;
		while ( i < utftext.length ) {
			c = utftext.charCodeAt(i);
			if (c < 128) {
				string += String.fromCharCode(c);
				i++;
			} else if((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i+1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else {
				c2 = utftext.charCodeAt(i+1);
				c3 = utftext.charCodeAt(i+2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}
		}
		return string;
	}

  // public method for encoding
	this.encode = function (input) {
		var output = "";
		var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		var i = 0;
		input = _utf8_encode(input);
		while (i < input.length) {
			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);
			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;
			if (isNaN(chr2)) {
				enc3 = enc4 = 64;
			} else if (isNaN(chr3)) {
				enc4 = 64;
			}
			output = output +
			_keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
			_keyStr.charAt(enc3) + _keyStr.charAt(enc4);
		}
		return output;
	}
 
	// public method for decoding
	this.decode = function (input) {
		var output = "";
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;
		input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
		while (i < input.length) {
			enc1 = _keyStr.indexOf(input.charAt(i++));
			enc2 = _keyStr.indexOf(input.charAt(i++));
			enc3 = _keyStr.indexOf(input.charAt(i++));
			enc4 = _keyStr.indexOf(input.charAt(i++));
			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;
			output = output + String.fromCharCode(chr1);
			if (enc3 != 64) {
				output = output + String.fromCharCode(chr2);
			}
			if (enc4 != 64) {
				output = output + String.fromCharCode(chr3);
			}
		}
		output = _utf8_decode(output);
		return output;
	}
}

/**
 * 利用HMAC算法，以及令牌固定量和令牌随机量，计算访问令牌
 * @param {*} token
 * @param {*} random
 */
function signHMAC(token, random) {
    var hmac = createHmac('sha256', random);
    let sig = hmac.update(token).digest('hex');
    return sig;
}

/**
 * 扩展对象，用于多个对象之间的属性注入
 * @note 对属性(get set)复制不会成功
 * @returns {*|{}}
 */
function extendObj(){
    /*
 　　*target被扩展的对象
　 　*length参数的数量
　　 *deep是否深度操作
　　*/
    var options, name, src, copy, copyIsArray, clone,
        target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false;

    // target为第一个参数，如果第一个参数是Boolean类型的值，则把target赋值给deep
    // deep表示是否进行深层面的复制，当为true时，进行深度复制，否则只进行第一层扩展
    // 然后把第二个参数赋值给target
    if ( typeof target === "boolean" ) {
        deep = target;
        target = arguments[1] || {};

        // 将i赋值为2，跳过前两个参数
        i = 2;
    }

    // target既不是对象也不是函数则把target设置为空对象。
    if ( typeof target !== "object" && !(target.constructor == Function) ) {
        target = {};
    }

    // 如果只有一个参数，则把jQuery对象赋值给target，即扩展到jQuery对象上
    if ( length === i ) {
        target = this;

        // i减1，指向被扩展对象
        --i;
    }

    // 开始遍历需要被扩展到target上的参数
    for ( ; i < length; i++ ) {
        // 处理第i个被扩展的对象，即除去deep和target之外的对象
        if ( (options = arguments[ i ]) != null ) {
            // 遍历第i个对象的所有可遍历的属性
            for ( name in options ) {
                // 根据被扩展对象的键获得目标对象相应值，并赋值给src
                src = target[ name ];
                // 得到被扩展对象的值
                copy = options[ name ];

                if ( src === copy ) {
                    continue;
                }

                // 当用户想要深度操作时，递归合并
                // copy是纯对象或者是数组
                if ( deep && copy && ( (copy.constructor == Object) || (copyIsArray = (copy.constructor == Array)) ) ) {
                    // 如果是数组
                    if ( copyIsArray ) {
                        // 将copyIsArray重新设置为false，为下次遍历做准备。
                        copyIsArray = false;
                        // 判断被扩展的对象中src是不是数组
                        clone = src && (src.constructor == Array) ? src : [];
                    } else {
                        // 判断被扩展的对象中src是不是纯对象
                        clone = src && (src.constructor == Object) ? src : {};
                    }

                    // 递归调用extend方法，继续进行深度遍历
                    target[ name ] = extendObj( deep, clone, copy );
                } else if ( copy !== undefined ) {// 如果不需要深度复制，则直接copy（第i个被扩展对象中被遍历的那个键的值）
                    target[ name ] = copy;
                }
            }
        }
    }

    // 原对象被改变，因此如果不想改变原对象，target可传入{}
    return target;
};

/**
 * 复制一个对象
 * @param obj
 * @returns {*}
 */
function clone(obj) {
    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    if (obj instanceof Date) {// Handle Date
        let copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }
    else if (obj instanceof Array) {// Handle Array
        let copy = [];
        for (let i = 0, len = obj.length; i < len; ++i) {
            copy[i] = clone(obj[i]);
        }
        return copy;
    }
    else if (obj instanceof Object) {// Handle Object
        let copy = {};
        for (let attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}

util.io = io;
util.Base64 = Base64;
util.signHMAC = signHMAC;
util.ReturnCode = ReturnCode;
util.ReturnCodeName = ReturnCodeName;
util.CommMode = CommMode;
util.NotifyType = NotifyType;
util.createHmac = createHmac;
util.extendObj = extendObj;
util.clone = clone;
util.CommStatus = CommStatus;
