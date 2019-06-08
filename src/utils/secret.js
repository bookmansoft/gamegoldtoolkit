'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const secp256k1 = require('./secp256k1');
const digest = require('./digest');
const ChaCha20 = require('./chacha20');
const Poly1305 = require('./poly1305');
const AEAD = require('./aead');
const hkdf = require('./hkdf');
const StaticWriter = require('./staticwriter');
const BufferReader = require('./reader');
const encoding = require('./encoding');
const util = require('./util');

class Encack
{
    constructor(publicKey) {
        this.publicKey = publicKey || encoding.ZERO_KEY;
    }
}

class Encinit
{
    constructor(publicKey, cipher) {
        this.publicKey = publicKey || encoding.ZERO_KEY;
        this.cipher = cipher || 0;
    }
}

/*
 * Constants
 */

const HKDF_SALT = Buffer.from('bitcoinecdh', 'ascii');
const INFO_KEY1 = Buffer.from('BitcoinK1', 'ascii');
const INFO_KEY2 = Buffer.from('BitcoinK2', 'ascii');
const INFO_SID = Buffer.from('BitcoinSessionID', 'ascii');
const HIGH_WATERMARK = 1024 * (1 << 20);

/**
 * Represents a BIP151 input or output stream.
 * @alias module:net.BIP151Stream
 * @constructor
 * @param {Number} cipher
 * @property {Buffer} publicKey
 * @property {Buffer} privateKey
 * @property {Number} cipher
 * @property {Buffer} k1
 * @property {Buffer} k2
 * @property {Buffer} sid
 * @property {ChaCha20} chacha
 * @property {AEAD} aead
 * @property {Buffer} tag
 * @property {Number} seq
 * @property {Number} processed
 * @property {Number} lastKey
 */

class SecretStream
{
  constructor(options) {
    options = options || {};

    if(typeof options.cipher != 'undefined') {
      this.cipher = options.cipher;
    } else {
      this.cipher = Secret.ciphers.CHACHAPOLY;
    }

    if(typeof options.privateKey != 'undefined') {
      this.privateKey = options.privateKey;
    } else {
      this.privateKey = secp256k1.generatePrivateKey();
    }

    this.publicKey = null;
    this.k1 = null;
    this.k2 = null;
    this.sid = null;
  
    this.chacha = new ChaCha20();
    this.aead = new AEAD();
    this.tag = null;
    this.seq = 0;
    this.iv = Buffer.allocUnsafe(8);
    this.iv.fill(0);
  
    this.processed = 0;
    this.lastRekey = 0;
  }

  /**
   * Initialize the stream with peer's public key.
   * Computes ecdh secret and chacha keys.
   * @param {Buffer} publicKey
   */

  init(publicKey) {
    assert(Buffer.isBuffer(publicKey));

    this.publicKey = publicKey;

    const secret = secp256k1.ecdh(this.publicKey, this.privateKey); 
    const bw = StaticWriter.pool(33);

    bw.writeBytes(secret);
    bw.writeU8(this.cipher);

    const data = bw.render();
    const prk = hkdf.extract(data, HKDF_SALT, 'sha256');

    this.k1 = hkdf.expand(prk, INFO_KEY1, 32, 'sha256');
    this.k2 = hkdf.expand(prk, INFO_KEY2, 32, 'sha256');
    this.sid = hkdf.expand(prk, INFO_SID, 32, 'sha256');

    this.seq = 0;

    this.update();

    this.chacha.init(this.k1, this.iv);
    this.aead.init(this.k2, this.iv);

    this.lastRekey = util.now();
  };

  /**
   * Add buffer size to `processed`,
   * check whether we need to rekey.
   * @param {Buffer} packet
   * @returns {Boolean}
   */

  shouldRekey(packet) {
    const now = util.now();

    this.processed += packet.length;

    if (now >= this.lastRekey + 10
        || this.processed >= HIGH_WATERMARK) {
      this.lastRekey = now;
      this.processed = 0;
      return true;
    }

    return false;
  };

  /**
   * Generate new chacha keys with `key = HASH256(sid | key)`.
   * This will reinitialize the state of both ciphers.
   */

