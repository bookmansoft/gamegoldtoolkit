/**
 * 授权式连接器，完整封装了客户端通过通过授权模式访问远程全节点的方法，仅仅依赖 create-hmac
 * 可以直接用于 node 环境下的服务端程序，来访问远程全节点丰富的API接口
 * 通过合适的打包程序，也可以用于浏览器环境
 */

const assert = require('./utils/assert')
const {io, signHMAC, Base64, now, CommStatus, createHmac, ReturnCode, CommMode, NotifyType, encrypt, decrypt, stringify} = require('./utils/util');
let {sha1, hash160, hash256, verifyData, generateKey, signObj, verifyObj, verifyAddress} = require('./utils/verifyData');
const Secret = require('./utils/secret')

/**
 * 终端配置管理
 */

class AuthConn
{
  constructor() {
    this.defaultNetworkType = 'testnet';
    this.AuthConnConfig = {
      'main': {
        type:   'main',
        ip:     '127.0.0.1',          //远程服务器地址
        port:   2002,                 //RPC端口
        head:   'http',               //远程服务器通讯协议，分为 http 和 https
        id:     'primary',            //默认访问的钱包编号
        apiKey: '',                   //远程服务器基本校验密码
        cid:    '',                   //授权节点编号，用于访问远程钱包时的认证
        token:  '',                   //授权节点令牌固定量，用于访问远程钱包时的认证
      },
      'testnet': {
        type:   'testnet',
        ip:     '127.0.0.1',          //远程服务器地址
        port:   2102,                 //RPC端口
        head:   'http',               //远程服务器通讯协议，分为 http 和 https
        id:     'primary',            //默认访问的钱包编号
        apiKey: '',                   //远程服务器基本校验密码
        cid:    '',                   //授权节点编号，用于访问远程钱包时的认证
        token:  '',                   //授权节点令牌固定量，用于访问远程钱包时的认证
      },
    }
    
    this.socketEvents = {};
    this.mode = CommMode.post;
    this.socket = null;
    this.$params = {
      random: null,
      randomTime: null,
    };
  }

  /**
   * 设置通讯模式
   * @param {*} mode  通讯模式
   * @param {*} cb    连接建立时的回调
   */
  setmode(mode, cb) {
    this.mode = mode;
    if(this.mode == CommMode.ws) {
      this.socketEvents['connect'] = async () => {
        await this.login();
        await this.join();
        if(typeof cb == 'function') {
          await cb();
        }
      };
    }
    return this;
  }

  async retoken() {
    let params = this.getTerminalConfig();
    let msg = await this.setmode(CommMode.ws).execute('token.random', [params.cid]);
    if(!!params.structured) {
      msg = msg.result;
    }
    const hmac = this.createHmac('sha256', msg);
    params.calc = hmac.update(params.token).digest('hex'); //计算并附加访问令牌

    return params;
  }

  /**
   * WS模式下的登录流程
   * @param {*} params 
   * @param {*} callback 
   */
  async login() {
    let params = await this.retoken();
    
    return await this.execute('wallet.auth', [
        params.apiKey,
        params.type,
        params.id,
        params.cid,
        params.calc,
    ]);
  }

  /**
   * Listen for events on wallet id.
   * @returns {Promise}
   */

  async join() {
    let conf = this.getTerminalConfig();

    let method = 'wallet.join';
    let params = await this.retoken();
    params = [params.id, params.cid, params.calc];
    let sig = signObj({
      method: method,
      params: params,
      cid: conf.cid,
      wid: conf.id,
    }, hash256(Buffer.from(conf.token)));

    return new Promise((resolve, reject) => {
      this.socket.emit('request', method, params, sig, (err) => {
        if (!!err) {
          console.log(err);
          reject(new Error(err.message));
          return;
        }
        resolve();
      });
    });
  };

  /**
   * Unlisten for events on wallet id.
   */

  async leave() {
    let conf = this.getTerminalConfig();
    
    let method = 'wallet.leave';
    let params = [conf.id];
    let sig = signObj({
      method: method,
      params: params,
      cid: conf.cid,
      wid: conf.id,
    }, hash256(Buffer.from(conf.token)));

    return new Promise((resolve, reject) => {
      this.socket.emit('request', method, params, sig, (err) => {
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve();
      });
    });
  };

  /**
   * 以 GET 方式，访问开放式API
   * @param {*} url 
   */
  async get(url) {
    const newOptions = { json: true };
      
    let conf = this.getTerminalConfig();
    let _head = !!conf.head ? conf.head : 'http';
    url = `${_head}://${conf.ip}:${conf.port}/public/${url}`;

    newOptions.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
    };

