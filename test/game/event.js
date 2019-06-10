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

describe('游戏云基本连接测试', () => {
    it('短连接注册并登录 - 自动负载均衡', async () => {
        remote.events.on('hello', msg => {
            console.log(msg);
        });
        remote.events.emit('hello', {id:3});
    });
});
