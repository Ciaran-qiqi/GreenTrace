# GreenTrace NFT交易市场开发计划

## 📋 项目概述

基于已完善的 `GreenTalesMarket.sol` 智能合约，开发一个功能完整、用户体验优秀的NFT交易市场前端界面。该市场将支持环保故事NFT的挂单、购买、价格管理等核心交易功能。

## 🎯 总体目标

- 🏪 构建完整的NFT二级市场交易平台
- 💰 支持碳币作为交易货币
- 📊 提供实时市场数据和统计信息
- 👤 优化用户交易体验和资产管理
- 📱 实现响应式设计，支持多端访问

## 🏗️ 技术架构分析

### 智能合约能力（已完善）

**核心交易功能：**
- ✅ NFT挂单 (`listNFT`) - 支持设定价格挂单销售
- ✅ NFT购买 (`buyNFT`) - 支持碳币购买，含手续费机制
- ✅ 取消挂单 (`cancelListing`) - 挂单者可随时取消
- ✅ 价格更新 (`updatePrice`) - 动态调整挂单价格

**数据查询功能：**
- ✅ 分页查询 (`getListingsWithPagination`) - 支持大量数据展示
- ✅ 用户挂单 (`getUserListings`) - 个人挂单管理
- ✅ 交易历史 (`getTradeHistory`) - 完整交易记录
- ✅ 市场统计 (`getListingStats`) - 总挂单数和用户数
- ✅ NFT完整信息 (`getNFTFullInfo`) - 包含元数据和交易信息

**安全特性：**
- ✅ 重入攻击防护 (`ReentrancyGuard`)
- ✅ 权限管理 (`Ownable`)
- ✅ NFT安全接收 (`IERC721Receiver`)
- ✅ 手续费机制（平台收益）

### 合约地址配置
```typescript
// Sepolia测试网配置
Market: '0x2661421e4e0373a06A3e705A83d1063e8F2F40EA'
NFT: '0x3456a42043955B1626F6353936c0FEfCd1cB5f1c'
CarbonToken: '0x808b73A3A1D97382acF32d4F4F834e799Aa08198'
```

## 📱 前端开发计划

### 页面结构设计

```
/market - NFT交易市场主页面
├── 🏪 市场概览区域
│   ├── 统计数据展示（总挂单、活跃用户、成交额）
│   ├── 热门NFT推荐
│   └── 市场趋势图表
├── 🔍 搜索筛选区域  
│   ├── 关键词搜索
│   ├── 价格范围筛选
│   ├── 碳减排量筛选
│   └── 排序选项（价格、时间、热度）
├── 🖼️ NFT展示网格
│   ├── NFT卡片展示
│   ├── 分页加载
│   └── 无限滚动
└── 👤 用户交易管理
    ├── 我的挂单
    ├── 购买历史
    └── 销售历史
```

## 🧩 组件开发清单

### A. 核心页面组件

| 组件名称 | 文件路径 | 功能描述 | 优先级 |
|---------|---------|---------|--------|
| `NFTMarketplace` | `/components/market/NFTMarketplace.tsx` | 市场主页面容器组件 | 🔴 高 |
| `MarketStats` | `/components/market/MarketStats.tsx` | 市场统计信息展示 | 🟡 中 |
| `NFTGrid` | `/components/market/NFTGrid.tsx` | NFT网格展示组件 | 🔴 高 |
| `MarketFilters` | `/components/market/MarketFilters.tsx` | 筛选器组件 | 🟡 中 |

### B. NFT交易组件

| 组件名称 | 文件路径 | 功能描述 | 优先级 |
|---------|---------|---------|--------|
| `NFTMarketCard` | `/components/market/NFTMarketCard.tsx` | 市场中的NFT卡片 | 🔴 高 |
| `ListNFTModal` | `/components/market/ListNFTModal.tsx` | 挂单NFT模态框 | 🔴 高 |
| `BuyNFTModal` | `/components/market/BuyNFTModal.tsx` | 购买NFT模态框 | 🔴 高 |
| `PriceUpdateModal` | `/components/market/PriceUpdateModal.tsx` | 更新价格模态框 | 🟡 中 |
| `CancelListingModal` | `/components/market/CancelListingModal.tsx` | 取消挂单确认框 | 🟡 中 |

### C. 用户管理组件

| 组件名称 | 文件路径 | 功能描述 | 优先级 |
|---------|---------|---------|--------|
| `MyListings` | `/components/market/MyListings.tsx` | 我的挂单管理 | 🟡 中 |
| `PurchaseHistory` | `/components/market/PurchaseHistory.tsx` | 购买历史记录 | 🔵 低 |
| `SalesHistory` | `/components/market/SalesHistory.tsx` | 销售历史记录 | 🔵 低 |

