/**
 * 联机单元测试：客户端用户注册登录流程
 * 
 * 以下单元测试演示多种不同的登录模式：
 * 1. 第三方授权登录：如微信、QQ、360，其特点是事先拿到签名数据，送至服务端校验
 * 2. 两阶段登录：首先发送用户信息和手机号码到服务端，服务端通过短信下行验证码，用户再次输入验证码登录
 * 3. 令牌登录：使用上述三种方式成功登录后，服务端签发一张令牌，可以在有效期内持令牌登录，令牌失效后则需要重新登录
 * 
 * 常用指令列表:
 * 1. remote.setUserInfo                            设置用户信息
 * 2. await remote.login()                          用户注册/登录
 * 3. remote.events.emit('authcode', authcode)      两阶段提交模式下提交验证码
 */

//引入连接游戏云的远程连接器
const {gameconn} = require('../../src/')

//创建连接器对象
let remote = new gameconn({
    "UrlHead": "http",              //协议选择: http/https
    "webserver": { 
        //注意：如果需要负载均衡，这里一般指定负载均衡服务器地址，否则直接填写业务主机地址
        "host": "127.0.0.1",        //远程主机地址
        "port": 9901                //远程主机端口
    },
}).setFetch(require('node-fetch')); //设置node环境下兼容的fetch函数

//设置为长连模式, 注释则默认为POST模式，该模式下无法进行消息监听
//remote.setmode(remote.CommMode.ws);

let wxUserPhone = '13822222222'

describe.only('游戏云注册登录测试', () => {
    it('两阶段认证登录，使用负载均衡', async () => {
        //断开连接，清理之前的认证信息
        remote.close();

        //设置用户基本信息
        remote.setUserInfo({
            domain: 'auth2step',        //验证模式
            openid: '13888888888',      //用户标识
            addrType: 'phone',          //验证方式
            address: '13888888888',     //验证地址
        }, remote.CommStatus.reqLb | remote.CommStatus.reqSign);

        let ret = await remote.login();
        if(!ret) {
            console.log('login failed.');
            return ;
        }
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        while (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, address: remote.userInfo.address});

            if(msg.code == 0) {
                //当用户输入验证码时，使用事件驱动登录操作
                remote.events.emit('authcode', msg.data);
                await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
            } else {
                console.log('getKey error:', msg.code);
                return;
            }
        }
    
        //执行业务流程
        try {
            let msg = await remote.fetching({func: "test.echo"});
            remote.isSuccess(msg, true);
        } catch(e) {
            console.error(e);
        }
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        await remote.fetching({func: "test.echo"});
    });

    it('第三方授权登录，使用负载均衡', async () => {
        //断开连接，清理之前的认证信息
        remote.close();

        //设置用户基本信息
        remote.setUserInfo({
            domain: 'authwx',
            openkey: `${Math.random()*1000000000 | 0}`,
        }, remote.CommStatus.reqLb);

        let ret = await remote.login();
        if(!ret) {
            console.log('login failed.');
            return ;
        }
    
        console.log('绑定前认证ID', remote.userInfo.openid);

        //执行业务流程
        try {
            let msg = await remote.fetching({func: "test.echo"});
            remote.isSuccess(msg, true);
        } catch(e) {
            console.error(e);
        }
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        await remote.fetching({func: "test.echo"});
    });

    it('登录成功后，输入手机号码进行后期绑定', async () => {
        //补充用户信息
        remote.setUserInfo({
            addrType: 'phone',          //验证方式
            address: wxUserPhone,       //验证地址
        });

        let msg = await remote.fetching({func: "bindafter.auth", address: remote.userInfo.address});
        if(msg.code == 0) {
            //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
            let msg = await remote.fetching({func:`bindafter.getKey`}); //查询短信验证码，该接口仅供测试
            if(msg.code == 0) {
                //用户输入验证码
                let m = await remote.fetching({func:`bindafter.check`, openkey: msg.data}); //查询短信验证码，该接口仅供测试
                if(m.code != 0) {
                    console.log('bindafter.check error:', msg.code);
                }
                await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
            } else {
                console.log('getKey error:', msg.code);
            }
        } else {
            console.log('bindafter.auth error:', msg.code);
        }
    });

    it('后期绑定成功后，使用手机号码进行两阶段登录，登录同一个账户', async () => {
        //断开连接，清理之前的认证信息
        remote.close();

        //设置用户基本信息
        remote.setUserInfo({
            domain: 'auth2step',        //验证模式
            openid: '13888888888',      //用户标识
            addrType: 'phone',          //验证方式
            address: wxUserPhone,       //验证地址
        }, remote.CommStatus.reqLb | remote.CommStatus.reqSign);

        let ret = await remote.login();
        if(!ret) {
            console.log('login failed.');
            return ;
        }
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        while (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, address: remote.userInfo.address});
            if(msg.code == 0) {
                //当用户输入验证码时，使用事件驱动登录操作
                remote.events.emit('authcode', msg.data);
                await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
            } else {
                console.log('getKey error:', msg.code);
                return;
            }
        }
    
        await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(3000);
        console.log('绑定后认证ID', remote.userInfo.openid);
    });
});
