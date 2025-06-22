# GreenTrace 合约部署检查清单

## 部署前准备

### 1. 环境配置
- [ ] 设置 `.env` 文件，包含以下变量：
  ```
  PRIVATE_KEY=你的私钥
  SEPOLIA_RPC_URL=你的Sepolia RPC URL
  ETHERSCAN_API_KEY=你的Etherscan API Key
  ```
- [ ] 确保账户有足够的ETH支付gas费用（建议至少0.1 ETH）
- [ ] 确保账户有足够的USDT用于测试（建议至少100,000 USDT）

### 2. 已部署的合约地址
根据您的Deploy.md文档，以下合约已部署：

- ✅ **CarbonToken**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- ✅ **GreenTrace**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`
- ✅ **GreenTalesNFT**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`
- ✅ **CarbonPriceOracle**: `0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA`
- ✅ **GreenTalesMarket**: `0x82c59961a858f92816d61be7Ec28541E51d37224`

### 3. 需要部署的合约
- ❌ **GreenTalesLiquidityPool** (流动性池)
- ❌ **CarbonUSDTMarket** (订单簿市场)

## 部署步骤

### 第一步：部署剩余合约

1. **编译合约**：
   ```bash
   forge build
   ```

2. **部署GreenTalesLiquidityPool和CarbonUSDTMarket**：
   ```bash
   forge script script/DeployRemainingContracts.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
   ```

3. **记录新部署的合约地址**：
   - GreenTalesLiquidityPool地址
   - CarbonUSDTMarket地址

### 第二步：初始化流动性池

1. **更新初始化脚本中的合约地址**：
   编辑 `script/InitializeLiquidityPool.s.sol`，将 `LIQUIDITY_POOL` 地址更新为新部署的地址

2. **检查代币余额**：
   - 确保有足够的碳币（至少1000个）
   - 确保有足够的USDT（至少88,000个）

3. **运行初始化脚本**：
   ```bash
   forge script script/InitializeLiquidityPool.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
   ```

### 第三步：配置预言机

1. **设置订阅ID**：
   ```bash
   # 调用CarbonPriceOracle合约的setSubscriptionId函数
   # 需要先在Chainlink Functions控制台创建订阅
   ```

2. **添加操作员权限**：
   ```bash
   # 调用CarbonPriceOracle合约的addOperator函数
   # 添加可以调用requestCarbonPrice的地址
   ```

3. **测试预言机功能**：
   ```bash
   # 调用requestCarbonPrice函数获取最新碳价
   ```

### 第四步：测试功能

1. **测试流动性池功能**：
   - 添加流动性
   - 移除流动性
   - 碳币兑换USDT
   - USDT兑换碳币

2. **测试订单簿市场功能**：
   - 市价买单
   - 市价卖单
   - 限价买单
   - 限价卖单
   - 成交订单
   - 取消订单

3. **测试价格偏离检查**：
   - 验证预言机价格与池子价格的偏离检查

## 部署参数配置

### 手续费率配置
- **流动性池手续费率**: 0.3% (30基点)
- **订单簿平台手续费率**: 1% (100基点)
- **限价单挂单手续费率**: 0.5% (50基点)
- **限价单成交手续费率**: 0.3% (30基点)

### 价格偏离阈值
- **价格偏离阈值**: 10%
- **当池子价格与预言机价格偏离超过10%时，交易将被阻止**

### 初始流动性
- **碳币数量**: 1,000 碳币
- **USDT数量**: 88,000 USDT
- **初始价格**: 88 USDT/碳币

## 验证合约

部署完成后，需要验证所有合约到Etherscan：

```bash
# 验证GreenTalesLiquidityPool
forge verify-contract <合约地址> src/GreenTalesLiquidityPool.sol:GreenTalesLiquidityPool --chain-id 11155111 --etherscan-api-key $ETHERSCAN_API_KEY

# 验证CarbonUSDTMarket
forge verify-contract <合约地址> src/CarbonUSDTMarket.sol:CarbonUSDTMarket --chain-id 11155111 --etherscan-api-key $ETHERSCAN_API_KEY
```

## 常见问题

### 1. Gas不足
- 确保账户有足够的ETH
- 可以分步部署，避免一次性部署所有合约

### 2. 代币余额不足
- 确保有足够的碳币和USDT
- 可以从水龙头获取测试代币

### 3. 预言机配置问题
- 确保设置了正确的订阅ID
- 确保添加了操作员权限
- 确保有足够的LINK代币支付费用

### 4. 价格偏离检查失败
- 检查预言机是否正常工作
- 调整价格偏离阈值
- 确保池子价格与预言机价格合理

## 部署完成检查清单

- [ ] 所有合约已部署并验证
- [ ] 流动性池已初始化
- [ ] 预言机已配置并测试
- [ ] 所有功能已测试
- [ ] 手续费配置正确
- [ ] 价格偏离检查正常工作
- [ ] 文档已更新

## 联系信息

如有问题，请检查：
1. 合约代码是否正确
2. 环境配置是否正确
3. 网络连接是否正常
4. 账户余额是否充足 