# GreenTrace 碳币交易系统前端开发文档

## 概述

GreenTrace 碳币交易系统包含两个核心合约：
1. **GreenTalesLiquidityPool** - AMM流动性池合约，负责碳币与USDT的兑换
2. **CarbonUSDTMarket** - 碳币交易市场合约，提供市价单和限价单交易

## 1. 流动性池合约 (GreenTalesLiquidityPool)

### 1.1 核心功能

流动性池是整个交易系统的核心，提供碳币和USDT的自动做市服务。

#### 价格机制
- **当前价格**: 88 USDT/CARB（示例）
- **定价公式**: AMM恒定乘积公式 (x * y = k)
- **价格计算**: `价格 = 池中USDT总量 / 池中碳币总量`

#### 手续费结构
- **交易手续费**: 0.3%（可配置）
- **手续费分配**:
  - 平台收入: 70%
  - 流动性提供者分成: 30%

### 1.2 主要接口函数

#### 查询函数 (只读，无Gas费用)

```typescript
// 获取当前碳币价格（18位精度，USDT/CARB）
getCarbonPrice(): Promise<bigint>

// 获取预言机USD参考价格（18位精度）
getCarbonPriceUSD(): Promise<bigint>

// 获取预言机EUR参考价格（18位精度）
getOracleReferencePrice(): Promise<bigint>

// 检查价格是否偏离过大
isPriceDeviated(marketPrice: bigint): Promise<boolean>

// 获取价格偏离详细信息
getPriceDeviationDetails(): Promise<{
  referencePrice: bigint,      // 预言机参考价
  marketPrice: bigint,         // 当前市场价
  deviation: bigint,           // 偏离百分比
  threshold: bigint,           // 偏离阈值
  isDeviated: boolean          // 是否偏离过大
}>

// 获取池子统计信息
getPoolStats(): Promise<{
  totalCarbon: bigint,         // 池中碳币总量
  totalUsdt: bigint,           // 池中USDT总量
  totalLP: bigint,             // LP代币总量
  currentPrice: bigint,        // 当前价格
  swapCount: bigint,           // 总交易次数
  totalVolume: bigint,         // 总交易量
  totalFees: bigint,           // 总手续费
  totalProviders: bigint       // 流动性提供者数量
}>

// 获取兑换估算
getSwapEstimate(amountIn: bigint, isCarbonToUsdt: boolean): Promise<{
  amountOut: bigint,           // 输出数量
  fee: bigint,                 // 手续费
  priceImpact: bigint          // 价格影响（基点）
}>

// 获取用户流动性信息
getLiquidityProviderInfo(userAddress: string): Promise<{
  lpTokens: bigint,            // LP代币数量
  carbonShare: bigint,         // 碳币份额
  usdtShare: bigint,           // USDT份额
  sharePercentage: bigint      // 份额百分比（基点）
}>

// 计算用户可提取的手续费收益
calculateUserFees(userAddress: string): Promise<{
  carbonFees: bigint,          // 可提取的碳币手续费
  usdtFees: bigint             // 可提取的USDT手续费
}>
```

#### 交易函数 (需要Gas费用)

```typescript
// 添加流动性
addLiquidity(carbonAmount: bigint, usdtAmount: bigint): Promise<bigint>
// 返回: 获得的LP代币数量

// 移除流动性
removeLiquidity(lpTokens: bigint): Promise<{
  carbonAmount: bigint,        // 返还的碳币数量
  usdtAmount: bigint          // 返还的USDT数量
}>

// 碳币兑换USDT
swapCarbonToUsdt(carbonAmount: bigint): Promise<bigint>
// 返回: 获得的USDT数量

// USDT兑换碳币
swapUsdtToCarbon(usdtAmount: bigint): Promise<bigint>
// 返回: 获得的碳币数量

// 提取手续费收益
claimFees(): Promise<{
  carbonFees: bigint,          // 提取的碳币手续费
  usdtFees: bigint            // 提取的USDT手续费
}>
```

### 1.3 事件监听

```typescript
// 流动性相关事件
event LiquidityAdded(user: string, carbonAmount: bigint, usdtAmount: bigint, lpTokens: bigint)
event LiquidityRemoved(user: string, carbonAmount: bigint, usdtAmount: bigint, lpTokens: bigint)

// 交易相关事件
event TokensSwapped(user: string, tokenIn: string, tokenOut: string, amountIn: bigint, amountOut: bigint)

// 价格相关事件
event PriceUpdated(carbonPrice: bigint, timestamp: bigint)
event PriceDeviationChecked(referencePrice: bigint, marketPrice: bigint, deviation: bigint, isDeviated: boolean)

// 手续费相关事件
event UserFeesClaimed(user: string, token: string, amount: bigint)
```

## 2. 碳币市场合约 (CarbonUSDTMarket)

