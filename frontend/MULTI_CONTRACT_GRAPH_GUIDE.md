# 多合约 The Graph 使用指南

## 概述

The Graph 可以同时索引多个智能合约，为你的整个 DeFi 生态系统提供统一的数据查询接口。本指南展示如何为 GreenTrace 项目的所有合约配置 The Graph 子图。

## 支持的合约

### 1. 核心合约
- **GreenTrace** - NFT 创建和审计管理
- **GreenTalesNFT** - NFT 代币合约
- **CarbonToken** - 碳代币合约

### 2. 市场合约
- **GreenTalesMarket** - NFT 交易市场
- **CarbonUSDTMarket** - 碳代币/USDT 交易市场
- **GreenTalesLiquidityPool** - 流动性池

### 3. 基础设施合约
- **CarbonPriceOracle** - 碳价预言机

## 架构优势

### 🎯 统一数据源
- 所有合约数据在一个子图中索引
- 支持跨合约查询和关联
- 统一的数据格式和接口

### 📊 复杂查询支持
- 用户在所有合约中的活动汇总
- 跨合约的统计和分析
- 实时数据聚合

### 🔄 数据关联
- NFT 创建 → 审计 → 铸造 → 交易
- 碳代币转账 → 余额计算 → 价格变化
- 流动性提供 → 交易 → 收益计算

## 数据实体关系

```
用户 (User)
├── NFT创建记录 (MintRequest)
│   ├── 审计信息 (Audit)
│   └── 铸造状态 (isMinted)
├── 碳代币转账 (CarbonTokenTransfer)
│   └── 余额计算 (carbonBalance)
├── 市场交易 (MarketTrade)
├── USDT交易 (USDTMarketTrade)
└── 流动性事件 (LiquidityPoolEvent)

全局统计 (Statistics)
├── NFT相关统计
├── 碳代币相关统计
├── 市场交易统计
└── 价格信息
```

## 查询示例

### 1. 用户完整活动概览
```graphql
query GetUserActivity($user: String!) {
  # NFT 创建记录
  mintRequests(where: { requester: $user }) {
    id
    title
    auditStatus
    isMinted
  }
  
  # 碳代币转账
  carbonTokenTransfers(
    where: { 
      or: [{ from: $user }, { to: $user }] 
    }
  ) {
    from
    to
    amount
  }
  
  # 市场交易
  marketTrades(
    where: { 
      or: [{ seller: $user }, { buyer: $user }] 
    }
  ) {
    tokenId
    price
  }
  
  # USDT 交易
  usdtMarketTrades(where: { user: $user }) {
    action
    carbonAmount
    usdtAmount
  }
}
```

### 2. 跨合约统计
```graphql
query GetCrossContractStats {
  statistics(id: "global") {
    totalMintRequests
    totalMintedNFTs
    totalMarketTrades
    totalCarbonTransfers
    totalUSDTTrades
    currentCarbonPrice
  }
}
```

### 3. 价格影响分析
```graphql
query GetPriceImpact($tokenId: String!) {
  # NFT 交易历史
  marketTrades(where: { tokenId: $tokenId }) {
    price
    blockTimestamp
  }
  
  # 同时期的碳价变化
  carbonPriceUpdates(
    orderBy: timestamp
    orderDirection: desc
    first: 100
  ) {
    price
    timestamp
  }
}
```

## 前端集成

### 1. 使用多合约 Hook
```typescript
import { useMultiContractGraphQL } from '@/hooks/useMultiContractGraphQL';

function Dashboard() {
  const { data, loading, error } = useMultiContractGraphQL();
  
  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  
  return (
    <div>
      <h2>我的活动概览</h2>
      
      {/* NFT 创建记录 */}
      <div>
        <h3>NFT 创建 ({data.mintRequests.length})</h3>
        {data.mintRequests.map(request => (
          <div key={request.id}>{request.title}</div>
        ))}
      </div>
      
      {/* 碳代币余额 */}
      <div>
        <h3>碳代币余额</h3>
        <p>{data.carbonBalance} CT</p>
      </div>
      
      {/* 市场交易 */}
      <div>
        <h3>市场交易 ({data.marketTrades.length})</h3>
        {data.marketTrades.map(trade => (
          <div key={trade.id}>NFT #{trade.tokenId}</div>
        ))}
      </div>
    </div>
  );
}
```

