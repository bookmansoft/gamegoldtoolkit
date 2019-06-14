/**
 * 联机单元测试：事件模型
 */

//引入连接游戏云的远程连接器
const conn = require('../../src/gameConn')

//创建连接器对象
let remote = new conn({
    "UrlHead": "http",              //协议选择: http/https
    "webserver": { 
        //注意：如果需要负载均衡，这里一般指定负载均衡服务器地址，否则直接填写业务主机地址
        "host": "127.0.0.1",        //远程主机地址
        "authPort": 9601,           //签证主机端口
        "port": 9901                //远程主机端口
    },
})
.setFetch(require('node-fetch')); //设置node环境下兼容的fetch函数

describe('事件模型测试', () => {
    it('测试消息的发送和监听', async () => {
        remote.events.on('hello', msg => {
            console.log(msg);
        });
        remote.events.emit('hello', {id:3});
    });

    it('测试消息监听和移除监听', async () => {
        //必须声明一个非匿名函数，才能用于移除流程
        async function onConnect() {
            await remote.login();
        }

        //反复监听和移除，没有导致监听句柄数量超限，说明移除成功
        for(let i = 0; i < 1000; i++) {
            remote.events.on('onConnect', onConnect);
            remote.events.removeListener('onConnect', onConnect);
        }
    });
});
