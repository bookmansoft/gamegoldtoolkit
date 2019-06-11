/**
 * 联机单元测试：客户端用户注册登录流程
 * 
 * 以下单元测试演示多种不同的登录模式：
 * 1. 第三方授权登录：如微信、QQ、360，其特点是事先拿到签名数据，送至服务端校验
 * 2. 官网用户名/密码登录：用户输入用户名和密码直接登录，其中密码做md5后送至服务端比对
 * 3. 两阶段登录：首先发送用户信息和手机号码到服务端，服务端通过短信下行验证码，用户再次输入验证码登录
 * 4. 令牌登录：使用上述三种方式成功登录后，服务端签发一张令牌，可以在有效期内持令牌登录，令牌失效后则需要重新登录
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

async function funcCall() {
    //执行业务流程
    try {
        let msg = await remote.fetching({func: "test.echo"});
        remote.isSuccess(msg, true);
    } catch(e) {
        console.error(e);
    }
}

describe.only('游戏云基本连接测试', () => {
    it('官网用户名密码登录，使用负载均衡', async () => {
        //设置用户基本信息
        remote.setUserInfo({
            domain: 'authofficial',
            openid: `bookman`,
            openkey: remote.hash256('hello').toString('base64'),
        }, remote.CommStatus.reqLb);

        await remote.login();

        await funcCall(); //在登录成功后，尝试执行业务指令
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        await funcCall();
    });

    it('两阶段认证登录，使用负载均衡', async () => {
        remote.close();

        //设置用户基本信息
        remote.setUserInfo({
            domain: 'auth2step',
            openid: `${Math.random()*1000000000 | 0}`,
            openkey: '',
        }, remote.CommStatus.reqLb | remote.CommStatus.reqSign);

        let ret = await remote.login();
        if(ret.errcode != 'success') {
            console.log(ret.errmsg);
            return ;
        }
        console.log(ret.result);
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        while (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, id: remote.userInfo.openid});
    
            //当用户输入验证码时，使用事件驱动登录操作
            remote.events.emit('authcode', msg.code);
            await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
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
        await funcCall();
    });

    it('第三方授权登录，使用负载均衡', async () => {
        remote.close();

        //设置用户基本信息
        remote.setUserInfo({
            domain: 'authwx',
            openid: `${Math.random()*1000000000 | 0}`,
            openkey: '',
        }, remote.CommStatus.reqLb | remote.CommStatus.reqSign);

        let ret = await remote.login();
        if(ret.errcode != 'success') {
            console.log(ret.errmsg);
            return ;
        }
        console.log(ret.result);
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        while (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, id: remote.userInfo.openid});
    
            //当用户输入验证码时，使用事件驱动登录操作
            remote.events.emit('authcode', msg.code);
            await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
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
        await funcCall();
    });
});
