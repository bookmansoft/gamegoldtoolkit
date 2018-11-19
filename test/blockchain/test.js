/**
 * 联机单元测试：本地全节点提供运行时环境
 */

//引入授权式连接器
const conn = require('../../src/authConn')
let remote = new conn();

remote.setFetch(require('node-fetch')) //设置node环境下兼容的fetch函数
.setup({//设置授权式连接器的网络类型和对应参数，网络类型分为 testnet 和 main
        type:   'testnet',            //远程全节点类型
        ip:     '127.0.0.1',          //远程全节点地址
        apiKey: 'bookmansoft',        //远程全节点基本校验密码
        id:     'primary',            //默认访问的钱包编号
        cid:    'xxxxxxxx-game-gold-root-xxxxxxxxxxxx', //授权节点编号，用于访问远程钱包时的认证
        token:  '03aee0ed00c6ad4819641c7201f4f44289564ac4e816918828703eecf49e382d08', //授权节点令牌固定量，用于访问远程钱包时的认证
    }
);

describe('模拟测试', () => {
    it('RESTFUL/GET 查询区块信息', async () => {
        let ret = await remote.get('block/4d80d69a80967c6609fa2606e07fb7e3ad51f8338ce2f31651cb0acdd9250000');
        console.log(ret);
    });

    it('RESTFUL/POST 查询UTXO', async () => {
        let ret = await remote.post('addrs/utxo', {addr: 'tb1q85plul700aev4xasad0525a777y04wjkpwh74r'});
        console.log(ret);
    });

    it('WEB模式查询余额', async () => {
        let ret = await remote.execute('balance.all', []);
        console.log(ret);
    });

    it('WS模式查询余额', async () => {
        await remote.setmode(remote.CommMode.ws).login();
        let ret = await remote.execute('balance.all', []);
        //注意：使用WS时返回值包含一个嵌套格式，和WEB模式不同
        console.log('命令序列号', ret.id);
        console.log('返回值', ret.result);
        console.log('错误值', ret.error);
    });
});