### D. 市场工具组件

| 组件名称 | 文件路径 | 功能描述 | 优先级 |
|---------|---------|---------|--------|
| `PriceChart` | `/components/market/PriceChart.tsx` | NFT价格趋势图 | 🔵 低 |
| `TradeHistoryTable` | `/components/market/TradeHistoryTable.tsx` | 交易历史表格 | 🔵 低 |
| `MarketSearch` | `/components/market/MarketSearch.tsx` | 市场搜索组件 | 🟡 中 |

## 🔗 Hook开发清单

### A. 市场数据Hook

| Hook名称 | 文件路径 | 功能描述 | 依赖合约方法 |
|---------|---------|---------|------------|
| `useMarketNFTs` | `/hooks/market/useMarketNFTs.ts` | 获取市场NFT列表 | `getListingsWithPagination` |
| `useMarketStats` | `/hooks/market/useMarketStats.ts` | 获取市场统计数据 | `getListingStats` |
| `useNFTDetails` | `/hooks/market/useNFTDetails.ts` | 获取NFT详细信息 | `getNFTFullInfo` |

### B. 交易功能Hook

| Hook名称 | 文件路径 | 功能描述 | 依赖合约方法 |
|---------|---------|---------|------------|
| `useListNFT` | `/hooks/market/useListNFT.ts` | NFT挂单功能 | `listNFT` |
| `useBuyNFT` | `/hooks/market/useBuyNFT.ts` | NFT购买功能 | `buyNFT` |
| `useCancelListing` | `/hooks/market/useCancelListing.ts` | 取消挂单功能 | `cancelListing` |
| `useUpdatePrice` | `/hooks/market/useUpdatePrice.ts` | 更新价格功能 | `updatePrice` |

### C. 用户数据Hook

| Hook名称 | 文件路径 | 功能描述 | 依赖合约方法 |
|---------|---------|---------|------------|
| `useUserListings` | `/hooks/market/useUserListings.ts` | 获取用户挂单 | `getUserListings` |
| `useTradeHistory` | `/hooks/market/useTradeHistory.ts` | 获取交易历史 | `getTradeHistory` |

## 🎨 UI/UX设计要点

### 设计风格

**🎯 设计原则：**
- 简洁现代 - 清晰的信息层次
- 环保主题 - 绿色色彩搭配
- 用户友好 - 直观的操作流程

**🎨 视觉规范：**
```css
/* 主色调 */
--primary-green: #10b981     /* 主绿色 */
--dark-green: #059669        /* 深绿色 */
--light-green: #d1fae5       /* 浅绿色 */

/* 功能色 */
--success: #22c55e           /* 成功绿 */
--warning: #f59e0b           /* 警告橙 */
--error: #ef4444             /* 错误红 */

/* 中性色 */
--gray-50: #f9fafb
--gray-800: #1f2937
--gray-900: #111827
```

### 响应式设计

**📱 断点设置：**
- Mobile: < 768px
- Tablet: 768px - 1024px  
- Desktop: > 1024px

**🖼️ 网格布局：**
- Mobile: 1列
- Tablet: 2-3列
- Desktop: 4-6列

### 交互体验

**⚡ 性能优化：**
- 图片懒加载
- 虚拟滚动
- 分页加载
- 缓存策略

**🔔 用户反馈：**
- Loading状态
- 成功/失败Toast
- 交易确认弹窗
- 进度指示器

## ⚙️ 技术实现要点

### 智能合约集成

**📄 ABI配置：**
```typescript
// 已有ABI文件
import GreenTalesMarketABI from '@/contracts/abi/GreenTalesMarket.json';
import GreenTalesNFTABI from '@/contracts/abi/GreenTalesNFT.json';
import CarbonTokenABI from '@/contracts/abi/CarbonToken.json';
```

**🔗 Wagmi集成：**
```typescript
// Hook示例
const { data, write } = useContractWrite({
  address: marketAddress,
  abi: GreenTalesMarketABI.abi,
  functionName: 'listNFT',
});
```

### 数据状态管理

**📊 React Query：**
- 数据缓存策略
- 自动重新获取
- 乐观更新
- 错误重试

**🔄 实时更新：**
```typescript
// 事件监听
useContractEvent({
  address: marketAddress,
  abi: GreenTalesMarketABI.abi,
  eventName: 'NFTListed',
  listener: (log) => {
    // 刷新市场数据
    queryClient.invalidateQueries(['marketNFTs']);
  },
});
```

