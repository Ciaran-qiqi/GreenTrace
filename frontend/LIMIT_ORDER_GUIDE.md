# 碳币市场限价订单功能指南

## 概述

本指南介绍基于新部署的 `CarbonUSDTMarket` 合约的限价订单功能。该功能提供了去中心化的碳币交易市场，支持限价单和市价单交易。

## 合约信息

### 合约地址
- **Sepolia测试网**: `0x8dBe778e693B4c0665974BED7a5C63B668B8f6A3`
- **主网**: 待部署

### 相关合约
- **CarbonToken**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **USDT**: `0xdCdC73413C6136c9ABc3E8d250af42947aC2Fc7` (Sepolia测试网)
- **流动性池**: `0xCfBE2B410E5707b35231B9237bD7E523403Db889`

## 功能特性

### 1. 限价订单
- **自动撮合**: 创建订单时自动匹配现有订单
- **手动成交**: 用户可以手动成交其他用户的订单
- **订单取消**: 用户可以取消自己的挂单
- **价格保护**: 防止价格偏离过大的订单

### 2. 手续费机制
- **挂单费**: 0.5% (50 basis points)
- **成交费**: 0.3% (30 basis points)
- **市价单费**: 1.0% (通过流动性池)

### 3. 订单管理
- **订单状态**: Active, Filled, Cancelled
- **剩余数量**: 支持部分成交，显示剩余未成交数量
- **订单历史**: 完整的订单创建和成交记录

## 前端使用

### 1. 访问市场
访问 `/carbon-market` 页面，可以看到完整的交易界面。

### 2. 创建限价单
1. 切换到"限价单"标签
2. 选择"买入"或"卖出"
3. 输入碳币数量和价格
4. 系统会显示费用明细
5. 点击"创建买单"或"创建卖单"

### 3. 成交订单
1. 在订单簿中查看市场订单
2. 点击"成交"按钮
3. 确认交易详情
4. 等待区块链确认

### 4. 取消订单
1. 切换到"我的订单"标签
2. 找到要取消的订单
3. 点击"取消"按钮
4. 等待区块链确认

## 技术实现

### 1. 合约交互
```typescript
// 创建买单
await createBuyOrder(amount: string, price: string)

// 创建卖单
await createSellOrder(amount: string, price: string)

// 成交订单
await fillOrder(orderId: string)

// 取消订单
await cancelOrder(orderId: string)
```

### 2. 数据获取
```typescript
// 获取市场统计
const marketStats = await getDetailedMarketStats()

// 获取分页订单
const orders = await getActiveOrdersPaginated(offset, limit)

// 获取用户订单
const userOrders = await getUserOrders(userAddress)
```

### 3. 授权管理
```typescript
// 检查授权
const needsApproval = checkApprovalNeeded(amount, decimals)

// 最大授权
await approveMax()
```

## 错误处理

### 常见错误
1. **余额不足**: 检查USDT或碳币余额
2. **授权不足**: 需要先授权代币
3. **Gas费用不足**: 检查ETH余额
4. **价格偏离**: 订单价格超出允许范围

### 错误提示
- 用户友好的中文错误提示
- 详细的错误原因说明
- 建议的解决方案

## 开发说明

### 1. 环境配置
确保以下环境变量已设置：
```env
NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS=0x8dBe778e693B4c0665974BED7a5C63B668B8f6A3
NEXT_PUBLIC_CARBON_TOKEN_ADDRESS=0x808b73A3A1D97382acF32d4F4F834e799Aa08198
NEXT_PUBLIC_USDT_ADDRESS=0xdCdC73413C6136c9ABc3E8d250af42947aC2Fc7
```

### 2. 依赖组件
- `useCarbonUSDTMarket`: 主要的合约交互hook
- `useTokenApproval`: 代币授权管理
- `useOrderData`: 订单数据管理
- `CarbonMarket`: 主交易界面组件
- `OrderBook`: 订单簿显示组件

### 3. 测试网络
当前部署在Sepolia测试网，确保钱包连接到正确的网络。

## 安全考虑

### 1. 价格保护
- 合约内置价格偏离检查
- 防止恶意价格操纵
- 基于预言机的参考价格

### 2. 授权安全
- 支持精确授权和最大授权
- 授权额度检查
- 授权状态实时更新

### 3. 交易安全
- 余额充足性检查
- 订单有效性验证
- 交易状态监控

## 性能优化

### 1. 分页加载
- 使用分页API减少数据加载
- 按需加载订单数据
- 缓存常用数据

### 2. 实时更新
- 监听区块链事件
- 自动刷新订单状态
- 用户操作即时反馈

### 3. 错误恢复
- 网络错误自动重试
- 交易失败友好提示
- 状态同步机制

## 未来计划

### 1. 功能扩展
- 止损单和止盈单
- 批量订单操作
- 高级订单类型

### 2. 性能提升
- 订单簿深度图
- 实时价格图表
- 交易历史分析

### 3. 用户体验
- 移动端优化
- 多语言支持
- 个性化设置

## 联系支持

如有问题或建议，请联系开发团队或查看项目文档。 