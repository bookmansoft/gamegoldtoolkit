/**
 * 联机单元测试：远程管理
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

//切换为长连模式
//remote.setmode(remote.CommMode.ws);

//这里需要填充管理员登录信息
let admin = {
    openid: '',
    openkey: '',
}

describe('远程管理', () => {
    it.skip('执行索引服远程指令 remote.printInfo', async () => {
        await remote.init(/*初始化连接器，只保留原始配置信息*/).login({
            domain: 'CoreOfIndex',
            openid: admin.openid,
            openkey: admin.openkey,
        });
    
        let msg = await remote.fetching({func: "remote.printInfo"});
        console.log(msg);
    });
    
    it.skip('透过索引服执行业务服远程指令 remote.command printInfo', async () => {
        await remote.init(/*初始化连接器，只保留原始配置信息*/).login({
            domain: 'CoreOfIndex',
            openid: admin.openid,
            openkey: admin.openkey,
        });
    
        let msg = await remote.fetching({func: "remote.command", data: ['printInfo', 'CoreOfChickIOS', '1']});
        console.log(msg);
    });

    it('模拟用户注册并登录', async () => {
        //执行登录操作，通过配置对象传入用户信息，并指定签证方式为两阶段认证
        let auth = {
            cpId: 'c376af60-cab5-11ed-90e8-25399b14218a',
            addr: '10000000',
            name: 'bookman',
            bonus: '',
            time: Date.now(),
        };

        //需要正确填充 auth.sign, 此处采用模拟命令填充, 注意命令 testSign 只在测试模式下开启
        await remote.init().login({
            domain: 'CoreOfIndex',
            openid: admin.openid,
            openkey: admin.openkey,
        });
        let msg = await remote.fetching({func: "remote.command", data: ['testSign', 'CoreOfChickIOS', '1', auth]});
        auth.sign = msg['CoreOfChickIOS.1'].sign;

        let ret = await remote.init().login({
            domain: 'CoreOfChickIOS',      //登录域
            openid: `bxs.${auth.addr}`,    //用户登录标识，含验证方式
            auth,
        });
        if(!!ret) {
            ret = await remote.fetching({func: "test.echo"});
            assert(ret.code == 0);
        }
    });
});