### 错误处理机制

**🚨 错误类型：**
- 网络连接错误
- 合约调用失败
- 用户拒绝交易
- 余额不足
- 权限不足

**🛠️ 处理策略：**
```typescript
// 统一错误处理
const handleContractError = (error: Error) => {
  if (error.message.includes('user rejected')) {
    toast.error('用户取消了交易');
  } else if (error.message.includes('insufficient funds')) {
    toast.error('余额不足，请检查碳币余额');
  } else {
    toast.error('交易失败，请重试');
  }
};
```

## 📅 开发时间规划

### 第一阶段：核心功能（1-2周）

**🎯 目标：** 实现基础买卖功能

**📋 任务清单：**
- [ ] 创建市场主页面 (`NFTMarketplace.tsx`)
- [ ] 实现NFT网格展示 (`NFTGrid.tsx`)
- [ ] 开发NFT市场卡片 (`NFTMarketCard.tsx`)
- [ ] 实现挂单功能 (`ListNFTModal.tsx`)
- [ ] 实现购买功能 (`BuyNFTModal.tsx`)
- [ ] 开发相关Hook (`useMarketNFTs`, `useListNFT`, `useBuyNFT`)

### 第二阶段：用户体验（1-2周）

**🎯 目标：** 优化交互体验

**📋 任务清单：**
- [ ] 开发我的挂单管理 (`MyListings.tsx`)
- [ ] 实现搜索筛选功能 (`MarketFilters.tsx`)
- [ ] 添加价格更新功能 (`PriceUpdateModal.tsx`)
- [ ] 开发市场统计展示 (`MarketStats.tsx`)
- [ ] 优化加载和错误状态
- [ ] 添加交易确认流程

### 第三阶段：高级功能（1-2周）

**🎯 目标：** 完善市场功能

**📋 任务清单：**
- [ ] 开发交易历史功能 (`TradeHistoryTable.tsx`)
- [ ] 实现价格趋势图表 (`PriceChart.tsx`)
- [ ] 添加销售/购买历史 (`SalesHistory.tsx`, `PurchaseHistory.tsx`)
- [ ] 优化移动端体验
- [ ] 添加高级筛选功能
- [ ] 性能优化和测试

## 🧪 测试计划

### 功能测试

**🔍 测试范围：**
- NFT挂单流程
- NFT购买流程
- 价格更新功能
- 取消挂单功能
- 搜索筛选功能

### 用户体验测试

**👥 测试场景：**
- 新用户首次使用
- 老用户日常交易
- 移动端操作体验
- 网络异常处理

### 性能测试

**⚡ 测试指标：**
- 页面加载时间
- 组件渲染性能
- 大量数据展示
- 内存使用情况

## 🚀 部署计划

### 环境配置

**🌍 部署环境：**
- 开发环境：本地测试
- 测试环境：Sepolia测试网
- 生产环境：以太坊主网

**🔧 配置管理：**
```typescript
// 环境变量配置
NEXT_PUBLIC_MARKET_ADDRESS=0x2661421e4e0373a06A3e705A83d1063e8F2F40EA
NEXT_PUBLIC_NFT_ADDRESS=0x3456a42043955B1626F6353936c0FEfCd1cB5f1c
NEXT_PUBLIC_CARBON_TOKEN_ADDRESS=0x808b73A3A1D97382acF32d4F4F834e799Aa08198
```

### 发布流程

**📦 构建部署：**
1. 代码审查和测试
2. 构建生产版本
3. 部署到测试环境
4. 用户验收测试
5. 部署到生产环境

## 📚 文档规范

### 代码文档

**📝 注释规范：**
- 组件功能说明
- Hook使用说明
- 接口参数说明
- 业务逻辑注释

### API文档

**🔗 接口说明：**
- 智能合约方法说明
- Hook使用示例
- 错误处理说明
- 最佳实践指南

---

## 🏁 总结

这个NFT交易市场开发计划基于你已经完善的智能合约，将提供一个功能完整、用户体验优秀的NFT交易平台。通过分阶段开发，我们可以逐步构建核心功能，优化用户体验，最终交付一个高质量的产品。

**🎯 核心价值：**
- 💚 支持环保故事NFT交易
- 💰 使用碳币作为交易货币
- 🔒 安全可靠的交易机制
- 📱 现代化的用户界面
- ⚡ 优秀的性能表现

**📞 联系方式：**
如有任何开发问题或建议，请随时沟通讨论！ 