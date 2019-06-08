/*!
 * poly1305.js - poly1305 for gamegold
 * Copyright (c) 2018-2020, Bookman Software (MIT License).
 * https://gitee.com/bookmanSoftware/ggserver
 */

'use strict';

/**
 * Poly1305 (used for bip151)
 * @alias module:crypto/chachapoly.Poly1305
 * @constructor
 * @see https://github.com/floodyberry/poly1305-donna
 * @see https://tools.ietf.org/html/rfc7539#section-2.5
 */

function Poly1305() {
  if (!(this instanceof Poly1305))
    return new Poly1305();

  this.r = new Uint16Array(10);
  this.h = new Uint16Array(10);
  this.pad = new Uint16Array(8);
  this.fin = 0;
  this.leftover = 0;
  this.buffer = Buffer.allocUnsafe(16);
}

/**
 * Initialize poly1305 with a key.
 * @param {Buffer} key
 */

Poly1305.prototype.init = function init(key) {
  // r &= 0xffffffc0ffffffc0ffffffc0fffffff
  const t0 = key.readUInt16LE(0, true);
  const t1 = key.readUInt16LE(2, true);
  const t2 = key.readUInt16LE(4, true);
  const t3 = key.readUInt16LE(6, true);
  const t4 = key.readUInt16LE(8, true);
  const t5 = key.readUInt16LE(10, true);
  const t6 = key.readUInt16LE(12, true);
  const t7 = key.readUInt16LE(14, true);

  this.r[0] = t0 & 0x1fff;
  this.r[1] = ((t0 >>> 13) | (t1 << 3)) & 0x1fff;
  this.r[2] = ((t1 >>> 10) | (t2 << 6)) & 0x1f03;
  this.r[3] = ((t2 >>> 7) | (t3 << 9)) & 0x1fff;
  this.r[4] = ((t3 >>> 4) | (t4 << 12)) & 0x00ff;
  this.r[5] = (t4 >>> 1) & 0x1ffe;
  this.r[6] = ((t4 >>> 14) | (t5 << 2)) & 0x1fff;
  this.r[7] = ((t5 >>> 11) | (t6 << 5)) & 0x1f81;
  this.r[8] = ((t6 >>> 8) | (t7 << 8)) & 0x1fff;
  this.r[9] = (t7 >>> 5) & 0x007f;

  // h = 0
  for (let i = 0; i < 10; i++)
    this.h[i] = 0;

  // save pad for later
  for (let i = 0; i < 8; i++)
    this.pad[i] = key.readUInt16LE(16 + (2 * i), true);

  this.leftover = 0;
  this.fin = 0;
};

/**
 * Process 16 byte blocks.
 * @param {Buffer} data - Blocks.
 * @param {Number} bytes - Size.
 * @param {Number} m - Offset pointer.
 */

Poly1305.prototype.blocks = function blocks(data, bytes, m) {
  const hibit = this.fin ? 0 : (1 << 11); // 1 << 128
  const d = new Uint32Array(10);

  while (bytes >= 16) {
    // h += m[i]
    const t0 = data.readUInt16LE(m + 0, true);
    const t1 = data.readUInt16LE(m + 2, true);
    const t2 = data.readUInt16LE(m + 4, true);
    const t3 = data.readUInt16LE(m + 6, true);
    const t4 = data.readUInt16LE(m + 8, true);
    const t5 = data.readUInt16LE(m + 10, true);
    const t6 = data.readUInt16LE(m + 12, true);
    const t7 = data.readUInt16LE(m + 14, true);

    this.h[0] += t0 & 0x1fff;
    this.h[1] += ((t0 >>> 13) | (t1 << 3)) & 0x1fff;
    this.h[2] += ((t1 >>> 10) | (t2 << 6)) & 0x1fff;
    this.h[3] += ((t2 >>> 7) | (t3 << 9)) & 0x1fff;
    this.h[4] += ((t3 >>> 4) | (t4 << 12)) & 0x1fff;
    this.h[5] += ((t4 >>> 1)) & 0x1fff;
    this.h[6] += ((t4 >>> 14) | (t5 << 2)) & 0x1fff;
    this.h[7] += ((t5 >>> 11) | (t6 << 5)) & 0x1fff;
    this.h[8] += ((t6 >>> 8) | (t7 << 8)) & 0x1fff;
    this.h[9] += ((t7 >>> 5)) | hibit;

    // h *= r, (partial) h %= p
    let c = 0;
    for (let i = 0; i < 10; i++) {
      d[i] = c;

      for (let j = 0; j < 10; j++) {
        let a = this.h[j];

        if (j <= i)
          a *= this.r[i - j];
        else
          a *= 5 * this.r[i + 10 - j];

        d[i] += a;

        // Sum(h[i] * r[i] * 5) will overflow slightly
        // above 6 products with an unclamped r, so
        // carry at 5
        if (j === 4) {
          c = d[i] >>> 13;
          d[i] &= 0x1fff;
        }
      }

      c += d[i] >>> 13;
      d[i] &= 0x1fff;
    }

    c = (c << 2) + c; // c *= 5
    c += d[0];
    d[0] = (c & 0x1fff);
    c = c >>> 13;
    d[1] += c;

    for (let i = 0; i < 10; i++)
      this.h[i] = d[i];

    m += 16;
    bytes -= 16;
  }
};

