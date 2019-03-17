/**
 * 工具测试：
 */

//引入工具
const assert = require('assert');
const toolkit = require('../../src/')

describe('地址校验测试', () => {
    /**
     * 一个单元测试，可使用 skip only 修饰
     * 和负载均衡相关的单元测试，首先连接9901端口，发送config.getServerInfo请求，携带 "stype":"IOS", "oemInfo":{"openid":'helloworl'} 等参数，返回值：data.newbie:是否新注册用户 data.ip:服务器IP, data.port:服务器端口号
     */
    it('验证正确地址 - '/*单元测试的标题*/, /*单元测试的函数体，书写测试流程*/ async () => {
        let ret = toolkit.verifyAddress("tb1qtgsfdwatlmgup0y9l34pxvph33p4649psg8vjq", "testnet");
        assert(ret.result);
    });

    it('验证错误地址- '/*单元测试的标题*/, /*单元测试的函数体，书写测试流程*/ async () => {
        let ret = toolkit.verifyAddress("tb1sfdwatlmgup0y9l34pxvph33p4649psg8vjq11212", "testnet");
        assert(!ret.result);
        console.log(ret.error.type, ret.error.message);
  });
});
