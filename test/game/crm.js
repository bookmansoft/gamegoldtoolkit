/**
 * 联机单元测试：CRM注册、登录流程
 */

const assert = require('assert')
const crypto = require('crypto');
//引入游戏云连接器，创建连接器对象
const {gameconn} = require('../../src/')
const remote = new gameconn({
    "UrlHead": "http",            //协议选择: http/https
    "webserver": {
        "host": "127.0.0.1",        //开发使用本地ip：127.0.0.1 打包使用远程主机地址 114.115.167.168
        "port": 9901                //远程主机端口
    }
}).setFetch(require('node-fetch')); //设置node环境下兼容的fetch函数

//加密混淆字段
const salt = "038292cfb50d8361a0feb0e3697461c9";
//模拟的用户名称
let username = `${(Math.random()*1000000)|0}@vallnet.cn`;
//模拟的用户密码，经过了加密转换
let password = crypto.createHash("sha1").update(((Math.random()*1000000)|0).toString() + salt).digest("hex");  
let mobilephone = `139${((Math.random()*100000000)|0).toString()}`;

describe.only('CRM注册登录', () => {
    it('用户注册 - 通过两阶段认证模式实现', async () => {
    //当用户点击'获取验证码'时执行如下流程：
    let ret = await remote.init(/*初始化连接器，只保留原始配置信息*/).login({
        domain: 'auth2step.CRM',    //指定验证方式为两阶段认证
        openid: username,           //用户名称
        openkey: password,          //用户密码，经过了加密转换
        addrType: 'phone',          //指定验证方式为手机
        address: mobilephone,       //作为验证地址的手机号码
    });
    assert(ret, 'login failed');

    //模拟用户输入验证码的流程，实际运用中，当用户填写好手机验证码、点击'注册'时执行 emit authcode
    if (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
        //查询短信验证码，该接口仅供测试
        let msg = await remote.fetching({func:`${remote.userInfo.domain.split('.')[0]}.getKey`, address: remote.userInfo.address});
        assert(msg.code == 0, 'getKey error');

        //当用户输入验证码、点击'注册'时执行该流程
        remote.events.emit('authcode', msg.data);
        await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
    }
    });

    it('用户登录 - 使用用户名/密码认证模式', async () => {
        let ret = await remote.init().login({ 
            domain: 'authpwd.CRM',  //指定验证方式为用户名/密码认证，后台系统并不会为此创建名为 authpwd.openid 的新用户，而是自动转换为已注册的 auth2step.openid @2019.07.02
            openid: username,       //注册时使用的 openid
            openkey: password,      //注册时使用的 openkey
        });
        assert(ret);
        //{ status: "ok", type: "account", currentAuthority: "admin", userinfo:{ id: 1 } }
    })

    it('验证登录成功 - 用户持登录成功后获得的 token 执行业务指令', async () => {
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code==0);
    });

    it('用户再次登录 - 使用两阶段认证模式', async () => {
        //执行登录操作，通过配置对象传入用户信息，并指定签证方式为两阶段认证
        let ret = await remote.init(/*初始化连接器，只保留原始配置信息*/).login({
            domain: 'auth2step.CRM',    //签证方式
            addrType: 'phone',          //验证方式
            address: mobilephone,       //验证地址
        });
        assert(ret, 'login failed');

        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        if (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain.split('.')[0]}.getKey`, address: remote.userInfo.address});
            assert(msg.code == 0, 'getKey error');

            //当用户输入验证码时，使用事件驱动登录操作
            remote.events.emit('authcode', msg.data);
            await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
        }
    });

    it('验证登录成功 - 用户持登录成功后获得的 token 执行业务指令', async () => {
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code==0);
    });
});
