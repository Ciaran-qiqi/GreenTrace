# The Graph 部署指南

## 概述

本指南将帮助你部署GreenTrace项目的The Graph子图，用于索引和查询区块链事件数据。

## 前置要求

1. **Node.js** (版本 16+)
2. **Graph CLI** - The Graph的命令行工具
3. **GitHub账户** - 用于托管子图代码
4. **The Graph账户** - 用于部署子图

## 安装步骤

### 1. 安装 Graph CLI

```bash
npm install -g @graphprotocol/graph-cli
```

### 2. 登录 The Graph

```bash
graph auth --product hosted-service <YOUR_ACCESS_TOKEN>
```

访问 [The Graph Studio](https://thegraph.com/studio/) 获取访问令牌。

### 3. 初始化子图项目

```bash
cd frontend/subgraph
npm install
```

### 4. 配置合约地址

编辑 `subgraph.yaml` 文件：

```yaml
dataSources:
  - kind: ethereum
    name: GreenTrace
    network: sepolia # 或 mainnet
    source:
      address: "0xYOUR_CONTRACT_ADDRESS" # 替换为实际的GreenTrace合约地址
      abi: GreenTrace
      startBlock: 1234567 # 替换为合约部署的区块号
```

### 5. 复制合约ABI

将合约ABI文件复制到 `subgraph/abis/` 目录：

```bash
cp ../src/contracts/abi/GreenTrace.json ./abis/
cp ../src/contracts/abi/GreenTalesNFT.json ./abis/
```

### 6. 生成代码

```bash
npm run codegen
```

### 7. 构建子图

```bash
npm run build
```

### 8. 部署子图

#### 方式1: 部署到 The Graph Studio (推荐)

```bash
npm run deploy
```

#### 方式2: 部署到 Hosted Service

```bash
npm run deploy:hosted
```

## 本地开发

### 1. 启动本地Graph节点

```bash
# 安装 Docker
# 然后运行
docker-compose up -d
```

### 2. 创建本地子图

```bash
npm run create-local
```

### 3. 部署到本地

```bash
npm run deploy-local
```

### 4. 访问本地Graph Explorer

打开浏览器访问: http://localhost:8000

## 配置前端

### 1. 更新GraphQL端点

编辑 `frontend/src/hooks/useGraphQL.ts`：

```typescript
const GRAPH_ENDPOINTS = {
  sepolia: 'https://api.studio.thegraph.com/query/YOUR_PROJECT_ID/greentrace-subgraph/v0.0.1',
  mainnet: 'https://api.studio.thegraph.com/query/YOUR_PROJECT_ID/greentrace-mainnet/v0.0.1',
  local: 'http://localhost:8000/subgraphs/name/greentrace-subgraph'
};
```

### 2. 集成到组件

更新 `NFTMintRecords.tsx` 组件，添加The Graph数据源：

```typescript
import { useGraphQL, transformGraphQLData } from '@/hooks/useGraphQL';

// 在组件中添加
const graphqlData = useGraphQL();
const graphqlRecords = transformGraphQLData(graphqlData.mintRequests);
```

## 测试查询

### 1. 在Graph Explorer中测试

访问你的子图URL，在GraphQL Playground中测试查询：

```graphql
query GetUserMintRequests($requester: String!) {
  mintRequests(
    where: { requester: $requester }
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    tokenId
    title
    auditStatus
    isMinted
  }
}
```

### 2. 测试变量

```json
{
  "requester": "0xYOUR_WALLET_ADDRESS"
}
```

## 监控和维护

### 1. 查看子图状态

在The Graph Studio中查看：
- 同步状态
- 错误日志
- 查询性能

### 2. 更新子图

当合约更新时：

1. 更新ABI文件
2. 修改映射逻辑
3. 重新部署

```bash
npm run codegen
npm run build
npm run deploy
```

### 3. 性能优化

- 使用索引字段优化查询
- 实现分页查询
- 缓存常用数据

## 常见问题

### 1. 同步失败

检查：
- 合约地址是否正确
- 起始区块号是否正确
- 网络配置是否正确

### 2. 查询超时

优化：
- 添加where条件
- 使用分页
- 检查索引字段

### 3. 数据不完整

确保：
- 所有事件都被正确映射
- 没有映射错误
- 合约事件正确触发

## 成本考虑

### The Graph Studio (免费)
- 每月100万次查询
- 适合开发和测试

### The Graph Hosted Service (免费)
- 无限制查询
- 适合生产环境

### The Graph Network (付费)
- 去中心化网络
- 需要GRT代币

## 下一步

1. **部署到测试网** - 在Sepolia测试网部署和测试
2. **集成前端** - 将The Graph查询集成到前端应用
3. **性能优化** - 根据使用情况优化查询性能
4. **生产部署** - 部署到主网环境

## 相关资源

- [The Graph官方文档](https://thegraph.com/docs/)
- [Graph CLI文档](https://github.com/graphprotocol/graph-cli)
- [AssemblyScript文档](https://www.assemblyscript.org/)
- [GraphQL文档](https://graphql.org/) 