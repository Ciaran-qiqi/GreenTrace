# Chainlink 配置说明

## 1. Chainlink Functions 配置

### 1.1 获取订阅ID
1. 访问 [Chainlink Functions 控制台](https://functions.chain.link/)
2. 连接你的钱包
3. 创建新订阅或使用现有订阅
4. 充值 LINK 代币（用于支付费用）

### 1.2 环境变量配置
在 `.env` 文件中添加：
```bash
# 部署者私钥
PRIVATE_KEY=你的私钥

# Chainlink Functions 配置
CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=你的订阅ID
CHAINLINK_FUNCTIONS_DON_ID=0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000

# 部署后的合约地址（部署后需要更新）
CARBON_PRICE_ORACLE_ADDRESS=0x... # 部署后填入预言机地址

# 可选：预言机操作员地址
ORACLE_OPERATOR_ADDRESS=0x... # 可选，让其他地址也能调用预言机更新
```

## 2. 部署步骤

### 2.1 部署所有合约
```bash
forge script script/Deploy.s.sol --rpc-url https://sepolia.infura.io/v3/YOUR_API_KEY --broadcast --verify
```

### 2.2 配置预言机
```bash
# 更新 .env 文件中的预言机地址
# 然后运行配置脚本
forge script script/ConfigureOracle.s.sol --rpc-url https://sepolia.infura.io/v3/YOUR_API_KEY --broadcast
```

## 3. 使用预言机

### 3.1 更新碳价
```solidity
// 调用预言机更新价格
carbonPriceOracle.requestCarbonPrice();
```

### 3.2 获取最新价格
```solidity
// 获取美元价格（8位精度）
uint256 usdPrice = carbonPriceOracle.getLatestCarbonPriceUSD();

// 获取欧元价格（8位精度）
uint256 eurPrice = carbonPriceOracle.getLatestCarbonPriceEUR();
```

## 4. 费用说明

### 4.1 Chainlink Functions 费用
- 每次调用 `requestCarbonPrice()` 需要支付 LINK 代币
- 费用取决于 JavaScript 代码的复杂度和 Gas 使用量
- 建议在订阅账户中保持足够的 LINK 余额

### 4.2 价格预言机费用
- EUR/USD 价格预言机是免费的
- 无需额外配置或支付费用

## 5. 测试网 vs 主网

### 5.1 Sepolia 测试网
- 使用测试网 LINK 代币
- 费用较低，适合测试
- 所有地址已在部署脚本中配置

### 5.2 主网
- 使用真实的 LINK 代币
- 需要更新所有地址
- 需要更多的 LINK 余额

## 6. 故障排除

### 6.1 常见问题
1. **订阅ID未设置**: 运行配置脚本设置订阅ID
2. **LINK余额不足**: 向订阅账户充值 LINK 代币
3. **权限错误**: 确保调用者是合约所有者或授权操作员

### 6.2 调试方法
```solidity
// 检查订阅ID
uint64 subscriptionId = carbonPriceOracle.subscriptionId();

// 检查LINK余额
uint256 balance = linkToken.balanceOf(address(carbonPriceOracle));

// 检查操作员权限
bool isOperator = carbonPriceOracle.authorizedOperators(address);
``` 