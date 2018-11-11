const {io, signHMAC, Base64, createHmac, ReturnCode, CommMode, now} = require('./util')
let req = require('./req'); //http访问
let {extendObj,clone} = require('../../facade/util/mixin/comm');

class GameConn {
    constructor($mode = CommMode.ws){
        //切换长短连的标志 http socket
        this.rpcMode = $mode;

        this.configOri = require('../../game.config').servers["Index"][1];  //读取并保存初始配置，不会修改
        this.config = clone(this.configOri);                                //复制一份配置信息，有可能修改

        this.userInfo = {
            domain: this.config.auth.domain,
            openid: this.config.auth.openid,
            openkey: this.config.auth.openkey,
            pf: this.config.auth.pf
        };
        this.autoLogin = false;

        /*通过使用统一的socket来保持包含多个交互过程的会话*/
        this.createSocket(this.config.webserver.mapping, this.config.webserver.port);

        this.tools = {
            extendObj: extendObj,
            clone: clone,
        };
    }

    /**
     * 创建通讯连接组件
     * @param {*} ip 
     * @param {*} port 
     */
    createSocket(ip, port){
        this.close();
        this.socket = io(`${this.config.UrlHead}://${ip}:${port}`, {'force new connection': true});
    }

    /**
     * 类360的认证流程
     * @param {*} cb 
     */
    authOf360(cb){
        let rpc = (ip, port)=>{
            //此处根据实际需要，发起了基于HTTP请求的认证访问，和本身创建时指定的通讯模式无关。
            this.locate(ip, port).$UrlRequest({id: this.userInfo.openid}, msg=>{
                //客户端从模拟网关取得了签名集
                if(!msg.sign) {
                    throw new Error('msg.sign can not to be empty');
                }

                //将签名集发送到服务端进行验证、注册、绑定
                this.fetch({
                    'func': '1000',
                    "oemInfo": {
                        "domain": this.userInfo.domain /*指定第三方平台类型*/,
                        "auth":msg /*发送签名集，类似的，TX平台此处是发送openid/openkey以便前向校验 */
                    }
                }, msg => {
                    if(!msg || msg.code != ReturnCode.Success) {
                        throw new Error('operation failed');
                    }
                    if(!!msg.data){
                        this.userInfo.id = msg.data.id;
                        this.userInfo.token = msg.data.token;
                    }
                    cb(msg);
                });
            }, `auth360.html`);
        };

        this.locate(this.configOri.webserver.host, this.configOri.webserver.port).fetch({"func": "config.getServerInfo", "oemInfo":{"domain": this.userInfo.domain, "openid": this.userInfo.openid}}, msg => {
            rpc(msg.data.ip, msg.data.port);
        });
    }

    /**
     * 后台管理员的登录验证流程
     * @param cb
     */
    authOfAdmin(cb){
        let rpc = (ip, port)=>{
            this.locate(ip, port).$UrlRequest({openid: this.userInfo.openid, openkey: this.userInfo.openkey}, msg=>{
                //将签名集发送到服务端进行验证、注册、绑定
                this.fetch({
                    'func': 'admin.login',
                    "oemInfo": {
                        "domain": this.userInfo.domain /*指定第三方平台类型*/,
                        "auth":msg /*发送签名集，类似的，TX平台此处是发送openid/openkey以便前向校验 */
                    }
                }, msg => {
                    if(!!msg.data){
                        this.userInfo.id = msg.data.id;
                        this.userInfo.token = msg.data.token;
                    }
                    cb(msg);
                });
            }, `authAdmin.html`);
        };

        rpc(this.configOri.webserver.host, this.configOri.webserver.port);
    }

    authOfTx(cb) {
        let rpc = (ip, port) => {
            //腾讯登录：上行openid、openkey，服务端验证后返回结果
            this.locate(ip, port).fetch({
                'func': '1000',
                "oemInfo": this.userInfo
            }, msg => {
                if(!msg || msg.code != ReturnCode.Success) {
                    throw new Error('operation failed');
                }
                if(!!msg.data){
                    this.userInfo.id = msg.data.id;
                    this.userInfo.token = msg.data.token;
                }
                cb(msg);
            });
        };

        this.locate(this.configOri.webserver.host, this.configOri.webserver.port).fetch({"func": "config.getServerInfo", "oemInfo":{"domain": this.userInfo.domain, "openid": this.userInfo.openid}}, msg => {
            rpc(msg.data.ip, msg.data.port);
        });
    }