  rekey(k1, k2) {
    assert(this.sid, 'Cannot rekey before initialization.');

    if (!k1) {
      this.k1 = digest.root256(this.sid, this.k1);
      this.k2 = digest.root256(this.sid, this.k2);
    } else {
      this.k1 = k1;
      this.k2 = k2;
    }

    assert(this.k1);
    assert(this.k2);

    // All state is reinitialized
    // aside from the sequence number.
    this.chacha.init(this.k1, this.iv);
    this.aead.init(this.k2, this.iv);
  };

  /**
   * Increment packet sequence number and update IVs
   * (note, sequence number overflows after 2^64-1).
   * The IV will be updated without reinitializing
   * cipher state.
   */

  sequence() {
    // Wrap sequence number a la openssh.
    if (++this.seq === 0x100000000)
      this.seq = 0;

    this.update();

    // State of the ciphers is
    // unaltered aside from the iv.
    this.chacha.init(null, this.iv);
    this.aead.init(null, this.iv);
  };

  /**
   * Render the IV necessary for cipher streams.
   * @returns {Buffer}
   */

  update() {
    this.iv.writeUInt32LE(this.seq, 0, true);
    return this.iv;
  };

  /**
   * Get public key tied to private key
   * (not the same as BIP151Stream#publicKey).
   * @returns {Buffer}
   */

  getPublicKey() {
    return secp256k1.publicKeyCreate(this.privateKey, true);
  };

  /**
   * Encrypt a payload size with k1.
   * @param {Buffer} data
   * @returns {Buffer}
   */

  encryptSize(data) {
    return this.chacha.encrypt(data.slice(0, 4));
  };

  /**
   * Decrypt payload size with k1.
   * @param {Buffer} data
   * @returns {Number}
   */

  decryptSize(data) {
    this.chacha.encrypt(data);
    return data.readUInt32LE(0, true);
  };

  /**
   * Encrypt payload with AEAD (update cipher and mac).
   * @param {Buffer} data
   * @returns {Buffer} data
   */

  encrypt(data) {
    return this.aead.encrypt(data);
  };

  /**
   * Decrypt payload with AEAD (update cipher only).
   * @param {Buffer} data
   * @returns {Buffer} data
   */

  decrypt(data) {
    return this.aead.chacha20.encrypt(data);
  };

  /**
   * Authenticate payload with AEAD (update mac only).
   * @param {Buffer} data
   * @returns {Buffer} data
   */

  auth(data) {
    return this.aead.auth(data);
  };

  /**
   * Finalize AEAD and compute MAC.
   * @returns {Buffer}
   */

  finish() {
    this.tag = this.aead.finish();
    return this.tag;
  };

  /**
   * Verify tag against mac in constant time.
   * @param {Buffer} tag
   * @returns {Boolean}
   */

  verify(tag) {
    return Poly1305.verify(this.tag, tag);
  };
}

/**
 * Represents a BIP151 input and output stream.
 * Holds state for peer communication.
 * @alias module:net.BIP151
 * @constructor
 * @param {Object} options
 * @property {BIP151Stream} input
 * @property {BIP151Stream} output
 * @property {Boolean} initReceived
 * @property {Boolean} ackReceived
 * @property {Boolean} initSent
 * @property {Boolean} ackSent
 * @property {Object} timeout
 * @property {Job} job
 * @property {Boolean} completed
 * @property {Boolean} handshake
 */

class Secret extends EventEmitter
{
  constructor(options) {
    super();

    this.input = new SecretStream(options);
    this.output = new SecretStream(options);
  
    this.initReceived = false;
    this.ackReceived = false;
    this.initSent = false;
    this.ackSent = false;
    this.completed = false;
    this.handshake = false;
  
    this.pending = [];
    this.total = 0;
    this.waiting = 4;
    this.hasSize = false;
  
    this.timeout = null;
    this.job = null;
    this.onShake = null;
  
    this.bip150 = null;
  }

  /**
   * Emit an error.
   * @param {...String} msg
   */

  error() {
    const msg = util.fmt.apply(util, arguments);
    this.emit('error', new Error(msg));
  };

