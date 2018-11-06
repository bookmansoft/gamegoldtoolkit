/**
 * 联机单元测试：本地全节点提供运行时环境
 */

//引入授权式连接器
const sclient = require('socket.io-client')
const conn = require('../src/authConn')
console.log(typeof ac);
//设置node环境下兼容的fetch函数
const fetch = require('node-fetch')

let remote = new conn(sclient);
remote.setFetch(fetch).setup(
    {//设置授权式连接器的网络类型和对应参数，网络类型分为 testnet 和 main
        type:   'testnet',            //远程全节点类型
        ip:     '127.0.0.1',          //远程全节点地址
        apiKey: 'bookmansoft',        //远程全节点基本校验密码
        id:     'primary',            //默认访问的钱包编号
        cid:    'xxxxxxxx-game-gold-root-xxxxxxxxxxxx', //授权节点编号，用于访问远程钱包时的认证
        token:  '03aee0ed00c6ad4819641c7201f4f44289564ac4e816918828703eecf49e382d08', //授权节点令牌固定量，用于访问远程钱包时的认证
    }
);

describe('模拟测试', () => {
    it('WEB模式查询余额', async () => {
        let ret = await remote.execute('balance.all', []);
        console.log(ret);
    });

    it('WS模式查询余额', done => {
        remote.setmode(remote.CommMode.ws).execute('token.random', ['xxxxxxxx-game-gold-root-xxxxxxxxxxxx'], (err, msg) =>{
            const hmac = remote.createHmac('sha256', msg);
            let token = hmac.update('03aee0ed00c6ad4819641c7201f4f44289564ac4e816918828703eecf49e382d08').digest('hex'); //计算并附加访问令牌

            remote.execute('wallet.auth', [
                'bookmansoft',                                                          // 基本校验密码 apiKey
                'testnet',                                                              // 网络类型 network
                'primary',                                                              // 钱包编号 walletId
                'xxxxxxxx-game-gold-root-xxxxxxxxxxxx',                                 // 授权节点编号 cid，用于访问远程钱包时的认证
                token,                                                                  // 授权节点令牌随机量
            ], (err, msg) => {
                remote.execute('balance.all', [], (err, msg)=>{
                    console.log(msg.result);
                    done();
                });
            });
        });
    });
});