    try {
      let ret = null;
      if(this.fetch) {
        ret = await this.fetch(url, newOptions);
      }
      else {
        ret = await fetch(url, newOptions);
      }
      let json = await ret.json();

      if(!conf.structured) {
        if(json.error) {
          return json;
        } else {
          return json.result; //脱去外围数据结构
        }
      } else {
        return json;        //保留外围数据结构
      }
    }
    catch(e) {
      console.error(e);
    }
  }

  async post(url, options) {
    const newOptions = { json: true, method: 'POST', body: JSON.stringify(options) };
      
    let conf = this.getTerminalConfig();
    let _head = !!conf.head ? conf.head : 'http';
    url = `${_head}://${conf.ip}:${conf.port}/public/${url}`;

    newOptions.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
    };

    try {
      let ret = null;
      if(this.fetch) {
        ret = await this.fetch(url, newOptions);
      }
      else {
        ret = await fetch(url, newOptions);
      }
      let json = await ret.json();

      if(!conf.structured) {
        if(json.error) {
          return json;
        } else {
          return json.result; //脱去外围数据结构
        }
      } else {
        return json;        //保留外围数据结构
      }
    }
    catch(e) {
      console.error(e);
    }
  }

  /**
   * 执行RPC调用
   * @param {*} method 
   * @param {*} params 
   */
  async execute(method, params) {
    params = params || [];

    let conf = this.getTerminalConfig();
    switch(this.mode) {
      case CommMode.ws: {
        if(!this.socket) {
          await this.createSocket();
        }

        let key = generateKey(hash256(Buffer.from(conf.token)));
        let obj = {
          method: method,
          params: params,
          cid: conf.cid,
          wid: conf.id,
        };
        let sig = signObj(obj, key.private);

        return new Promise((resolve, reject) => {
          this.socket.emit('request', method, params, sig, (err, msg) => {
            if(!!err) {
              reject(err);
            }
            if(!conf.structured) {
              if(!!msg) {
                if(msg.error) {
                  resolve(msg);
                } else {
                  resolve(msg.result);
                }
              } else {
                resolve(null);
              }
            } else {
              resolve(msg);
            }
          });
        });
      }
      
      default: {
        await this.queryToken();

        let opt = this.fillOptions({
          method: 'POST',
          body: {
            method: method,
            params: params,
          },
        });

        let rt = await this.request(
          opt, 
          this.getTerminalConfig(),
        );
    
        if(!rt) {
          //console.error(`${method}通讯错误`);
          return { error:-1, };
        }

        if(!!rt.error) {
          //console.error(`${method}: ${rt.error.type} / ${rt.error.message}`);
        }

        if(!conf.structured) {
          if(rt.error) {
            return rt;
          } else {
            return rt.result;
          }
        } else {
          return rt;
        }
      }
    }
  }

  /**
   * 计算并返回用于对称加密的密钥
   */
  getAes() {
    let buf = hash256(Buffer.from(this.getTerminalConfig().token));
    let aeskey = buf.toString('base64').slice(0, 32);
    buf = hash256(buf);
    let aesiv = buf.toString('base64').slice(0, 16);

    return {aeskey, aesiv};
  }

  getRandom() {
    let _t = (now() / 120) | 0;
    this.$params.randomTime = this.$params.randomTime || _t;
    if (_t > this.$params.randomTime) {
      //有效期检测
      this.$params.random = null;
    }
  
    return this.$params.random;
  }
  
  setRandom(val) {
    this.$params.random = val;
    if (!!val) {
      this.$params.randomTime = (now() / 120) | 0; //设置有效期
    }
  }
  
  fillOptions(options) {
    if (!options) {
        options = {};
    }
    if (!options.body) {
        options.body = {};
    }
    if (!options.headers) {
        options.headers = {};
    }

    let rnd = this.getRandom();
    let _token = this.getTerminalConfig().token;
    if (_token && rnd) {
        options.body.token = signHMAC(_token, rnd);
    }
    options.body.wid = this.getTerminalConfig().id;   //附加默认钱包编号
    options.body.cid = this.getTerminalConfig().cid;  //附加客户端编号

    //对上行数据添加签名, 使用原始 token 作为私钥源
    options.body.sig = signObj({
      method: options.body.method,
      params: options.body.params,
      cid: options.body.cid,
      wid: options.body.wid,
    }, hash256(Buffer.from(_token)));

    options.body = JSON.stringify(options.body);

    let auth = {
        username: 'gamerpc',
        password: this.getTerminalConfig().apiKey || '',
    };
    var base = new Base64();
    var result = base.encode(`${auth.username}:${auth.password}`);
    options.headers.Authorization = `Basic ${result}`;
    return options;
  }

  async queryToken() {
    let ret = this.getRandom();
    if (!ret) {
      ret = await this.request(
        this.fillOptions({
          method: 'POST',
          body: {
            method: 'token.random',
            params: [this.getTerminalConfig().cid],
          },
        }), 
        this.getTerminalConfig()
      );
      if(!ret || !!ret.error) {
        console.error(`HMAC请求错误`);
      } else {
        this.setRandom(ret.result); //获取令牌随机量
      }
    }
  }

  /**
   * 创建通讯连接组件
   * @param {*} ip 
   * @param {*} port 
   */
  async createSocket(){
    this.close();

    let uri = ``;
    let conf = this.getTerminalConfig();
    let _head = !!conf.head ? conf.head : 'http';
    uri = `${_head}://${conf.ip}:${conf.port}/`;
  
    this.socket = io(uri, {'force new connection': true})
    .on('disconnect', ()=>{//断线重连
      this.socket.needConnect = true;
      setTimeout(()=>{
          if(!!this.socket.needConnect) {
              this.socket.needConnect = false;
              this.socket.connect();
          }
      }, 1500);
    })

    Object.keys(this.socketEvents).map(key=>{
      this.socket.on(key, this.socketEvents[key]);
    });

    await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(2000);
  }

  /**
   * 关闭长连接
   */
  close() {
    if(!!this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Requests a URL, returning a promise.
   *
   * @param  {object} [options] The options we want to pass to "fetch"
   * @return {object}           An object containing either "data" or "err"
   */
  async request(options, conf) {
    const defaultOptions = {
      //credentials: 'include',
    };

    const newOptions = { ...defaultOptions, ...options };
    newOptions.json = true;

    let _head = !!conf.head ? conf.head : 'http';

    newOptions.uri = `${_head}://${conf.ip}:${conf.port}/`;

    if (
      newOptions.method === 'POST' ||
      newOptions.method === 'PUT' ||
      newOptions.method === 'DELETE'
    ) {
      newOptions.headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        ...newOptions.headers,
      };
    }

    try {
      if(this.fetch) {
        let ret = await this.fetch(newOptions.uri, newOptions);
        return await ret.json();
      }
      else {
        let ret = await fetch(newOptions.uri, newOptions);
        return await ret.json();
      }
    }
    catch(e) {
      console.error(e);
    }
  }


  /**
   * 设置服务端推送报文的监控句柄，支持链式调用
   * @param cb            回调
   * @param etype         事件类型
   * @returns {Remote}
   */
  watch(cb, etype) {
    if(this.socket) {
      this.socket.on(etype, cb);
    } else {
      this.socketEvents[etype] = cb;
    }
    return this;
  }

  /**
   * 获取终端配置
   * @param {*} networkType 
   */
  getTerminalConfig(networkType) {
    networkType = networkType || this.defaultNetworkType;

    if(!this.AuthConnConfig[networkType]) {
      this.AuthConnConfig[info.type] = {};
    }

    return this.AuthConnConfig[networkType];
  }

  /**
   * 等待指定时长
   * @param {Number} time 等待时长(毫秒) 
   */
  async wait (time) {
    await (async (time) => {return new Promise(resolve => {setTimeout(resolve, time);});})(time);
  }

  /**
   * 设置终端配置
   * @param {*} networkType 
   * @param {*} info 
   */
  setup(info) {
    if(!!info && info.type) {
      if(!this.AuthConnConfig[info.type]) {
        this.AuthConnConfig[info.type] = {};
      }

      //设置默认网络类型
      this.defaultNetworkType = info.type;

      for(let k of Object.keys(info)) {
        //设置默认网络类型的参数 - 逐项设置
        this.AuthConnConfig[info.type][k] = info[k];
      }

      if(this.mode == CommMode.ws) {
        //断开后自动重连，以便刷新接口参数如目标钱包编号等
        this.close();
      }
    }

    return this;
  }

  /**
   * 为了提供node下的兼容性而添加的属性设定函数
   * @param {*} fn 
   */
  setFetch(fn) {
    this.fetch = fn;
    return this;
  }
}

AuthConn.prototype.CommMode = CommMode;
AuthConn.prototype.createHmac = createHmac;
AuthConn.prototype.assert = assert;
AuthConn.prototype.stringify = stringify;
AuthConn.prototype.encrypt = encrypt;
AuthConn.prototype.decrypt = decrypt;
AuthConn.prototype.verifyData = verifyData;
AuthConn.prototype.generateKey = generateKey;
AuthConn.prototype.signObj = signObj;
AuthConn.prototype.verifyObj = verifyObj;
AuthConn.prototype.verifyAddress = verifyAddress;
AuthConn.prototype.CommMode = CommMode;
AuthConn.prototype.CommStatus = CommStatus;
AuthConn.prototype.ReturnCode = ReturnCode;
AuthConn.prototype.NotifyType = NotifyType;
AuthConn.prototype.Secret = Secret;
AuthConn.prototype.hash256 = hash256;
AuthConn.prototype.hash160 = hash160;
AuthConn.prototype.sha1 = sha1;

/**
 * 访问全节点的远程调用函数
 */
module.exports = AuthConn;