  /**
   * Test whether handshake has completed.
   * @returns {Boolean}
   */

  isReady() {
    return this.initSent
      && this.ackReceived
      && this.initReceived
      && this.ackSent;
  };

  /**
   * Render an `encinit` packet. Contains the
   * input public key and cipher number.
   * @returns {Buffer}
   */

  toEncinit() {
    assert(!this.initSent, 'Cannot init twice.');
    this.initSent = true;
    return new Encinit(this.input.getPublicKey(), this.input.cipher);
  };

  /**
   * Render `encack` packet. Contains the
   * output stream public key.
   * @returns {Buffer}
   */

  toEncack() {
    assert(this.output.sid, 'Cannot ack before init.');
    assert(!this.ackSent, 'Cannot ack twice.');
    this.ackSent = true;

    if (this.isReady()) {
      assert(!this.completed, 'No encack after timeout.');
      this.handshake = true;
      this.emit('handshake');
    }

    return new Encack(this.output.getPublicKey());
  };

  /**
   * Render `encack` packet with an all
   * zero public key, notifying of a rekey
   * for the output stream.
   * @returns {Buffer}
   */

  toRekey() {
    assert(this.handshake, 'Cannot rekey before handshake.');
    return new Encack(encoding.ZERO_KEY);
  };

  /**
   * Handle `encinit` from remote peer.
   * @param {Buffer}
   */

  encinit(publicKey, cipher) {
    assert(cipher === this.output.cipher, 'Cipher mismatch.');
    assert(!this.initReceived, 'Already initialized.');
    assert(!this.completed, 'No encinit after timeout.');
    this.initReceived = true;
    this.output.init(publicKey);
  };

  /**
   * Handle `encack` from remote peer.
   * @param {Buffer} data
   */

  encack(publicKey) {
    assert(this.initSent, 'Unsolicited ACK.');

    if (publicKey.equals(encoding.ZERO_KEY)) {
      assert(this.handshake, 'No initialization before rekey.');

      if (this.bip150 && this.bip150.auth) {
        this.bip150.rekeyInput();
        return;
      }

      this.input.rekey();

      return;
    }

    assert(!this.ackReceived, 'Already ACKed.');
    assert(!this.completed, 'No encack after timeout.');
    this.ackReceived = true;

    this.input.init(publicKey);

    if (this.isReady()) {
      this.handshake = true;
      this.emit('handshake');
    }
  };

  /**
   * Cleanup handshake job.
   * @returns {Job}
   */

  cleanup() {
    const job = this.job;

    assert(!this.completed, 'Already completed.');
    assert(job, 'No completion job.');

    this.completed = true;
    this.job = null;

    if (this.timeout != null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.onShake) {
      this.removeListener('handshake', this.onShake);
      this.onShake = null;
    }

    return job;
  };

  /**
   * Complete the timeout for handshake.
   * @param {Object} result
   */

  resolve(result) {
    const job = this.cleanup();
    job.resolve(result);
  };

  /**
   * Complete the timeout for handshake with error.
   * @param {Error} err
   */

  reject(err) {
    const job = this.cleanup();
    job.reject(err);
  };

  /**
   * Destroy BIP151 state and streams.
   */

  destroy() {
    if (!this.job)
      return;

    this.reject(new Error('BIP151 stream was destroyed.'));
  };

  /**
   * Add buffer size to `processed`,
   * check whether we need to rekey.
   * @param {Buffer} packet
   */

  maybeRekey(packet) {
    if (!this.output.shouldRekey(packet))
      return;

    this.emit('rekey');

    if (this.bip150 && this.bip150.auth) {
      this.bip150.rekeyOutput();
      return;
    }

    this.output.rekey();
  };

  /**
   * Calculate packet size.
   * @param {String} cmd
   * @param {Buffer} body
   * @returns {Number}
   */

  packetSize(cmd, body) {
    let size = 0;
    size += 4;
    size += encoding.sizeVarString(cmd, 'ascii');
    size += 4;
    size += body.length;
    size += 16;
    return size;
  };

  /**
   * Frame plaintext payload for the output stream.
   * @param {String} cmd
   * @param {Buffer} body
   * @returns {Buffer} Ciphertext payload
   */

