const {clone, ReturnCodeName, io, ReturnCode, CommMode, NotifyType} = require('./util')

/**
 * RPC控件
 * @note
 *      1、根据创建参数，可分别支持WS、Socket、Http三种常用通讯模式，支持Notify、JSONP、Watching等报文通讯模式
 *      2、支持LBS重定向功能
 *      3、内部封装了一定的断言功能
 */
class Remote {
    constructor($mode = CommMode.ws, options){
        //切换长短连的标志 http socket
        this.rpcMode = $mode;

        this.configOri = options;                   //读取并保存初始配置，不会修改
        this.config = clone(this.configOri);        //复制一份配置信息，有可能修改

        this.userInfo = {
            domain: this.config.auth.domain,
            openid: this.config.auth.openid,
            openkey: this.config.auth.openkey,
            pf: this.config.auth.pf
        };
        this.autoLogin = false;

        this.notifyHandles = {};
        /*通过使用统一的socket来保持包含多个交互过程的会话*/
        this.createSocket(this.config.webserver.host, this.config.webserver.port);
    }

    /**
     * 修改通讯模式
     * @param {*} $mode 
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
    createSocket(ip, port){
        this.close();

        this.socket = io(`${this.config.UrlHead}://${ip}:${port}`, {'force new connection': true})
        .on('notify', ret => {//监听推送消息
            if(this.notifyHandles[ret.type]) {
                this.notifyHandles[ret.type](ret.info);
            }
            else if(!!this.notifyHandles['0']){
                this.notifyHandles['0'](ret.info);
            }
        })
        .on('disconnect', ()=>{//断线重连
            this.socket.needConnect = true;
            setTimeout(()=>{
                if(!!this.socket.needConnect) {
                    this.socket.needConnect = false;
                    this.socket.connect();
                }
            }, 1500);
        })
        .on('connect', () => { //连接消息
            if(this.notifyHandles['onConnect']) {
                this.notifyHandles['onConnect']();
            }
        });
    }

    /**
     * 类360的认证流程
     */
    async authOfBasic() {
        let msg = await this.locate(this.configOri.webserver.host, this.configOri.webserver.port)
            .fetching({"func": "config.getServerInfo", "oemInfo":{"domain": this.userInfo.domain, "openid": this.userInfo.openid}});

        if(!!msg && msg.code == ReturnCode.Success) {
            //此处根据实际需要，发起了基于HTTP请求的认证访问，和本身创建时指定的通讯模式无关。
            msg = await this.locate(msg.data.ip, msg.data.port).getRequest({id: this.userInfo.openid, authControl: this.userInfo.authControl || `auth360.html`});

            //客户端从模拟网关取得了签名集
            if(!msg || !msg.sign) {
                throw new Error('login: empty sign');
            }

            //将签名集发送到服务端进行验证、注册、绑定
            msg = await this.fetching({
                'func': '1000',
                "oemInfo": {
                    "domain": this.userInfo.domain,             //指定第三方平台类型
                    "authControl": this.userInfo.authControl,   //自定义验签
                    "auth":msg                                  //发送签名集
                }
            });

            if(!!msg && msg.code == ReturnCode.Success && !!msg.data) {
                this.userInfo.id = msg.data.id;
                this.userInfo.token = msg.data.token;
            }
        }
        
        return msg;
    }

    /**
     * 后台管理员的登录验证流程
     */
    async authOfAdmin(){
        let msg = await this.locate(this.configOri.webserver.host, this.configOri.webserver.port)
            .getRequest({openid: this.userInfo.openid, openkey: this.userInfo.openkey, authControl: `authAdmin.html`});

        if(!!msg && msg.code == ReturnCode.Success) {
            //将签名集发送到服务端进行验证、注册、绑定
            msg = await this.fetching({
                'func': 'admin.login',
                "oemInfo": {
                    "domain": this.userInfo.domain /*指定第三方平台类型*/,
                    "auth":msg /*发送签名集，类似的，TX平台此处是发送openid/openkey以便前向校验 */
                }
            });``

            if(!!msg && msg.code == ReturnCode.Success && !!msg.data) {
                this.userInfo.id = msg.data.id;
                this.userInfo.token = msg.data.token;
            }
        }

        return msg;
    }

