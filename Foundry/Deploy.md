# GreenTrace 生态系统部署信息

## 部署概览

- **部署时间**: 2025年06月19日
- **网络**: Sepolia 测试网
- **部署者地址**: 私钥
- **部署方式**: 分步部署 (DeployStepByStep.s.sol)
- **总Gas消耗**: 9,574,914 gas
- **总费用**: 0.000017442228262326 ETH

## 合约地址列表

### 1. CarbonToken (碳币合约)

- **合约地址**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **Etherscan**: [查看合约](https://sepolia.etherscan.io/address/0x808b73A3A1D97382acF32d4F4F834e799Aa08198)
- **部署交易**: `0xcb970676186faf3276dd671472b924098da0a00da5a9896c17774c62d3cbda3c`
- **初始供应量**: 1,000,000 碳币 (1,000,000 * 10^18)
- **接收地址**: `0x294761C91734360C5A70e33F8372778ED2849767`

### 2. GreenTrace (核心合约)

- **合约地址**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`
- **Etherscan**: [查看合约](https://sepolia.etherscan.io/address/0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673)
- **部署交易**: `0x207d0680a5708c5669479662931af444a19109012c1a5ffacfd4d1fa78d92b80`
- **碳币合约**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **NFT合约**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`

### 3. GreenTalesNFT (NFT合约)

- **合约地址**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`
- **Etherscan**: [查看合约](https://sepolia.etherscan.io/address/0x3456a42043955B1626F6353936c0FEfCd1cB5f1c)
- **部署交易**: `0xea119be0d14dc897d39aafe51ea45faabc78b8c5b2c48de5d6df988564f34a56`
- **GreenTrace合约**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`

### 4. CarbonPriceOracle (碳价预言机)

- **合约地址**: `0x619953d9a7D946360E53f9aFF79ed8F2b3Cd3E6c`
- **Etherscan**: [查看合约](https://sepolia.etherscan.io/address/0x619953d9a7D946360E53f9aFF79ed8F2b3Cd3E6c)
- **部署交易**: `0x122969fd546d79e1fbbf55fbc3e53944ac2fd692634334834c40602c60cf1aa0`
- **Functions Router**: `0x6E2dc0F9DB014aE19888F539E59285D2Ea04244C`
- **DON ID**: `0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000`
- **EUR/USD Feed**: `0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910`
- **LINK Token**: `0x779877A7B0D9E8603169DdbD7836e478b4624789`

### 5. GreenTalesLiquidityPool (流动性池)

- **合约地址**: `0x6c9c8c371cBD71108e272D20c86978AdB2f9a114`
- **Etherscan**: [查看合约](https://sepolia.etherscan.io/address/0x6c9c8c371cBD71108e272D20c86978AdB2f9a114)
- **部署交易**: `0x3983d5335aeb595a648aaebadedd41855231a49bc848fc3a00c2568ffe86f0ba`
- **碳币合约**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **USDT合约**: `0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7`
- **碳价预言机**: `0x619953d9a7D946360E53f9aFF79ed8F2b3Cd3E6c`

### 6. GreenTalesMarket (NFT市场)

- **合约地址**: `0x82c59961a858f92816d61be7Ec28541E51d37224`
- **Etherscan**: [查看合约](https://sepolia.etherscan.io/address/0x82c59961a858f92816d61be7Ec28541E51d37224)
- **部署交易**: `0xe71d9e068aba8249136adba707e67d00c0dd2e4b08777fcde69a821f56cd0004`
- **NFT合约**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`
- **碳币合约**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **手续费率**: 1% (100/10000)
- **手续费接收地址**: `0x294761C91734360C5A70e33F8372778ED2849767`
- **GreenTrace合约**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`

## 网络配置

### Sepolia 测试网地址

- **USDT**: `0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7` (18位精度)
- **EUR/USD 价格预言机**: `0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910`
- **Chainlink Token**: `0x779877A7B0D9E8603169DdbD7836e478b4624789`
- **Functions Router**: `0x6E2dc0F9DB014aE19888F539E59285D2Ea04244C`
- **DON ID**: `0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000`

## 部署参数

### 初始配置

- **初始碳币供应量**: 1,000,000 碳币
- **初始USDT数量**: 88,000,000 USDT (18位精度)
- **初始价格**: 88 USDT/碳币
- **市场手续费率**: 1%
- **流动性池手续费率**: 0.3%
- **价格偏离阈值**: 10%

### 合约初始化状态

- ✅ CarbonToken 已部署并分配初始供应量
- ✅ GreenTrace 已部署并设置碳币合约
- ✅ GreenTalesNFT 已部署并设置GreenTrace地址
- ✅ 合约间依赖关系已正确设置
- ✅ GreenTrace 已初始化
- ✅ CarbonPriceOracle 已部署
- ✅ GreenTalesLiquidityPool 已部署并设置预言机
- ✅ GreenTalesMarket 已部署

## 下一步操作

### 1. 配置预言机

```bash
# 更新 .env 文件
CARBON_PRICE_ORACLE_ADDRESS=0x619953d9a7D946360E53f9aFF79ed8F2b3Cd3E6c
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=5045

# 运行配置脚本
forge script script/ConfigureOracle.s.sol:ConfigureOracle \
  --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY \
  --private-key YOUR_PRIVATE_KEY \
  --broadcast -vvvv
```

🎉 预言机配置成功！

🎉 太棒了！预言机合约部署成功！

## 部署结果：

* ✅ 新预言机地址: 0xFDA7AaAB821186B9fABa7B0418df0f514d221dec
* ✅ 订阅ID: 5045
* ✅ 操作员: 0x294761C91734360C5A70e33F8372778ED2849767
* ✅ 初始Gas限制: 1,000,000
* ✅ 部署费用: 0.000002566139463261 ETH

## 下一步操作：

## ✅ 配置完成状态：

### 1. 订阅ID设置成功

* 订阅ID: 5045
* 交易哈希: 0x93ce804f0abacb0ee54aa2f14a1cd6c1ea18a3ff4b88539bfd1c0f0cfa5094db

### 2. 操作员添加成功

* 操作员地址: 0x4b5EF7cA580Db6f98D794A1b78d56773Bc83F9D3
* 交易哈希: 0x8e65f864de9f5c3e824d1e2cebfee80fe683700c259523a90e4800c07d6db86b

### 3. 验证通过

* ✅ 订阅ID验证成功
* ✅ 操作员权限验证成功

### 2. 初始化流动性池

```bash
# 授权USDT给流动性池
cast send 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7 \
  "approve(address,uint256)" \
  0x6c9c8c371cBD71108e272D20c86978AdB2f9a114 \
  44000000000000000000000000 \
  --private-key YOUR_PRIVATE_KEY

# 添加流动性
cast send 0x6c9c8c371cBD71108e272D20c86978AdB2f9a114 \
  "addLiquidity(uint256,uint256)" \
  500000000000000000000000 \
  44000000000000000000000000 \
  --private-key YOUR_PRIVATE_KEY
```

流动性池初始化成功！

* 交易哈希：0xd724ef8904a3881deda2b6c5e6c476f1ebc753949e59169ca764a03796fc46aa
* 区块号：8576809
* 状态：成功

你已经成功向流动性池 0x6c9c8c371cBD71108e272D20c86978AdB2f9a114 添加了* 50万碳币（500000 \* 1e18）

* 4400万 USDT（44,000,000 \* 1e18）

https://sepolia.etherscan.io/tx/0xd724ef8904a3881deda2b6c5e6c476f1ebc753949e59169ca764a03796fc46aa

### 

3. 测试预言机

```bash
# 请求更新碳价
cast send 0x619953d9a7D946360E53f9aFF79ed8F2b3Cd3E6c \
  "requestCarbonPrice()" \
  --private-key YOUR_PRIVATE_KEY
```

✅ 交易详情：

* 交易哈希: 0xca7bb7584d8db765219591efd79c722abe0661a9dfa9b70445764b01dec3e3e8
* 区块号: 8576786
* 状态: 成功执行
* Gas消耗: 48,043 gas

你可以查看 PriceUpdated 事件：

🔍 查看方式：

1Etherscan 合约页面（推荐）

访问你的预言机合约页面：

https://sepolia.etherscan.io/address/0x619953d9a7D946360E53f9aFF79ed8F2b3Cd3E6c

然后：* 点击 "Events" 标签页

* 查看是否有新的 PriceUpdated 事件
* 事件会显示欧元价格、美元价格和时间戳
*

2.或者

cast logs 0x619953d9a7D946360E53f9aFF79ed8F2b3Cd3E6c --from-block 8576786 --rpc-url https://eth-sepolia.g.alchemy.com/v2/hAep1geH-r3ppdFDXWBK5Ymvmn9Zl7ql

## 合约验证状态

所有合约已通过 Etherscan 验证：

- ✅ CarbonToken - 已验证
- ✅ GreenTrace - 已验证
- ✅ GreenTalesNFT - 已验证
- ✅ CarbonPriceOracle - 已验证
- ✅ GreenTalesLiquidityPool - 已验证
- ✅ GreenTalesMarket - 已验证

## 注意事项

1. **USDT精度**: Sepolia测试网USDT使用18位精度，与主网6位精度不同
2. **预言机配置**: 需要设置订阅ID和操作员权限
3. **流动性初始化**: 需要先授权USDT，再添加流动性
4. **API集成**: 预言机已配置为调用 `https://greentrace-api.onrender.com/api/carbon-price`
5. **价格偏离检查**: 流动性池已设置10%的价格偏离阈值

## 部署脚本

- **分步部署脚本**: `script/DeployStepByStep.s.sol`
- **配置脚本**: `script/ConfigureOracle.s.sol`
- **完成初始化脚本**: `script/CompleteInitialization.s.sol`

---

*部署完成时间: 2024年12月19日*
*部署者: 0x294761C91734360C5A70e33F8372778ED2849767*