  packet(cmd, body) {
    const size = this.packetSize(cmd, body);
    const bw = new StaticWriter(size);
    const payloadSize = size - 20;

    bw.writeU32(payloadSize);
    bw.writeVarString(cmd, 'ascii');
    bw.writeU32(body.length);
    bw.writeBytes(body);
    bw.seek(16);

    const msg = bw.render();
    const payload = msg.slice(4, 4 + payloadSize);

    this.maybeRekey(msg);

    this.output.encryptSize(msg);
    this.output.encrypt(payload);
    this.output.finish().copy(msg, 4 + payloadSize);
    this.output.sequence();

    return msg;
  };

  /**
   * Feed ciphertext payload chunk
   * to the input stream. Potentially
   * emits a `packet` event.
   * @param {Buffer} data
   */

  feed(data) {
    this.total += data.length;
    this.pending.push(data);

    while (this.total >= this.waiting) {
      const chunk = this.read(this.waiting);
      this.parse(chunk);
    }
  };

  /**
   * Read and consume a number of bytes
   * from the buffered stream.
   * @param {Number} size
   * @returns {Buffer}
   */

  read(size) {
    assert(this.total >= size, 'Reading too much.');

    if (size === 0)
      return Buffer.alloc(0);

    const pending = this.pending[0];

    if (pending.length > size) {
      const chunk = pending.slice(0, size);
      this.pending[0] = pending.slice(size);
      this.total -= chunk.length;
      return chunk;
    }

    if (pending.length === size) {
      const chunk = this.pending.shift();
      this.total -= chunk.length;
      return chunk;
    }

    const chunk = Buffer.allocUnsafe(size);
    let off = 0;

    while (off < chunk.length) {
      const pending = this.pending[0];
      const len = pending.copy(chunk, off);
      if (len === pending.length)
        this.pending.shift();
      else
        this.pending[0] = pending.slice(len);
      off += len;
    }

    assert.strictEqual(off, chunk.length);

    this.total -= chunk.length;

    return chunk;
  };

  /**
   * Parse a ciphertext payload chunk.
   * Potentially emits a `packet` event.
   * @param {Buffer} data
   */

  parse(data) {
    if (!this.hasSize) {
      const size = this.input.decryptSize(data);

      assert(this.waiting === 4);
      assert(data.length === 4);

      // Allow 3 batched packets of max message size (12mb).
      // Not technically standard, but this protects us
      // from buffering tons of data due to either an
      // potential dos'er or a cipher state mismatch.
      // Note that 6 is the minimum size:
      // varint-cmdlen(1) str-cmd(1) u32-size(4) payload(0)
      if (size < 6 || size > Secret.MAX_MESSAGE) {
        this.error('Bad packet size: %d.', util.mb(size));
        return;
      }

      this.hasSize = true;
      this.waiting = size + 16;

      return;
    }

    const payload = data.slice(0, this.waiting - 16);
    const tag = data.slice(this.waiting - 16, this.waiting);

    this.hasSize = false;
    this.waiting = 4;

    // Authenticate payload before decrypting.
    // This ensures the cipher state isn't altered
    // if the payload integrity has been compromised.
    this.input.auth(payload);
    this.input.finish();

    if (!this.input.verify(tag)) {
      this.input.sequence();
      this.error('Bad tag: %s.', tag.toString('hex'));
      return;
    }

    this.input.decrypt(payload);
    this.input.sequence();

    const br = new BufferReader(payload);

    while (br.left()) {
      let cmd, body;

      try {
        cmd = br.readVarString('ascii');
        body = br.readBytes(br.readU32());
      } catch (e) {
        this.emit('error', e);
        return;
      }

      this.emit('packet', cmd, body);
    }
  };
}

/**
 * Cipher list.
 * @enum {Number}
 */

Secret.ciphers = {
  CHACHAPOLY: 0
};

/**
 * Max message size.
 * @const {Number}
 * @default
 */

Secret.MAX_MESSAGE = 12 * 1000 * 1000;

/*
 * Expose
 */

module.exports = Secret;