    async authOfTx() {
        let msg = await this.locate(this.configOri.webserver.host, this.configOri.webserver.port)
            .fetching({
                "func": "config.getServerInfo", 
                "oemInfo":{"domain": this.userInfo.domain, "openid": this.userInfo.openid}});

        if(!!msg && msg.code == ReturnCode.Success) {
            //腾讯登录：上行openid、openkey，服务端验证后返回结果
            msg = await this.locate(msg.data.ip, msg.data.port).fetching({
                'func': '1000',
                "oemInfo": this.userInfo
            });
        
            if(!!msg && msg.code == ReturnCode.Success && !!msg.data) {
                this.userInfo.id = msg.data.id;
                this.userInfo.token = msg.data.token;
            }
        }
        return msg;
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
     * 执行登录流程，获取登录应答
     * @param {*} ui 
     */
    async login(ui) {
        if(!!ui) {
            if(!!ui.domain) {
                this.userInfo.domain = ui.domain;
            }
            if(!!ui.openid) {
                this.userInfo.openid = ui.openid;
            }
            if(!!ui.openkey) {
                this.userInfo.openkey = ui.openkey;
            }
            if(!!ui.pf) {
                this.userInfo.pf = ui.pf;
            }
            if(!!ui.authControl) {
                this.userInfo.authControl = ui.authControl;
            }
        }
        this.userInfo.token = null; //清空先前缓存的token
        this.autoLogin = true;

        return this.$login();
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
        return new Remote(this.rpcMode, this.configOri);
    }

    /**
     * 获取新的远程对象
      * @returns {Remote}
     */
    get new(){
        return new Remote(this.rpcMode, this.configOri);
    }

    /**
     * 执行认证流程，成功后调用由参数cb指定的回调
     * @param {*} cb 回调
     */
    async $login() {
        if(this.autoLogin) {
            this.autoLogin = false;
            switch(this.userInfo.domain.split('.')[0]) {
                case "admin": {
                    return this.authOfAdmin();
                }

                case "tx": {
                    return this.authOfTx();
                }

                default: {
                    return this.authOfBasic();
                }
            }
        }

        return Promise.resolve();
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
        if(this.autoLogin) {
            await this.$login();
            return this.fetching(params);
        }

        if(!!params.authControl) {
            return this.getRequest(params);
        }
        else {
            this.parseParams(params);
            
            switch(this.rpcMode) {
                case CommMode.ws:
                    return new Promise((resolve, reject) => {
                        try {
                            this.socket.emit('req', params, msg => {
                                resolve(msg);
                            });
                        }
                        catch(e) {
                            reject(e);
                        }
                    });

                case CommMode.get:
                    return this.getRequest(params);

                case CommMode.post:
                    return this.postRequest(params);
            }
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

        this.createSocket(ip, port);
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
     * 参数调整
     * @param params
     */
    parseParams(params) {
        params.func = !!params.func ? params.func : 'index.login';
        //填充自动登录参数
        let arr = params.func.split('.');
        if(arr.length > 1){
            params.control = arr[0];
            params.func = arr[1];
        }
        else{
            params.func = arr[0];
        }

        params.oemInfo = !!params.oemInfo ? params.oemInfo : {};
        if(!!params.oemInfo.domain){
            this.userInfo.domain = params.oemInfo.domain;
        }
        if(!!params.oemInfo.openid){
            this.userInfo.openid = params.oemInfo.openid;
        }
        if(!!params.oemInfo.openkey){
            this.userInfo.openkey = params.oemInfo.openkey;
        }
        if(!!this.userInfo.token){
            params.oemInfo.token = this.userInfo.token;
        }
        if(!!this.userInfo.pf){
            params.oemInfo.pf = this.userInfo.pf;
        }
    }

    /**
     * 以 GET 方式访问远程API
     * @param {*} url       远程地址
     */
    async get(url) {
        const newOptions = { json: true };
        
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
        const newOptions = { json: true, method: 'POST', body: JSON.stringify(options) };
        
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
    async getRequest(params) {
        this.parseParams(params);

        let url = !!params.authControl ? `${this.config.UrlHead}://${this.config.webserver.host}:${this.config.webserver.port}/${params.authControl}` : `${this.config.UrlHead}://${this.config.webserver.host}:${this.config.webserver.port}/index.html`;
        url += "?" + Object.keys(params).reduce((ret, next)=>{
                if(ret != ''){ ret += '&'; }
                return ret + next + "=" + ((typeof params[next]) == "object" ? JSON.stringify(params[next]) : params[next]);
            }, '');

        return this.get(url);
    }

    /**
     * (内部函数)发起基于Http协议的RPC请求
     * @param params
     */
    async postRequest(params) {
        this.parseParams(params);

        let url = !!params.authControl ? `${this.config.UrlHead}://${this.config.webserver.host}:${this.config.webserver.port}/${params.authControl}` : `${this.config.UrlHead}://${this.config.webserver.host}:${this.config.webserver.port}/index.html`;

        return this.post(url, params);
    }
}

Remote.CommMode = CommMode;
Remote.ReturnCode = ReturnCode;
Remote.NotifyType = NotifyType;

module.exports = Remote;