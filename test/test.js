/**
 * 联机单元测试：本地全节点提供运行时环境
 */

//引入授权式连接器
const remote = require('../src/authConn')

//设置授权式连接器的网络类型和对应参数，网络类型分为 testnet 和 main
remote.setup({
    type:   'testnet',            //远程全节点类型
    ip:     '127.0.0.1',          //远程全节点地址
    apiKey: 'bookmansoft',        //远程全节点基本校验密码
    id:     'primary',            //默认访问的钱包编号
    cid:    'xxxxxxxx-game-gold-root-xxxxxxxxxxxx', //授权节点编号，用于访问远程钱包时的认证
    token:  '03aee0ed00c6ad4819641c7201f4f44289564ac4e816918828703eecf49e382d08', //授权节点令牌固定量，用于访问远程钱包时的认证
});

describe.only('道具管理流程', () => {
    it('设定厂商和转移地址信息', async () => {
        let ret = await remote.execute('balance.all', []);
        console.log(ret);
    });
});
