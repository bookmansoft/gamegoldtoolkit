/*!
 * hkdf.js - hkdf for gamegold
 * Copyright (c) 2018-2020, Bookman Software (MIT License).
 * https://gitee.com/bookmanSoftware/ggserver
 */

'use strict';

/**
 * @module crypto/hkdf
 */

const digest = require('./digest');

/**
 * Perform hkdf extraction.
 * @param {Buffer} ikm
 * @param {Buffer} key
 * @param {String} alg
 * @returns {Buffer}
 */

exports.extract = function extract(ikm, key, alg) {
  return digest.hmac(alg, ikm, key);
};

/**
 * Perform hkdf expansion.
 * @param {Buffer} prk
 * @param {Buffer} info
 * @param {Number} len
 * @param {String} alg
 * @returns {Buffer}
 */

exports.expand = function expand(prk, info, len, alg) {
  const size = digest.hash(alg, Buffer.alloc(0)).length;
  const blocks = Math.ceil(len / size);

  if (blocks > 255)
    throw new Error('Too many blocks.');

  const okm = Buffer.allocUnsafe(len);

  if (blocks === 0)
    return okm;

  const buf = Buffer.allocUnsafe(size + info.length + 1);

  // First round:
  info.copy(buf, size);
  buf[buf.length - 1] = 1;

  let out = digest.hmac(alg, buf.slice(size), prk);
  out.copy(okm, 0);

  for (let i = 1; i < blocks; i++) {
    out.copy(buf, 0);
    buf[buf.length - 1]++;
    out = digest.hmac(alg, buf, prk);
    out.copy(okm, i * size);
  }

  return okm;
};