    auth(ui, cb){
        if(!!ui){
            if(!!ui.domain){
                this.userInfo.domain = ui.domain;
            }
            if(!!ui.openid){
                this.userInfo.openid = ui.openid;
            }
            if(!!ui.openkey){
                this.userInfo.openkey = ui.openkey;
            }
            if(!!ui.pf){
                this.userInfo.pf = ui.pf;
            }
            if(!!ui.directly){
                this.userInfo.directly = ui.directly;
            }
        }
        this.userInfo.token = null; //清空先前缓存的token
        this.autoLogin = true;

        if(!!cb){
            return this.$login(cb);
        }
        else{
            return this;
        }
    }

    /**
     * 执行认证流程，成功后调用由参数cb指定的回调
     * @param {*} cb 回调
     */
    $login(cb){
        if(!cb){
            cb = ()=>{};
        }

        if(this.autoLogin){
            this.autoLogin = false;
            switch(this.userInfo.domain){
                case "admin":
                    this.authOfAdmin(msg=>{
                        cb(msg);
                    });
                    break;
                case "360.IOS":
                case "360.Android":
                case "360.Test":
                case "360":
                    this.authOf360(msg=>{
                        cb(msg);
                    });
                    break;
                case "tx.IOS":
                case "tx.Android":
                case "tx.Test":
                case "tx":
                    this.authOfTx(msg=>{
                        cb(msg);
                    }, this.userInfo.domain);
                    break;
                case "official":
                    this.authOf360(msg=>{
                        cb(msg);
                    });
                    break;
            }
        }
        else{
            cb(null);
        }
        return this;
    }

    /**
     * 向服务端提交请求,默认JSONP模式
     * @param command       命令名称，格式: obj.func, 可以缩写为 func，此时obj为默认值'index'，例如 index.setNewbie 等价于 setNewbie
     * @param params        命令参数，JSON对象
     * @param callback      回调函数
     * @returns {*}
     */
    fetch(params, callback, url=null){
        if(this.autoLogin){
            return this.$login(msg=>{
                if(!msg || msg.code != ReturnCode.Success) {
                    throw new Error('operation failed');
                }
                this.fetch(params, callback, url);
            });
        }

        this.parseParams(params);

        if(!!url){
            this.$UrlRequest(params, callback, url);
        }
        else{
            switch(this.rpcMode){
                case CommMode.ws:
                    if(!callback){
                        this.socket.emit('notify', params);
                    }
                    else{
                        this.socket.emit('req', params, callback);
                    }
                    break;

                default:
                    this.$UrlRequest(params, callback, url);
                    break;
            }
        }
        return this;
    }

    /**
     * 设定远程服务器地址
     * @param ip
     * @param port
     * @returns {GameConn}
     */
    locate(ip, port){
        this.config.webserver.host = ip;
        this.config.webserver.port = port;

        this.createSocket(ip, port);
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

    /**
     * 关闭长连接
     */
    close(){
        if(this.socket){
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * 参数调整
     * @param params
     */
    parseParams(params){
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
     * (内部函数)发起基于Http协议的RPC请求
     * @param params
     * @param callback
     * @param url
     * @constructor
     */
    $UrlRequest(params, callback, url){
        url = !!url ? `${this.config.UrlHead}://${this.config.webserver.host}:${this.config.webserver.port}/${url}` : `${this.config.UrlHead}://${this.config.webserver.host}:${this.config.webserver.port}/index.html`;
        url += "?" + Object.keys(params).reduce((ret, next)=>{
                if(ret != ''){ ret += '&'; }
                return ret + next + "=" + ((typeof params[next]) == "object" ? JSON.stringify(params[next]) : params[next]);
            }, '');

        req.pGetUrl(url).then(callback);
    }
}

module.exports = GameConn