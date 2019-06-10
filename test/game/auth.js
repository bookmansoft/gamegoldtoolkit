/**
 * 联机单元测试：本地全节点提供运行时环境
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

async function execute(params) {
    if(!remote.status.check(remote.CommStatus.logined)) {
        await remote.login();
    }

    //此处只是模拟用户输入验证码的流程，实际运用中，当用户提交验证码时应立即触发 authcode 事件
    while (remote.loginMode.check(remote.CommStatus.reqSign) && !remote.status.check(remote.CommStatus.signCode)) {
        //查询短信验证码，该接口仅供测试
        let msg = await remote.fetching({func:`${remote.userInfo.domain}.getKey`, id: remote.userInfo.openid});

        //使用事件驱动登录
        remote.events.emit('authcode', msg.code);
        await (async function(time){return new Promise(resolve =>{setTimeout(resolve, time);});})(1000);
    }

    //执行业务流程
    let msg = await remote.fetching(params);
    remote.isSuccess(msg, true);
}

describe.only('游戏云基本连接测试', () => {
    it('event', async () => {
        async function onConnect() {
            await remote.login();
        }

        for(let i = 0; i < 1000; i++) {
            remote.events.on('onConnect', onConnect);
            remote.events.removeListener('onConnect', onConnect);
        }
    });

    it('短连接注册并登录 - 自动负载均衡', async () => {
        //设置用户基本信息
        remote.setUserInfo({
            domain: 'authwx',
            openid: `${Math.random()*1000000000 | 0}`,
            openkey: '',
        }, remote.CommStatus.reqLb | remote.CommStatus.reqSign);

        for(let i = 0; i < 10; i++) {
            await execute({func: "test.echo"});
        }
    });

    it('长连接注册并登录 - 自动负载均衡', async () => {
        //设置用户基本信息
        remote.setUserInfo({
            domain: 'authwx',
            openid: `${Math.random()*1000000000 | 0}`,
            openkey: '',
        }, remote.CommStatus.reqLb | remote.CommStatus.reqSign);

        //设置为长连模式
        remote.setmode(remote.CommMode.ws);

        for(let i = 0; i < 10; i++) {
            await execute({func: "test.echo"});
        }
    });
});
