const {stringify, NotifyType, encrypt, decrypt, extendObj, CommStatus, clone, ReturnCodeName, io, ReturnCode, CommMode, createHmac} = require('./utils/util');
const EventEmitter = require('events').EventEmitter;
const Indicator = require('./utils/Indicator');
const assert = require('./utils/assert')
let {sha1, hash160, hash256, verifyData, generateKey, signObj, verifyObj, verifyAddress} = require('./utils/verifyData');
const Secret = require('./utils/secret')

/**
 * RPC控件
 * @note
 *      1、根据创建参数，可分别支持WS、Socket、Http三种常用通讯模式，支持Notify、JSONP、Watching等报文通讯模式
 *      2、支持LBS重定向功能
 *      3、内部封装了一定的断言功能
 */
class Remote {
    constructor(options) {
        this.rpcMode = CommMode.post;
        this.loginMode = Indicator.inst();
        this.configOri = options;                   //读取并保存初始配置，不会修改
        this.config = clone(this.configOri);        //复制一份配置信息，有可能修改
        this.notifyHandles = {};
        this.userInfo = {};
        //事件管理器
        this.events = new EventEmitter();
        //状态管理器
        this.status = Indicator.inst(options.status);

        //两阶段登录时，用户输入验证码时提交此事件
        this.events.on('authcode', async code => {
            console.log('gameconn: commit authcode', code);
            await this.setSign(code).login();
        })
    }

    /**
     * 修改通讯模式
     * @param {*} $mode     通讯模式
     * @param {*} cb        建立连接时的回调
     */
    setmode($mode) {
        this.rpcMode = $mode;
        return this;
    }

    /**
     * 创建通讯连接组件
     * @param {*} ip 
     * @param {*} port 
     */
    async createSocket(ip, port) {
        if(!ip) {
            ip = this.config.webserver.host;
        }
        if(!port) {
            port = this.config.webserver.port;
        }

        this.close();

        this.socket = io(`${this.config.UrlHead}://${ip}:${port}`, {'force new connection': true});
        this.socket.on('notify', ret => {//监听推送消息
            if(this.notifyHandles[ret.type]) {
                this.notifyHandles[ret.type](ret.info);
            }
            else if(!!this.notifyHandles['0']){
                this.notifyHandles['0'](ret.info);
            }
        })
        .on('disconnect', ()=>{//断线重连
            console.log('gameconn: socket disconnected');
            this.events.emit('comm', {status: 'disconnect'});
            this.socket.needConnect = true;
            setTimeout(()=>{
                if(!!this.socket.needConnect) {
                    this.socket.needConnect = false;
                    this.socket.connect();
                }
            }, 1500);
        }).on('connect', () => { //连接消息
            console.log('gameconn: socket connected');
            this.events.emit('comm', {status: 'connect'});
        }).on('error', () => {
            this.events.emit('comm', {status: 'error'});
        });

        let self = this;
        let prom = new Promise(resolve => {
            self.events.on('comm', async msg => {
                if(msg.status == 'connect') {
                    resolve();
                }
            })
        });
        return prom;
    }

    /**
     * 获取OpenId
     */
    async getOpenId() {
        //此处根据实际需要，发起了基于HTTP请求的认证访问，和本身创建时指定的通讯模式无关。
        console.log('gameconn: getOpenId');
        let msg = await this.getRequest({
            port: this.configOri.webserver.authPort, 
            openkey: this.userInfo.openkey, 
        }, this.userInfo.domain);

        //客户端从模拟网关取得了签名集
        if(!msg) {
            return false;
        }

        if(!msg.unionid) {
            msg.unionid = msg.openid;
        }

        this.userInfo.openid = msg.unionid;
        this.userInfo.openkey = msg.access_token;

        console.log('gameconn: getOpenId', msg.unionid);
        return true;
    }

    /**
     * 获取签名数据集
     */
    async getSign() {
        console.log('gameconn: getSign');
        //此处根据实际需要，发起了基于HTTP请求的认证访问，和本身创建时指定的通讯模式无关。
        let router = this.userInfo.openid.split('.')[0]; //openid一般由代表验证模式的前缀，加上代表节点类型的后缀组成, 获取签名接口的路由路径默认等于其前缀
        let msg = await this.getRequest({}, router);

        //客户端从模拟网关取得了签名集
        if(!msg) {
            return false;
        }

        this.userInfo.auth = msg;

        console.log('gameconn: getSign', msg);

        return true;
    }

    /**
     * 设置验证码
     * @param {*} code 
     */
    setSign(code) {
        if(!!this.userInfo) {
            if(this.loginMode.check(CommStatus.reqSign)) {
                this.status.set(CommStatus.signCode);
                this.userInfo.auth = this.userInfo.auth || {};
                this.userInfo.auth.captcha = code;
            }
        }
        return this;
    }