/**
 * Update the MAC with data (will be
 * processed as 16 byte blocks).
 * @param {Buffer} data
 */

Poly1305.prototype.update = function update(data) {
  let bytes = data.length;
  let m = 0;

  // handle leftover
  if (this.leftover) {
    let want = 16 - this.leftover;

    if (want > bytes)
      want = bytes;

    for (let i = 0; i < want; i++)
      this.buffer[this.leftover + i] = data[m + i];

    bytes -= want;
    m += want;

    this.leftover += want;

    if (this.leftover < 16)
      return;

    this.blocks(this.buffer, 16, 0);
    this.leftover = 0;
  }

  // process full blocks
  if (bytes >= 16) {
    const want = bytes & ~(16 - 1);
    this.blocks(data, want, m);
    m += want;
    bytes -= want;
  }

  // store leftover
  if (bytes) {
    for (let i = 0; i < bytes; i++)
      this.buffer[this.leftover + i] = data[m + i];
    this.leftover += bytes;
  }
};

/**
 * Finalize and return a 16-byte MAC.
 * @returns {Buffer}
 */

Poly1305.prototype.finish = function finish() {
  const mac = Buffer.allocUnsafe(16);
  const g = new Uint16Array(10);

  // process the remaining block
  if (this.leftover) {
    let i = this.leftover;
    this.buffer[i++] = 1;
    for (; i < 16; i++)
      this.buffer[i] = 0;
    this.fin = 1;
    this.blocks(this.buffer, 16, 0);
  }

  // fully carry h
  let c = this.h[1] >>> 13;
  this.h[1] &= 0x1fff;
  for (let i = 2; i < 10; i++) {
    this.h[i] += c;
    c = this.h[i] >>> 13;
    this.h[i] &= 0x1fff;
  }
  this.h[0] += c * 5;
  c = this.h[0] >>> 13;
  this.h[0] &= 0x1fff;
  this.h[1] += c;
  c = this.h[1] >>> 13;
  this.h[1] &= 0x1fff;
  this.h[2] += c;

  // compute h + -p
  g[0] = this.h[0] + 5;
  c = g[0] >>> 13;
  g[0] &= 0x1fff;
  for (let i = 1; i < 10; i++) {
    g[i] = this.h[i] + c;
    c = g[i] >>> 13;
    g[i] &= 0x1fff;
  }

  // select h if h < p, or h + -p if h >= p
  let mask = (c ^ 1) - 1;
  for (let i = 0; i < 10; i++)
    g[i] &= mask;
  mask = ~mask;
  for (let i = 0; i < 10; i++)
    this.h[i] = (this.h[i] & mask) | g[i];

  // h = h % (2^128)
  this.h[0] = ((this.h[0]) | (this.h[1] << 13)) & 0xffff;
  this.h[1] = ((this.h[1] >>> 3) | (this.h[2] << 10)) & 0xffff;
  this.h[2] = ((this.h[2] >>> 6) | (this.h[3] << 7)) & 0xffff;
  this.h[3] = ((this.h[3] >>> 9) | (this.h[4] << 4)) & 0xffff;
  this.h[4] = ((this.h[4] >>> 12)
    | (this.h[5] << 1) | (this.h[6] << 14)) & 0xffff;
  this.h[5] = ((this.h[6] >>> 2) | (this.h[7] << 11)) & 0xffff;
  this.h[6] = ((this.h[7] >>> 5) | (this.h[8] << 8)) & 0xffff;
  this.h[7] = ((this.h[8] >>> 8) | (this.h[9] << 5)) & 0xffff;

  // mac = (h + pad) % (2^128)
  let f = this.h[0] + this.pad[0];
  this.h[0] = f;
  for (let i = 1; i < 8; i++) {
    f = this.h[i] + this.pad[i] + (f >>> 16);
    this.h[i] = f;
  }

  for (let i = 0; i < 8; i++)
    mac.writeUInt16LE(this.h[i], i * 2, true);

  // zero out the state
  for (let i = 0; i < 10; i++)
    this.h[i] = 0;

  for (let i = 0; i < 10; i++)
    this.r[i] = 0;

  for (let i = 0; i < 8; i++)
    this.pad[i] = 0;

  return mac;
};

/**
 * Return a MAC for a message and key.
 * @param {Buffer} msg
 * @param {Buffer} key
 * @returns {Buffer} MAC
 */

Poly1305.auth = function auth(msg, key) {
  const poly = new Poly1305();
  poly.init(key);
  poly.update(msg);
  return poly.finish();
};

/**
 * Compare two MACs in constant time.
 * @param {Buffer} mac1
 * @param {Buffer} mac2
 * @returns {Boolean}
 */

Poly1305.verify = function verify(mac1, mac2) {
  let dif = 0;

  // Compare in constant time.
  for (let i = 0; i < 16; i++)
    dif |= mac1[i] ^ mac2[i];

  dif = (dif - 1) >>> 31;

  return (dif & 1) !== 0;
};

/*
 * Expose
 */

module.exports = Poly1305;
