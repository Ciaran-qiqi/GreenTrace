# GreenTrace The Graph 子图部署指南

## 合约地址配置

根据 Deploy.md 文档，以下是你已部署的合约地址：

### 核心合约
- **GreenTrace**: `0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673`
- **CarbonToken**: `0x808b73A3A1D97382acF32d4F4F834e799Aa08198`
- **GreenTalesNFT**: `0x3456a42043955B1626F6353936c0FEfCd1cB5f1c`

### 市场合约
- **GreenTalesMarket**: `0x82c59961a858f92816d61be7Ec28541E51d37224`
- **CarbonUSDTMarket**: `0x15Dfc335131191e0767036cD611D22a8b9b5Ed43`
- **GreenTalesLiquidityPool**: `0xCfBE2B410E5707b35231B9237bD7E523403Db889`

### 基础设施合约
- **CarbonPriceOracle**: `0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA`

## 区块配置

### 起始区块设置
- **最优起始区块**: `8576685` (所有合约最早的部署区块)
- **优势**: 
  - ✅ 数据完整性 - 确保不会遗漏任何历史事件
  - ✅ 覆盖所有部署 - 从最早的合约部署开始索引
  - ✅ 符合最佳实践 - The Graph 官方推荐做法
  - ✅ 避免数据丢失 - 所有重要事件都会被索引

### 区块范围分析
- **最早部署区块**: 8576685
- **最近交易区块**: 8601233
- **区块跨度**: 24,548 个区块
- **覆盖范围**: 确保覆盖所有合约部署和后续交易

## 部署步骤

### 1. 安装依赖
```bash
cd frontend/subgraph
npm install
```

### 2. 复制ABI文件
```bash
npm run copy-abi
```

### 3. 生成代码
```bash
npm run codegen
```

### 4. 构建子图
```bash
npm run build
```

### 5. 部署到 The Graph Studio
```bash
npm run deploy
```

### 一键设置（推荐）
```bash
npm run setup
```

## 配置说明

### 网络配置
- **网络**: Sepolia 测试网
- **所有合约地址**: 已配置为实际部署地址
- **startBlock**: 统一设置为 8576685 (最优配置)

### 事件映射
每个合约都配置了相应的事件处理：

#### GreenTrace 事件
- `MintRequested` - NFT 创建请求
- `AuditSubmitted` - 审计提交
- `AuditRejected` - 审计拒绝
- `NFTMintedAfterAudit` - 审计后铸造
- `ExchangeRequested` - 兑换请求
- `NFTExchanged` - NFT 兑换

#### CarbonToken 事件
- `Transfer` - 代币转账
- `Mint` - 代币铸造
- `Burn` - 代币销毁

#### CarbonPriceOracle 事件
- `PriceUpdated` - 价格更新

#### GreenTalesMarket 事件
- `NFTListed` - NFT 上架
- `NFTSold` - NFT 售出
- `NFTDelisted` - NFT 下架

#### GreenTalesLiquidityPool 事件
- `LiquidityAdded` - 添加流动性
- `LiquidityRemoved` - 移除流动性
- `Swap` - 代币交换

#### CarbonUSDTMarket 事件
- `CarbonBought` - 购买碳代币
- `CarbonSold` - 出售碳代币

## 验证部署

### 1. 检查子图状态
部署后，在 The Graph Studio 中检查：
- 同步状态
- 事件处理错误
- 查询性能

### 2. 测试查询
在 GraphQL Playground 中测试基本查询：

```graphql
query GetStatistics {
  statistics(id: "global") {
    totalMintRequests
    totalApprovedMints
    totalRejectedMints
    totalMintedNFTs
    totalMarketTrades
    totalCarbonTransfers
    totalUSDTTrades
    totalLiquidityEvents
    currentCarbonPrice
  }
}
```

### 3. 测试用户查询
```graphql
query GetUserMintRequests($requester: String!) {
  mintRequests(
    where: { requester: $requester }
    orderBy: createdAt
    orderDirection: desc
    first: 10
  ) {
    id
    tokenId
    title
    auditStatus
    isMinted
    createdAt
  }
}
```

## 前端集成

### 1. 更新 GraphQL 端点
部署完成后，更新 `frontend/src/hooks/useMultiContractGraphQL.ts` 中的端点：

```typescript
const GRAPH_ENDPOINTS = {
  sepolia: 'https://api.studio.thegraph.com/query/YOUR_PROJECT_ID/greentrace-subgraph/v0.0.1',
  // 替换 YOUR_PROJECT_ID 为实际的子图项目ID
};
```

### 2. 测试数据获取
```typescript
import { useMultiContractGraphQL } from '@/hooks/useMultiContractGraphQL';

function TestComponent() {
  const { data, loading, error } = useMultiContractGraphQL();
  
  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误: {error}</div>;
  
  return (
    <div>
      <h2>测试数据</h2>
      <p>NFT创建记录: {data?.mintRequests.length || 0}</p>
      <p>碳代币余额: {data?.carbonBalance || '0'}</p>
      <p>市场交易: {data?.marketTrades.length || 0}</p>
    </div>
  );
}
```

## 故障排除

### 1. ABI 文件缺失
如果某些 ABI 文件不存在，检查：
- 合约是否已编译
- ABI 文件路径是否正确
- 文件名是否匹配

### 2. 事件映射错误
如果事件处理失败，检查：
- 事件名称是否正确
- 参数类型是否匹配
- 合约地址是否正确

### 3. 同步失败
如果子图同步失败，检查：
- 网络连接
- 合约地址有效性
- 起始区块号

## 性能优化

### 1. 查询优化
- 使用 `first` 参数限制结果数量
- 添加 `where` 条件过滤数据
- 使用 `orderBy` 优化排序

### 2. 索引优化
- 为常用查询字段添加索引
- 使用复合索引优化复杂查询

## 监控和维护

### 1. 定期检查
- 监控同步状态
- 检查事件处理错误
- 查看查询性能指标

### 2. 数据备份
- 定期备份重要数据
- 监控数据完整性

## 下一步

1. **部署子图** - 运行部署命令
2. **测试查询** - 验证数据获取
3. **集成前端** - 更新应用使用真实数据
4. **性能优化** - 根据使用情况优化查询
5. **监控维护** - 建立监控和维护流程

---

*部署配置完成时间: 2024年6月19日*
*基于 Deploy.md 中的实际合约地址*
*最优起始区块: 8576685 (所有合约最早的部署区块)* 