    /**
     * 登录并获得令牌
     */
    async getToken() {
        if(!this.userInfo 
            || (this.loginMode.check(CommStatus.reqLb) && !this.status.check(CommStatus.lb)) 
            || (this.loginMode.check(CommStatus.reqSign) && !this.status.check(CommStatus.signCode)
            || this.status.check(CommStatus.logined))
        ) {
            //不满足登录的前置条件或已经登录
            return false;
        }

        //将签证发送到服务端进行验证
        console.log('gameconn: getToken');
        let msg = await this.fetching({
            'func': 'login.UserLogin',
            "oemInfo": this.userInfo,
        });

        if(!!msg) {
            console.log('gameconn: getToken', msg.code);
            if(msg.code == ReturnCode.Success && !!msg.data) {
                if(typeof msg.data == 'object') {
                    extendObj(this.userInfo, msg.data);
                }
                this.status.set(CommStatus.logined);
                this.events.emit('logined', {code:0, data:{currentAuthority: this.userInfo.currentAuthority}});
    
                return true;
            } else {
                this.events.emit('logined', {code: msg.code});
            }
        } else {
            console.log('gameconn: getToken failed');
            this.events.emit('logined', {code:-1});
        }
        return false;
    }

    /**
     * 清空先前的缓存状态
     */
    clearCache() {
        if(this.userInfo) {
            this.userInfo.token = null; 
        }
    }

    /**
     * 执行负载均衡流程
     * @param {*} ui 
     */
    async setLB(force) {
        if(!this.userInfo) {
            //尚未设置有效的用户数据，无法执行
            return false;
        }

        if(!force && this.status.check(CommStatus.lb)) {
            //已经执行过LB操作，且非强制执行模式
            return true;
        }

        this.clearCache();
        this.status.init();

        console.log('gameconn: lb');
        let msg = await this.locate(this.configOri.webserver.host, this.configOri.webserver.port)
        .getRequest({"func": "lb.getServerInfo", "oemInfo":{"domain": this.userInfo.domain, "openid": this.userInfo.openid}});

        if(!!msg && msg.code == ReturnCode.Success) {
            console.log('gameconn: lb', msg.data);
            this.status.set(CommStatus.lb);
            this.locate(msg.data.ip, msg.data.port);
            return true;
        }

        console.log('gameconn: lb failed');
        return false;
    }

    /**
     * 登录流程
     * @param {Object} options
     * @param {Boolean} options.force 强制登录
     */
    async login(options) {
        options = options || {};
        if(options.force) {
            this.clearCache();
            this.status.init();
        }

        if(options.domain) {
            let authmode = options.openid.split('.')[0];
            switch(authmode) {
                case 'bxs': { //新增一种验证模式
                    this.setUserInfo({
                        domain: options.domain,     //认证模式
                        openid: options.openid,     //用户证书
                        openkey: options.openkey,   //中间证书，经由Auth服务器转换成 openid 下发给客户端
                        auth: options.auth,         //验证信息
                    }, CommStatus.reqLb);

                    break;
                }

                case 'authwx': {
                    this.setUserInfo({
                        domain: options.domain,     //认证模式
                        openkey: options.openkey,   //中间证书，经由Auth服务器转换成 openid 下发给客户端
                    }, CommStatus.reqLb | CommStatus.reqOpenId);

                    break;
                }

                case 'auth2step': {
                    this.setUserInfo({
                        domain: options.domain,     //验证模式
                        openid: options.openid,     //用户证书
                        openkey: options.openkey,   //用户证书
                        addrType: options.addrType, //验证方式
                        address: options.address,   //验证地址
                    }, CommStatus.reqLb | CommStatus.reqSign);

                    break;
                }

                case 'authpwd': {
                    this.setUserInfo({
                        domain: options.domain,     //验证模式
                        openid: options.openid,     //用户证书
                        openkey: options.openkey,   //用户密码
                    }, CommStatus.reqLb);

                    break;
                }

                default: {
                    this.setUserInfo({
                        domain: options.domain || 'official',   //验证模式
                        openid: options.openid,                 //登录名称
                        openkey: options.openkey,               //登录密码
                    });
                    break;
                }
            }
        }

        if(this.status.check(CommStatus.logined)) {
            return false;
        }

        if(!this.userInfo) {
            return false;
        }

        //检测执行微信所需要的KeyId转换
        if(this.loginMode.check(CommStatus.reqOpenId)) {
            if(!this.status.check(CommStatus.OpenId)) {
                if(!(await this.getOpenId())) {
                    throw(new Error('keyId error'));
                } else {
                    this.status.set(CommStatus.OpenId);
                }
            }
        }

        //检测执行负载均衡
        if(this.loginMode.check(CommStatus.reqLb)) {
            if(!this.status.check(CommStatus.lb)) {
                //如果需要负载均衡且尚未执行，执行如下语句
                if(!(await this.setLB())) {
                    //如果负载均衡失败，抛出异常，外围程序负责重新调用
                    throw(new Error('lb error'));
                } else {
                    this.status.set(CommStatus.lb);
                }
            }
        }

        //检测执行两阶段验证
        //两阶段验证模式(例如浏览器直接登录)：执行此操作，访问控制器方法 authmode.auth 获取签名对象，并赋值到 userInfo.auth 字段，服务端同时会将关联验证码通过邮件或短信下发
        //第三方授权登录模式(例如微信或QQ登录)跳过此步
        if(this.loginMode.check(CommStatus.reqSign)) {
            if(!this.status.check(CommStatus.sign)) {
                //如果需要两阶段验证且尚未执行，执行如下语句
                if(!(await this.getSign())) {
                    //如果负载均衡失败，抛出异常，外围程序负责重新调用
                    throw(new Error('get sign error'));
                } else {
                    this.status.set(CommStatus.sign);
                    return true;
                }
            } else {
                return await this.getToken();
            }
        } else {
            return await this.getToken();
        }
    }

