/**
 * 联机单元测试：本地全节点提供运行时环境
 */

//引入连接游戏云的远程连接器
const conn = require('../../src/gameConn')

//创建连接器对象
let remote = new conn({
    "UrlHead": "http",              //协议选择: http/https
    "webserver": { 
        //注意：如果需要负载均衡，这里一般指定负载均衡服务器地址，否则直接填写业务主机地址
        "host": "127.0.0.1",        //远程主机地址
        "port": 9901                //远程主机端口
    },
})
.setFetch(require('node-fetch')); //设置node环境下兼容的fetch函数

let domain = 'authwx';

async function execute(params, longpoll) {
    remote.events.on('onConnect', async ()=>{
        //断线重连时，重新登录
        //await remote.getToken();
    });

    if(longpoll) {
        //设置为长连模式
        remote.setmode(conn.CommMode.ws);
    }

    //如果需要负载均衡，选择执行如下语句，否则跳过
    if(!(await remote.setLB())) {
        throw(new Error('lbs error'));
    }

    //浏览器直接登录时执行此操作获取签名，服务端会将验证码通过邮件或短信下发
    //微信或QQ环境内跳过此步
    await remote.getSign();

    //查询短信验证码，该接口仅供测试
    let msg = await remote.fetching({func:`${domain}.getKey`, id: remote.userInfo.openid});
    remote.setUserInfo({openkey: msg.code});

    await remote.getToken();

    //执行业务流程
    msg = await remote.fetching(params);
    remote.isSuccess(msg, true);
}

describe.only('游戏云基本连接测试', () => {
    beforeEach(()=>{
        //设置用户基本信息
        remote.setUserInfo({
            domain: domain,
            openid: `${Math.random()*1000000000 | 0}`,
            openkey: '',
        });
    });

    it('短连接注册并登录 - 自动负载均衡', async () => {
        for(let i = 0; i < 1; i++) {
            await execute({func: "test.echo"});
        }
    });

    it('长连接注册并登录 - 自动负载均衡', async () => {
        for(let i = 0; i < 1; i++) {
            await execute({func: "test.echo"}, true);
        }
    });
});