### 2.1 核心功能

碳币市场提供更丰富的交易功能，包括市价单和限价单。

#### 交易类型
1. **市价单**: 直接调用AMM池进行交易，只收取AMM池的0.3%手续费
2. **限价单**: 用户设定价格的订单，收取挂单费、成交费和平台手续费

#### 手续费结构
- **市价单**: 只收AMM池0.3%手续费，市场合约不额外收费
- **限价单**:
  - 挂单手续费: 创建订单时收取
  - 成交手续费: 订单成交时收取
  - 平台手续费: 成交时额外收取

#### 价格限制
- 限价单价格必须在预言机参考价的允许偏离范围内
- 防止价格操纵和恶意交易

### 2.2 主要接口函数

#### 查询函数

```typescript
// 获取市价单费用估算
getMarketOrderEstimate(amount: bigint, isBuy: boolean): Promise<{
  estimatedAmount: bigint,     // 预估获得数量
  platformFee: bigint,         // 平台手续费（市价单为0）
  totalAmount: bigint          // 总计数量
}>

// 获取所有手续费率信息
getFeeRates(): Promise<{
  platformFee: bigint,         // 平台手续费率
  limitOrderFee: bigint,       // 限价单挂单手续费率
  fillOrderFee: bigint         // 限价单成交手续费率
}>

// 获取订单信息
getOrder(orderId: bigint): Promise<{
  user: string,                // 订单用户
  orderType: number,           // 订单类型 (0=买单, 1=卖单)
  amount: bigint,              // 订单数量
  price: bigint,               // 订单价格
  timestamp: bigint,           // 创建时间
  status: number,              // 订单状态 (0=活跃, 1=已成交, 2=已取消)
  orderFee: bigint             // 挂单手续费
}>

// 获取市场统计信息
getMarketStats(): Promise<{
  totalOrdersCreated: bigint,  // 总创建订单数
  totalOrdersFilled: bigint,   // 总成交订单数
  totalOrdersCancelled: bigint,// 总取消订单数
  totalVolumeTraded: bigint,   // 总交易量
  totalFeesCollected: bigint,  // 总手续费收入
  nextOrderId: bigint          // 下一个订单ID
}>
```

#### 交易函数

```typescript
// 市价买单（用USDT买碳币）
marketBuy(amount: bigint): Promise<bigint>
// 参数: amount - 要购买的碳币数量
// 返回: 实际花费的USDT数量

// 市价卖单（卖碳币得USDT）
marketSell(amount: bigint): Promise<bigint>
// 参数: amount - 要出售的碳币数量
// 返回: 实际获得的USDT数量

// 创建买单（限价单）
createBuyOrder(amount: bigint, price: bigint): Promise<bigint>
// 参数: amount - 碳币数量, price - 单价（USDT/CARB）
// 返回: 订单ID

// 创建卖单（限价单）
createSellOrder(amount: bigint, price: bigint): Promise<bigint>
// 参数: amount - 碳币数量, price - 单价（USDT/CARB）
// 返回: 订单ID

// 成交订单
fillOrder(orderId: bigint): Promise<void>
// 参数: orderId - 订单ID

// 取消订单
cancelOrder(orderId: bigint): Promise<void>
// 参数: orderId - 订单ID（只能取消自己的订单）
```

### 2.3 事件监听

```typescript
// 订单相关事件
event OrderCreated(orderId: bigint, user: string, orderType: number, amount: bigint, price: bigint, timestamp: bigint)
event OrderFilled(orderId: bigint, buyer: string, seller: string, amount: bigint, price: bigint, platformFee: bigint, timestamp: bigint)
event OrderCancelled(orderId: bigint, user: string, timestamp: bigint)

// 市价单事件
event MarketOrderExecuted(user: string, orderType: number, amount: bigint, price: bigint, timestamp: bigint)

// 手续费更新事件
event PlatformFeeRateUpdated(oldRate: bigint, newRate: bigint)
event LimitOrderFeeRateUpdated(oldRate: bigint, newRate: bigint)
event FillOrderFeeRateUpdated(oldRate: bigint, newRate: bigint)
```

## 3. 前端集成指南

### 3.1 合约地址配置

```typescript
// frontend/src/contracts/addresses.ts
export const CONTRACTS = {
  CARBON_TOKEN: "0x...",                // 碳币代币合约
  USDT_TOKEN: "0x...",                  // USDT代币合约
  LIQUIDITY_POOL: "0x...",              // 流动性池合约
  CARBON_MARKET: "0x...",               // 碳币市场合约
  CARBON_PRICE_ORACLE: "0x..."          // 碳价预言机合约
}
```

### 3.2 核心Hook使用示例