    /**
     * 设置用户信息
     * 1. 支持局部设定模式
     * 2. 每次设置，状态类缓存会被清除，通讯状态被复原
     * @param {Object} ui {openid}
     * @param {Number} st 登录流程描述符
     */
    setUserInfo(ui, st) {
        this.userInfo = this.userInfo || {};

        this.clearCache();

        //设置登录模式
        if(!!st) {
            this.loginMode.init(st);
        }

        //合并对象数据
        extendObj(this.userInfo, ui);

        return this;
    }

    /**
     * 设置服务端推送报文的监控句柄，支持链式调用
     * @param cb            回调
     * @param etype
     * @returns {Remote}
     */
    watch(cb, etype = '0') {
        this.notifyHandles[etype] = cb;
        return this;
    }
    /**
     * 移除监控句柄
     * @param {*} etype 
     */
    unWatch(etype) {
        if(!!this.notifyHandles[etype]) {
            delete this.notifyHandles[etype];
        }
        return this;
    }

    /**
     * 判断返回值是否成功
     * @param msg       网络报文
     * @param out       强制打印日志
     * @returns {*}
     */
    isSuccess(msg, out=false) {
        if(!msg) {
            return false;
        }

        msg.msg = ReturnCodeName[msg.code];

        if((msg.code != ReturnCode.Success) || out){
            this.log(msg);
        }

        return msg.code == ReturnCode.Success;
    }

    /**
     * 直接打印各种对象
     * @param val
     */
    log(val){
        if(!val){
            console.log('undefined');
            return;
        }

        if(!!val.code){
            val.msg = ReturnCodeName[val.code];
        }

        switch(typeof val){
            case 'number':
            case 'string':
            case 'boolean':
                console.log(val);
                break;
            case 'function':
                console.log(val());
                break;
            case 'undefined':
                console.log('err: undefined');
                break;
            default:
                console.log(JSON.stringify(val));
                break;
        }
    }

    get newone(){
        return new Remote(this.configOri).setmode(this.rpcMode);
    }

    /**
     * 获取新的远程对象
      * @returns {Remote}
     */
    get new(){
        return new Remote(this.configOri).setmode(this.rpcMode);
    }

    /**
     * 等待指定时长
     * @param {Number} time 等待时长(毫秒) 
     */
    async wait (time) {
        await (async (time) => {return new Promise(resolve => {setTimeout(resolve, time);});})(time);
    }

    /**
     * 为了提供node下的兼容性而添加的属性设定函数
     * @param {*} fn 
     */
    setFetch(fn) {
        this.fetch = fn;
        return this;
    }

    /**
     * 向服务端提交请求,默认JSONP模式
     * @param params        命令参数，JSON对象
     *      .command    命令名称，格式: obj.func, 可以缩写为 func，此时obj为默认值'index'，例如 index.setNewbie 等价于 setNewbie
     *      .url        附加url地址
     * @param callback      回调函数
     * @returns {*}
     */
    async fetching(params) {
        this.parseParams(params);

        if(this.loginMode.check(CommStatus.reqLb) && !this.status.check(CommStatus.lb)) {
            await this.setLB();
        }

        switch(this.rpcMode) {
            case CommMode.ws:
                if(!this.socket) {
                    await this.createSocket(this.config.webserver.host, this.config.webserver.port);
                }
                return new Promise((resolve, reject) => {
                    this.socket.emit('req', params, msg => {
                        resolve(msg);
                    });
                });

            case CommMode.get:
                return this.getRequest(params);

            case CommMode.post:
                return this.postRequest(params);
        }

        return Promise.reject();
    }

