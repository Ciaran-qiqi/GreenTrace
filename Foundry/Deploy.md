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

### 4. GreenTalesMarket (NFT市场)

- **合约地址**: `0x82c59961a858f92816d61be7Ec28541E51d37224`
- **Etherscan**: [查看合约](https://sepolia.etherscan.io/address/0x82c59961a858f92816d61be7Ec28541E51d37224)
- **部署交易**: `0xe71d9e068aba8249136adba707e67d00c0dd2e4b08777fcde69a821f56cd0004`
- **NFT合约**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`
- **碳币合约**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **手续费率**: 1% (100/10000)
- **手续费接收地址**: `0x294761C91734360C5A70e33F8372778ED2849767`
- **GreenTrace合约**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`

### **5. CarbonPriceOracle (碳价预言机)**

- 合约地址：0xe3e2262fb8c00374b1e73f34ae34df2ce36f03fa
- **Etherscan：**[查看合约](https://sepolia.etherscan.io/address/0xe3e2262fb8c00374b1e73f34ae34df2ce36f03fa)
- 主要功能：requestCarbonPrice(0x07ca5e23)

### 6. GreenTalesLiquidityPool (流动性池)

* 合约地址: 0x299491bF3556e506D4545B0B35FB04f26017f191
* Etherscan: [查看合约](https://sepolia.etherscan.io/address/0x299491bF3556e506D4545B0B35FB04f26017f191)
* 部署交易: 0x51aff3720eedf2489d0efc4c9008fe7fae8e45126759af6ea93efcc6b492a2b5

### 7. CarbonUSDTMarket (订单簿市场)

* 合约地址: 0x76Fd70Fd0c46e8AD4EEA20E435e2eE82B528E8d5
* Etherscan: [查看合约](https://sepolia.etherscan.io/address/0x76Fd70Fd0c46e8AD4EEA20E435e2eE82B528E8d5)
* 部署交易: 0x7cde0f573599b9564c1791244a4f986b064fb87147f6f46ff538a01eba3e2894

## 目前问题：（已解决）

问题合约详情：

CarbonPriceOracle流动性池子合约（已部署）：目前只有流动性的定价，目前是88 usdt，但是没有获取到我预言机合约得到的 carbonPriceUSD (0xb7c5a4b9)参考价8375065380（参考价用于 交易限制+-10%），但是这个功能我没写，你帮我完成流动性定价的限制

CarbonUSDTMarket订单簿市场合约（未部署）：和amm池合约没有联动，是单独的订单簿市场合约，而且挂单交易也没有限价，目前好的办法就是，单簿市场可以直接调用AMM池的兑换函数，市价单直接吃池子，限价单挂单，二者互补。

## 网络配置

### Sepolia 测试网地址

- **USDT**: `0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7` (18位精度)
- **EUR/USD 价格预言机**: `0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910`
- **Chainlink Token**: `0x779877A7B0D9E8603169DdbD7836e478b4624789`
- **Functions Router**: `0xb83E47C2bC239B3bf370bc41e1459A34b41238D0`
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
- 并且手动配置orcle合约地址到pool合约中
- **完成初始化脚本**: `script/CompleteInitialization.s.sol`

---

*部署完成时间: 2024年6月19日*
*部署者: 0x294761C91734360C5A70e33F8372778ED2849767*
