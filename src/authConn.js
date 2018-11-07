/**
 * 授权式连接器，完整封装了客户端通过通过授权模式访问远程全节点的方法，仅仅依赖 create-hmac
 * 可以直接用于 node 环境下的服务端程序，来访问远程全节点丰富的API接口
 * 通过合适的打包程序，也可以用于浏览器环境
 */

const {io, signHMAC, Base64, createHmac, ReturnCode, CommMode, now} = require('./util')

/**
 * 终端配置管理
 */

let defaultNetworkType = 'testnet';

const main = {
  type:   'main',
  ip:     '127.0.0.1',          //远程服务器地址
  head:   'http',               //远程服务器通讯协议，分为 http 和 https
  id:     'primary',            //默认访问的钱包编号
  apiKey: 'bookmansoft',        //远程服务器基本校验密码
  cid:    'xxxxxxxx-game-gold-root-xxxxxxxxxxxx', //授权节点编号，用于访问远程钱包时的认证
  token:  '03aee0ed00c6ad4819641c7201f4f44289564ac4e816918828703eecf49e382d08', //授权节点令牌固定量，用于访问远程钱包时的认证
};

const testnet = {
  type:   'testnet',
  ip:     '127.0.0.1',          //远程服务器地址
  head:   'http',               //远程服务器通讯协议，分为 http 和 https
  id:     'primary',            //默认访问的钱包编号
  apiKey: 'bookmansoft',        //远程服务器基本校验密码
  cid:    'xxxxxxxx-game-gold-root-xxxxxxxxxxxx', //授权节点编号，用于访问远程钱包时的认证
  token:  '03aee0ed00c6ad4819641c7201f4f44289564ac4e816918828703eecf49e382d08', //授权节点令牌固定量，用于访问远程钱包时的认证
};

const AuthConnConfig = {
  'main': main,
  'testnet': testnet,
}

class AuthConn
{
  constructor() {
    this.mode = this.CommMode.post;
    this.io = io;
    this.socket = null;
    this.$params = {
      random: null,
      randomTime: null,
    };
  }

  /**
   * 设置通讯模式
   * @param {*} mode 
   */
  setmode(mode) {
    this.mode = mode;
    return this;
  }

  /**
   * WS模式下的登录流程
   * @param {*} params 
   * @param {*} callback 
   */
  async login() {
    let params = this.getTerminalConfig();
    let msg = await this.setmode(this.CommMode.ws).execute('token.random', [params.cid]);
    const hmac = this.createHmac('sha256', msg);
    let token = hmac.update(params.token).digest('hex'); //计算并附加访问令牌
    
    return await this.execute('wallet.auth', [
        params.apiKey,
        params.type,
        params.id,
        params.cid,
        token,
    ]);
  }

  /**
   * 执行RPC调用
   * @param {*} method 
   * @param {*} params 
   */
  async execute(method, params) {
    params = params || [];

    switch(this.mode) {
      case CommMode.ws: {
        if(!this.socket) {
          this.createSocket();
        }

        return new Promise((resolve, reject) => {
          this.socket.emit('request', method, ...params, (err, msg) => {
            if(!!err) {
              reject(err);
            }
            resolve(msg);
          });
        });
      }
      
      default: {
        await this.queryToken();
        let rt = await this.request(
          this.fillOptions({
            method: 'POST',
            body: {
              method: method,
              params: params,
            },
          }), this.getTerminalConfig()
        );
    
        if(!!rt.error || !rt.result) {
          console.error(`${method}数据请求错误`);
        }    
        return rt.result;
      }
    }
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
    options.body = JSON.stringify(options.body);

    let auth = {
        username: 'bitcoinrpc',
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
      if(!!ret.error || !ret.result) {
        console.error(`HMAC请求错误`);
      }
      this.setRandom(ret.result); //获取令牌随机量
    }
  }

  /**
   * 创建通讯连接组件
   * @param {*} ip 
   * @param {*} port 
   */
  createSocket(){
    this.close();

    let uri = ``;
    let conf = this.getTerminalConfig();
    let _head = !!conf.head ? conf.head : 'http';
    if(conf.type == 'main') {
      uri = `${_head}://${conf.ip}:7332/`;
    }
    else {
      uri = `${_head}://${conf.ip}:17332/`;
    }
  
    this.socket = this.io(uri, {'force new connection': true});
  }

  /**
   * 关闭长连接
   */
  close() {
    if(this.socket){
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
    if(conf.type == 'main') {
      newOptions.uri = `${_head}://${conf.ip}:7332/`;
    }
    else {
      newOptions.uri = `${_head}://${conf.ip}:17332/`;
    }

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
   * @param etype
   * @returns {Remote}
   */
  watch(cb, etype) {
    this.socket.on(etype, cb);
    return this;
  }

  /**
   * 获取终端配置
   * @param {*} networkType 
   */
  getTerminalConfig(networkType) {
    networkType = networkType || defaultNetworkType;
    return !!AuthConnConfig[networkType] ? AuthConnConfig[networkType] : {};
  }

  /**
   * 设置终端配置
   * @param {*} networkType 
   * @param {*} info 
   */
  setup(info) {
    //设为默认网络类型
    defaultNetworkType = info.type;
    //设置默认网络类型的参数
    AuthConnConfig[info.type] = info;

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

/**
 * 通讯模式
 */
AuthConn.prototype.CommMode = CommMode;
AuthConn.prototype.ReturnCode = ReturnCode;
AuthConn.prototype.createHmac = createHmac;

/**
 * 访问游戏金节点的远程调用函数
 */
module.exports = AuthConn;