    /**
     * 设定远程服务器地址
     * @param ip
     * @param port
     * @returns {Remote}
     */
    locate(ip, port){
        this.config.webserver.host = ip;
        this.config.webserver.port = port;

        return this;
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

        return this;
    }

    /**
     * 彻底清除连接器历史数据，包括通讯状态、运行数据缓存，只保留最原始的配置信息
     */
    init() {
        this.close();

        this.config = clone(this.configOri);        //复制一份配置信息，有可能修改
        this.userInfo = {};
        this.status.init();
        this.loginMode.init();
        
        return this;
    }

    /**
     * 参数调整
     * @param params
     */
    parseParams(params) {
        params.func = !!params.func ? params.func : 'index.login';
        //填充自动登录参数
        let arr = params.func.split('.');
        if(arr.length > 1) {
            params.control = arr[0];
            params.func = arr[1];
        } else {
            params.func = arr[0];
        }

        params.oemInfo = {
            domain: this.userInfo.domain,
            openid: this.userInfo.openid,
        };

        if(this.userInfo.openkey) {
            params.oemInfo.openkey = this.userInfo.openkey;
        }
        if(this.userInfo.token) {
            params.oemInfo.token = this.userInfo.token;
        }
        if(this.userInfo.addrType) {
            params.oemInfo.addrType = this.userInfo.addrType;
        }
        if(this.userInfo.address) {
            params.oemInfo.address = this.userInfo.address;
        }
        if(this.userInfo.auth) {
            params.oemInfo.auth = this.userInfo.auth;
        }
    }

    /**
     * 以 GET 方式访问远程API
     * @param {*} url       远程地址
     */
    async get(url) {
        const newOptions = { json: true, method: 'GET', mode: 'cors', };
        
        newOptions.headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
        };

        if(this.fetch) {
            let ret = await this.fetch(url, newOptions);
            return await ret.json();
        }
        else {
            let ret = await fetch(url, newOptions);
            return await ret.json();
        }
    }

    /**
     * 以 POST 方式访问远程API
     * @param {*} url       远程地址
     * @param {*} options   body
     */
    async post(url, options) {
        const newOptions = { json: true, method: 'POST', mode: 'cors', body: JSON.stringify(options) };
        
        newOptions.headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
        };

        try {
            if(this.fetch) {
                let ret = await this.fetch(url, newOptions);
                return await ret.json();
            }
            else {
                let ret = await fetch(url, newOptions);
                return await ret.json();
            }
        }
        catch(e) {
            console.error(e);
        }
    }
  
    /**
     * (内部函数)发起基于Http协议的RPC请求
     * @param params
     */
    async getRequest(params, authControl) {
        this.parseParams(params);

        let port = !!params.port ? params.port : this.config.webserver.port;
        let url = !!authControl ? `${this.config.UrlHead}://${this.config.webserver.host}:${port}/${authControl}` : `${this.config.UrlHead}://${this.config.webserver.host}:${port}/index.html`;
        url += "?" + Object.keys(params).reduce((ret, next)=>{
                if(ret != '') { 
                    ret += '&';
                }
                //增加了字段编译，避免特殊字符如汉字对URL拼接造成干扰
                return ret + next + "=" + ((typeof params[next]) == "object" ? encodeURIComponent(JSON.stringify(params[next])) : encodeURIComponent(params[next]));
            }, '');

        return this.get(url);
    }

    /**
     * (内部函数)发起基于Http协议的RPC请求
     * @param params
     */
    async postRequest(params, authControl) {
        this.parseParams(params);

        let port = !!params.port ? params.port : this.config.webserver.port;
        let url = !!authControl ? `${this.config.UrlHead}://${this.config.webserver.host}:${port}/${authControl}` : `${this.config.UrlHead}://${this.config.webserver.host}:${port}/index.html`;

        return this.post(url, params);
    }
}

Remote.prototype.CommMode = CommMode;
Remote.prototype.createHmac = createHmac;
Remote.prototype.assert = assert;
Remote.prototype.stringify = stringify;
Remote.prototype.encrypt = encrypt;
Remote.prototype.decrypt = decrypt;
Remote.prototype.verifyData = verifyData;
Remote.prototype.generateKey = generateKey;
Remote.prototype.signObj = signObj;
Remote.prototype.verifyObj = verifyObj;
Remote.prototype.verifyAddress = verifyAddress;
Remote.prototype.CommStatus = CommStatus;
Remote.prototype.ReturnCode = ReturnCode;
Remote.prototype.NotifyType = NotifyType;
Remote.prototype.Secret = Secret;
Remote.prototype.hash256 = hash256;
Remote.prototype.hash160 = hash160;
Remote.prototype.sha1 = sha1;

module.exports = Remote;