### 2. 使用专用 Hook
```typescript
import { useNFTGraphQL, useCarbonTokenGraphQL } from '@/hooks/useMultiContractGraphQL';

function NFTPage() {
  const { mintRequests, loading } = useNFTGraphQL();
  const { balance } = useCarbonTokenGraphQL();
  
  return (
    <div>
      <p>碳代币余额: {balance} CT</p>
      <div>NFT 创建记录: {mintRequests.length}</div>
    </div>
  );
}
```

## 部署步骤

### 1. 配置合约地址
编辑 `subgraph.yaml`，为每个合约设置正确的地址：

```yaml
dataSources:
  - kind: ethereum
    name: GreenTrace
    source:
      address: "0xYOUR_GREEN_TRACE_ADDRESS"
      
  - kind: ethereum
    name: CarbonToken
    source:
      address: "0xYOUR_CARBON_TOKEN_ADDRESS"
      
  - kind: ethereum
    name: GreenTalesMarket
    source:
      address: "0xYOUR_MARKET_ADDRESS"
```

### 2. 复制 ABI 文件
```bash
cp ../src/contracts/abi/GreenTrace.json ./abis/
cp ../src/contracts/abi/CarbonToken.json ./abis/
cp ../src/contracts/abi/GreenTalesMarket.json ./abis/
cp ../src/contracts/abi/CarbonPriceOracle.json ./abis/
cp ../src/contracts/abi/GreenTalesLiquidityPool.json ./abis/
cp ../src/contracts/abi/CarbonUSDTMarket.json ./abis/
```

### 3. 生成和部署
```bash
npm run codegen
npm run build
npm run deploy
```

## 性能优化

### 1. 查询优化
- 使用 `first` 参数限制结果数量
- 添加 `where` 条件过滤数据
- 使用 `orderBy` 优化排序

### 2. 索引优化
- 为常用查询字段添加索引
- 使用复合索引优化复杂查询
- 避免在非索引字段上进行排序

### 3. 缓存策略
- 实现前端数据缓存
- 使用 React Query 或 SWR
- 设置合理的缓存过期时间

## 监控和维护

### 1. 同步状态监控
- 检查所有合约的同步状态
- 监控事件处理错误
- 查看查询性能指标

### 2. 数据完整性
- 验证所有事件都被正确索引
- 检查跨合约关联的完整性
- 定期备份重要数据

### 3. 性能监控
- 监控查询响应时间
- 跟踪查询频率和模式
- 优化热点查询

## 扩展性

### 1. 添加新合约
1. 在 `schema.graphql` 中定义新实体
2. 在 `subgraph.yaml` 中添加数据源
3. 在 `mapping.ts` 中实现事件处理
4. 重新部署子图

### 2. 添加新查询
1. 在 GraphQL Playground 中测试查询
2. 在前端 Hook 中实现查询逻辑
3. 更新组件以使用新数据

### 3. 跨链支持
- 为不同网络部署独立的子图
- 使用多网络查询聚合数据
- 实现跨链数据同步

## 最佳实践

### 1. 数据设计
- 保持实体关系清晰
- 避免过度复杂的嵌套查询
- 使用适当的字段类型

### 2. 查询设计
- 优先使用索引字段
- 避免 N+1 查询问题
- 实现分页查询

### 3. 错误处理
- 实现完善的错误处理
- 提供用户友好的错误信息
- 记录详细的错误日志

## 总结

使用 The Graph 索引多个合约可以：

✅ **统一数据源** - 所有合约数据在一个地方
✅ **复杂查询** - 支持跨合约的复杂查询
✅ **实时更新** - 事件驱动的实时数据更新
✅ **性能优化** - 索引和缓存优化查询性能
✅ **易于扩展** - 轻松添加新合约和数据

这种架构为你的 DeFi 应用提供了强大、灵活和可扩展的数据基础设施。 