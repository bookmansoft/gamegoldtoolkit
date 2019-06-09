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

async function execute(params, longpoll) {
    if(longpoll) {
        //设置为长连模式
        remote.setmode(conn.CommMode.ws);
    }

    //如果需要负载均衡，选择执行如下语句，否则跳过
    if(!(await remote.setLB())) {
        throw(new Error('lbs error'));
    }

    //执行业务流程，连接器会自动检测，必要时先执行登录操作
    let msg = await remote.fetching(params);
    remote.isSuccess(msg, true);
}

describe('游戏云基本连接测试', () => {
    beforeEach(()=>{
        //设置用户基本信息
        remote.setUserInfo({
            domain: 'tx.IOS', 
            openid: `${Math.random()*1000000000 | 0}`,
            openkey: '',
            authControl: 'UserDefine',
        });
    });

    it('短连接注册并登录 - 自动负载均衡', async () => {
        for(let i = 0; i < 1; i++) {
            await execute({func: "getEffect"});
        }
    });

    it('长连接注册并登录 - 自动负载均衡', async () => {
        for(let i = 0; i < 1; i++) {
            await execute({func: "getEffect"}, true);
        }
    });
});
