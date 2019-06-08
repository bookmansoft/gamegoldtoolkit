/**
 * 单元测试：注册登录、简单应答、推送
 * Creted by liub 2017.3.24
 */

const conn = require('../../src/authConn')
const assert = require('../../src/utils/assert')

let remote = (new conn()).setFetch(require('node-fetch')).setup({structured: true,});
let remotenew = (new conn()).setFetch(require('node-fetch')).setup({structured: true,});

function payload() {
    return Buffer.from('hello world', 'hex');
}

let alice = {
    id: 10005882,
    conn : remote,
    secret: new conn.Secret(),
};

let bob = {
    id: 10005883,
    conn : remotenew,
    secret: new conn.Secret(),
};

//一组单元测试流程
describe('私密信息', function() {
    it('should do init', () => {
        //bob生成握手请求并发送给alice
        let init = bob.secret.toEncinit();
        //alice利用握手请求初始化
        alice.secret.encinit(init.publicKey, init.cipher);
        //alice生成握手应答并发送给bob
        let acka = alice.secret.toEncack();
        //bob利用握手应答完成握手
        bob.secret.encack(acka.publicKey);
    
        //alice生成握手请求并发送给bob
        init = alice.secret.toEncinit();
        //bob利用握手请求初始化
        bob.secret.encinit(init.publicKey, init.cipher);
        //bob生成握手应答并发送给alice
        let ackb = bob.secret.toEncack();
        //alice利用握手应答完成握手
        alice.secret.encack(ackb.publicKey);
    
        assert(alice.secret.handshake);
        assert(bob.secret.handshake);
        assert(alice.secret.isReady());
        assert(bob.secret.isReady());
    });
    
    it('should encrypt payload from client to server', () => {
        //alice加密消息(包含消息头和消息体)并发送给bob
        const packet = alice.secret.packet('fake', payload());
    
        bob.secret.once('packet', (cmd, body) => {
          //断言解密结果正确与否
          assert.strictEqual(cmd, 'fake');
          assert.bufferEqual(body, payload());
        });
    
        //bob解密消息
        bob.secret.feed(packet);
    });
});
