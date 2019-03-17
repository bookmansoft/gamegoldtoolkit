const assert = require('assert')
const toolkit = require('../../src/')

describe('常用加解密、验证算法', function(){
    /**
     * 加解密
     */
    it('encrypt/decrypt', async () => {
        let key = '$-._s1ZshKZ6WissH5gOs1ZshKZ6Wiss'; //32位长度
        let iv = '$-._aB9601152555'; //16位长度

        //原始字符串
        let data = JSON.stringify({
            "request_no":"1000000004",
            "service_code":"FS0001",
            "contract_id":"test20171225111852",
            "activity_id":"104817",
            "phone_id":"18022887432",
            "order_type":"1",
            "plat_offer_id":"103050",
            "effect_type":"0"
        });

        //对字符串进行加解密
        let result = toolkit.encrypt(key, iv, data);
        result = toolkit.decrypt(key, iv, result);

        //断言两者相等
        assert(result === data);
    })
});