```typescript
// 流动性池相关Hook
import { useGreenTalesLiquidityPool } from '@/hooks/useGreenTalesLiquidityPool'

const {
  getCarbonPrice,        // 获取当前价格
  addLiquidity,          // 添加流动性
  removeLiquidity,       // 移除流动性
  swapCarbonToUsdt,      // 碳币换USDT
  swapUsdtToCarbon,      // USDT换碳币
  getPoolStats,          // 获取池子统计
  claimFees             // 提取手续费
} = useGreenTalesLiquidityPool()

// 碳币市场相关Hook
import { useCarbonUSDTMarket } from '@/hooks/useCarbonUSDTMarket'

const {
  marketBuy,            // 市价买单
  marketSell,           // 市价卖单
  createBuyOrder,       // 创建买单
  createSellOrder,      // 创建卖单
  fillOrder,            // 成交订单
  cancelOrder,          // 取消订单
  getOrder,             // 获取订单信息
  getMarketStats        // 获取市场统计
} = useCarbonUSDTMarket()
```

### 3.3 数据精度处理

```typescript
// 所有价格和数量都使用18位精度（wei单位）
const DECIMALS = 18n
const UNIT = 10n ** DECIMALS

// 将用户输入转换为合约单位
function parseAmount(amount: string): bigint {
  return BigInt(Math.floor(parseFloat(amount) * Number(UNIT)))
}

// 将合约返回值转换为显示格式
function formatAmount(amount: bigint): string {
  return (Number(amount) / Number(UNIT)).toFixed(6)
}

// 价格显示（USDT/CARB）
function formatPrice(price: bigint): string {
  return (Number(price) / Number(UNIT)).toFixed(2)
}

// 手续费率显示（基点转百分比）
function formatFeeRate(rate: bigint): string {
  return (Number(rate) / 100).toFixed(2) + '%'
}
```

### 3.4 错误处理

```typescript
// 常见错误类型
enum ContractError {
  INSUFFICIENT_BALANCE = "余额不足",
  INSUFFICIENT_ALLOWANCE = "授权额度不足", 
  PRICE_DEVIATION_TOO_LARGE = "价格偏离过大",
  ORDER_NOT_ACTIVE = "订单不可用",
  NOT_ORDER_OWNER = "非订单所有者",
  CONTRACT_PAUSED = "合约已暂停",
  INVALID_AMOUNT = "无效数量",
  INVALID_PRICE = "无效价格"
}

// 错误处理示例
try {
  await marketBuy(amount)
} catch (error) {
  if (error.message.includes("Insufficient balance")) {
    throw new Error(ContractError.INSUFFICIENT_BALANCE)
  } else if (error.message.includes("Price deviation too large")) {
    throw new Error(ContractError.PRICE_DEVIATION_TOO_LARGE)
  }
  // 其他错误处理...
}
```

### 3.5 实时数据更新

```typescript
// 使用事件监听实现实时更新
useEffect(() => {
  const liquidityPool = getLiquidityPoolContract()
  const market = getMarketContract()
  
  // 监听流动性池事件
  const handleTokensSwapped = (user, tokenIn, tokenOut, amountIn, amountOut) => {
    // 更新价格和统计数据
    updatePoolData()
  }
  
  // 监听市场订单事件
  const handleOrderCreated = (orderId, user, orderType, amount, price, timestamp) => {
    // 更新订单列表
    updateOrderBook()
  }
  
  liquidityPool.on("TokensSwapped", handleTokensSwapped)
  market.on("OrderCreated", handleOrderCreated)
  
  return () => {
    liquidityPool.off("TokensSwapped", handleTokensSwapped)
    market.off("OrderCreated", handleOrderCreated)
  }
}, [])
```

## 4. 页面功能规划

### 4.1 流动性池页面
- 添加/移除流动性
- 查看池子统计信息
- 价格图表显示
- 流动性提供者收益统计
- 手续费收益提取

### 4.2 碳币交易页面
- 市价单买卖界面
- 限价单创建和管理
- 订单簿显示
- 交易历史记录
- 价格偏离提醒

### 4.3 数据展示组件
- 实时价格显示
- 24小时交易量统计
- 价格走势图表
- 订单状态管理
- 手续费计算器

## 5. 安全注意事项

1. **代币授权**: 交易前确保足够的代币授权额度
2. **价格偏离**: 提醒用户价格偏离风险
3. **滑点保护**: 市价单添加滑点保护机制
4. **金额验证**: 前端验证输入金额的合理性
5. **网络状态**: 监控合约暂停状态
6. **交易确认**: 重要操作添加二次确认

## 6. 测试建议

1. **单元测试**: 所有Hook函数的单元测试
2. **集成测试**: 合约交互的端到端测试
3. **错误测试**: 各种异常情况的处理测试
4. **性能测试**: 大量数据下的界面响应测试
5. **用户测试**: 真实用户场景的可用性测试 