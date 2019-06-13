# 游戏云连接器 gamerpc

gamerpc 是 Vallnet 项目的配套工具箱，提供如下辅助功能：
1. 帮助第三方项目连接 Gamegold Core 对等网络，发起RPC调用，订阅推送消息
2. 帮助第三方项目连接 Gamecloud 游戏云服务器，发起RPC调用，订阅推送消息
3. 提供多种数据校验、智能合约解读等函数
4. 封装常用功能，如认证令牌的生成和校验、订单支付接口等

## git

```
git clone https://github.com/bookmansoft/gamegoldtoolkit
```

## 安装依赖包

```
npm i
```

## 测试 (require mocha)

```bash
npm run test
```

单元测试中也包含了各类场景的应用实例

## 打包

```bash
npm run build
```

上述命令会在 ./lib 目录下生成形如 'gamerpc{version}.js' 的打包文件

## 第三方项目直接引用 gamerpc

```bash
npm i gamerpc
```

```js
//node
const toolkit = require('gamerpc')

//react
import toolkit from require('gamerpc')
```

## 第三方网页包含引用 gamerpc

```html
<head>
	<script src="../lib/gamerpc1.7.8.js"></script>
</head>
```

范例参见 ./test/test.html (请在必要时手工修改页面包含文件的链接地址)
