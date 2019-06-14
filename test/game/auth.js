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
    "UrlHead": "http",              //协议选择: http/https
    "webserver": { 
        //注意：如果需要负载均衡，这里一般指定负载均衡服务器地址，否则直接填写业务主机地址
        "host": "127.0.0.1",        //远程主机地址
        "authPort": 9601,           //签证主机端口
        "port": 9901                //远程主机端口
    },
}).setFetch(require('node-fetch')); //设置node环境下兼容的fetch函数

//设定一个随机的、用于后期绑定的手机号码
let UserPhone_wx = ((Math.random() * 100000000) | 0).toString();
//为两阶段验证设定一个随机的手机号码
let UserPhone_2step = ((Math.random() * 100000000) | 0).toString();

//用于验证后期绑定成功的用户证书缓存变量
let authUser = '';

describe.only('游戏云注册登录测试', () => {
    it('两阶段认证登录，使用负载均衡', async () => {
        //执行登录操作，通过配置对象传入用户信息，并指定签证方式为两阶段认证
        let ret = await remote.init(/*初始化连接器，只保留原始配置信息*/).login({
            domain: 'auth2step',        //签证方式
            openid: UserPhone_2step,    //客户端指定的用户登录标识
            addrType: 'phone',          //验证方式
            address: UserPhone_2step,   //验证地址
        });
        assert(ret, 'login failed');
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        if (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, address: remote.userInfo.address});
            assert(msg.code == 0, 'getKey error');

            //当用户输入验证码时，使用事件驱动登录操作
            remote.events.emit('authcode', msg.data);
            await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
        }
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code == 0);
    });

    it('第三方授权登录，使用负载均衡', async () => {
        let ret = await remote.init().login({
            domain: 'authwx',                           //认证模式
            openkey: `${Math.random()*1000000000 | 0}`, //中间证书，填写于 openkey 而非 openid 上，服务端转换最终的 openid 后下发给客户端
        });
        assert(ret, 'login failed');
    
        //记录当前有效的用户登录标识
        authUser = remote.userInfo.openid;
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code==0);
    });

    it('登录成功后，输入手机号码进行后期绑定', async () => {
        let msg = await remote.fetching({func: "bindafter.auth", addrType: 'phone', address: UserPhone_wx});
        assert(msg.code == 0, 'bindafter.auth error');

        let auth = msg.data; //保存返回的签名数据集，稍后和手机号码一并上传

        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        msg = await remote.fetching({func:`bindafter.getKey`}); //查询短信验证码，该接口仅供测试
        assert(msg.code == 0, 'getKey error');

        //用户输入验证码
        msg = await remote.fetching({func:`bindafter.check`, auth: auth, openkey: msg.data}); //查询短信验证码，该接口仅供测试
        assert(msg.code == 0, 'bindafter.check error');
        await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
    });

    it('后期绑定成功后，使用手机号码进行两阶段登录，登录同一个账户', async () => {
        let ret = await remote.init().login({
            domain: 'auth2step',        //验证模式
            openid: UserPhone_2step,    //用户标识
            addrType: 'phone',          //验证方式
            address: UserPhone_wx,      //验证地址
        });
        assert(ret, 'login failed');
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        if (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, address: remote.userInfo.address});
            assert(msg.code == 0, 'getKey error');

            //当用户输入验证码时，使用事件驱动登录操作
            remote.events.emit('authcode', msg.data);
            await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(2000);
        }
    
        assert(remote.userInfo.openid == authUser, '绑定手机号码后，使用手机号码登录后获得的用户证书：与原有用户证书不匹配');
    });

    it('切换到长连接模式，再次进行系列业务测试', async () => {
        remote.setmode(remote.CommMode.ws);
        //更新测试用手机号码，避免再次绑定时失败
        UserPhone_wx = ((Math.random() * 100000000) | 0).toString(); 
        UserPhone_2step = ((Math.random() * 100000000) | 0).toString();
    });

    it('两阶段认证登录，使用负载均衡', async () => {
        let ret = await remote.init().login({
            domain: 'auth2step',        //验证模式
            openid: UserPhone_2step,    //用户标识
            addrType: 'phone',          //验证方式
            address: UserPhone_2step,   //验证地址
        });
        assert(ret, 'login failed');
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        if (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, address: remote.userInfo.address});
            assert(msg.code == 0, 'getKey error');

            //当用户输入验证码时，使用事件驱动登录操作
            remote.events.emit('authcode', msg.data);
            await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
        }
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        //执行业务流程
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code == 0);
    });

    it('第三方授权登录，使用负载均衡', async () => {
        let ret = await remote.init().login({
            domain: 'authwx',
            openkey: `${Math.random()*1000000000 | 0}`,
        });
        assert(ret, 'login failed');
    
        authUser = remote.userInfo.openid;
    });

    it('登录成功后，依靠token通过用户认证，并执行业务指令', async () => {
        let msg = await remote.fetching({func: "test.echo"});
        assert(msg.code == 0);
    });

    it('登录成功后，输入手机号码进行后期绑定', async () => {
        let msg = await remote.fetching({func: "bindafter.auth", addrType: 'phone', address: UserPhone_wx});
        assert(msg.code == 0, 'bindafter.auth error');

        let auth = msg.data;

        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        msg = await remote.fetching({func:`bindafter.getKey`}); //查询短信验证码，该接口仅供测试
        assert(msg.code == 0, 'getKey error');

        //用户输入验证码
        msg = await remote.fetching({func:`bindafter.check`, auth: auth, openkey: msg.data}); //查询短信验证码，该接口仅供测试
        assert(msg.code == 0, 'bindafter.check error');

        await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
    });

    it('后期绑定成功后，使用手机号码进行两阶段登录，登录同一个账户', async () => {
        let ret = await remote.init().login({
            domain: 'auth2step',        //验证模式
            openid: '13888888888',      //用户标识
            addrType: 'phone',          //验证方式
            address: UserPhone_wx,      //验证地址
        });
        assert(ret, 'login failed');
    
        //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
        if (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
            //查询短信验证码，该接口仅供测试
            let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, address: remote.userInfo.address});
            assert(msg.code == 0, 'getKey error');

            //当用户输入验证码时，使用事件驱动登录操作
            remote.events.emit('authcode', msg.data);
            await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(2000);
        }
    
        assert(remote.userInfo.openid == authUser, '绑定手机号码后，使用手机号码登录后获得的用户证书：与原有用户证书不匹配');
    });
});
