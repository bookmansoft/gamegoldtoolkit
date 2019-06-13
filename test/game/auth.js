/**
 * 联机单元测试：客户端用户注册登录流程
 * 
 * 以下单元测试演示多种不同的登录模式：
 * 1. 两阶段登录模式：首先发送用户信息和手机号码到服务端，服务端通过短信下行验证码，用户再次输入验证码登录
 * 2. 第三方授权模式：如微信、QQ、360，其特点是事先拿到签名数据，送至服务端校验(服务端可视情况做本地验签或远程验签)
 * 3. 后期绑定模式：用户在已经通过第三方授权模式成功登录的情况下，补充录入自己的手机号码，将其绑定在原有账户上，之后使用该手机号码登录，视为原有账户登录
 * 使用上述三种方式成功登录后，服务端签发一张令牌，可以在有效期内持令牌登录
 * 
 * 常用指令列表:
 * 1. remote.setUserInfo                            设置用户信息
 * 2. await remote.login()                          用户注册/登录
 * 3. remote.events.emit('authcode', authcode)      两阶段提交模式下提交验证码
 */

const assert = require('assert')

//引入游戏云连接器，创建连接器对象
const {gameconn} = require('../../src/')
let remote = new gameconn({
    "UrlHead": "http",              //协议选择: http/https
    "webserver": { 
        //注意：如果需要负载均衡，这里一般指定负载均衡服务器地址，否则直接填写业务主机地址
        "host": "127.0.0.1",        //远程主机地址
        "port": 9901                //远程主机端口
    },
}).setFetch(require('node-fetch')); //设置node环境下兼容的fetch函数

//设定一个随机的、用于验证后期绑定成功的手机号码
let wxUserPhone = ((Math.random() * 100000000) | 0).toString();
let authUser = '';

describe.only('游戏云注册登录测试', () => {
    it('两阶段认证登录，使用负载均衡', async () => {
        //初始化连接器，只保留原始配置信息
        remote.init();

        //设置用户基本信息
        remote.setUserInfo({
            domain: 'auth2step',        //验证模式
            openid: '13888888888',      //用户标识
            addrType: 'phone',          //验证方式
            address: '13888888888',     //验证地址
        }, remote.CommStatus.reqLb | remote.CommStatus.reqSign);

        let ret = await remote.login();
        assert(ret);
    
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
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code == 0);
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        await remote.fetching({func: "test.echo"});
    });

    it('第三方授权登录，使用负载均衡', async () => {
        //断开连接，清理之前的认证信息
        remote.init();

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
    
        authUser = remote.userInfo.openid;

        //执行业务流程
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code==0);
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
        remote.init();

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
        assert(remote.userInfo.openid == authUser, '绑定手机号码后，使用手机号码登录后获得的用户证书：与原有用户证书不匹配');
    });

    it('切换到长连接模式，再次进行系列业务测试', async () => {
        remote.setmode(remote.CommMode.ws);
        wxUserPhone = ((Math.random() * 100000000) | 0).toString(); //更新用于绑定的手机号码，避免再次绑定时失败
    });

    it('两阶段认证登录，使用负载均衡', async () => {
        //初始化连接器，只保留原始配置信息
        remote.init();

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
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code == 0);
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        await remote.fetching({func: "test.echo"});
    });

    it('第三方授权登录，使用负载均衡', async () => {
        //断开连接，清理之前的认证信息
        remote.init();

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
    
        authUser = remote.userInfo.openid;

        //执行业务流程
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code == 0);
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
        remote.init();

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
        assert(remote.userInfo.openid == authUser, '绑定手机号码后，使用手机号码登录后获得的用户证书：与原有用户证书不匹配');
    });
});
