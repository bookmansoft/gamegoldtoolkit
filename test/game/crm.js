const crypto = require('crypto');
const salt = "038292cfb50d8361a0feb0e3697461c9";

let userName = 'admin';
let password = '123456';

/**
 * 联机单元测试：客户端用户注册登录流程
 * 
 * 以下单元测试演示多种不同的登录模式：
 * 1. 两阶段登录模式：首先发送用户信息和手机号码到服务端，服务端通过短信下行验证码，用户再次输入验证码登录
 * 2. 第三方授权模式：如微信、QQ、360，其特点是事先拿到签名数据，送至服务端校验(服务端可视情况做本地验签或远程验签)
 * 3. 后期绑定模式：用户在已经通过第三方授权模式成功登录的情况下，补充录入自己的手机号码，将其绑定在原有账户上，之后使用该手机号码登录，视为原有账户登录
 * 使用上述三种方式成功登录后，服务端签发一张令牌，可以在有效期内持令牌登录
 */

const assert = require('assert')

//引入游戏云连接器，创建连接器对象
const {gameconn} = require('../../src/')
const remote = new gameconn({
    "UrlHead": "http",            //协议选择: http/https
    "webserver": {
      "host": "127.0.0.1",        //开发使用本地ip：127.0.0.1 打包使用远程主机地址 114.115.167.168
      "port": 9801                //远程主机端口
    }
}).setFetch(require('node-fetch')); //设置node环境下兼容的fetch函数

describe('游戏云注册登录测试', () => {
    it('密码验证登录', async () => {
        password = crypto.createHash("sha1").update(password + salt).digest("hex");  //加密后的值d
    
        //统一执行登录操作
        //{ status: "ok", type: "account", currentAuthority: "admin", userinfo:{ id: 1 } }
        ret = await remote.login({ 
          domain: 'authpwd',
          openid: userName,
          openkey: password,
        });

        assert(ret);
    });
});
