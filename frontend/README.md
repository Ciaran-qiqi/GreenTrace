# GreenTrace - 碳信用NFT生态系统

GreenTrace是一个基于区块链技术的碳信用NFT生态系统，通过记录用户的环保行为，将绿色行动转化为有价值的数字资产。

## 🚀 技术栈

- **前端框架**: Next.js 15.3.3 + React 18
- **Web3集成**: Wagmi + RainbowKit + Ethers.js
- **样式**: Tailwind CSS 4
- **语言**: TypeScript
- **状态管理**: TanStack React Query

## 📋 功能特性

### 🌱 核心功能
- **绿色NFT创建**: 记录环保行为，铸造专属NFT
- **专业审计**: 验证环保行为真实性
- **碳代币兑换**: 将NFT兑换为碳信用代币
- **交易市场**: NFT和碳代币的交易平台

### 🔗 智能合约
- **GreenTrace**: 核心管理合约
- **CarbonToken**: 碳信用代币
- **GreenTalesNFT**: NFT合约
- **Market**: 交易市场
- **CarbonPriceOracle**: 价格预言机
- **LiquidityPool**: 流动性池
- **USDTMarket**: 订单簿市场

## 🛠️ 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 环境配置
创建 `.env.local` 文件并配置以下环境变量：

```env
# Web3配置
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id

# 合约地址配置 (Sepolia测试网)
NEXT_PUBLIC_CARBON_TOKEN_ADDRESS=0x808b73A3A1D97382acF32d4F4F834e799Aa08198
NEXT_PUBLIC_GREEN_TRACE_ADDRESS=0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673
NEXT_PUBLIC_NFT_ADDRESS=0x3456a42043955B1626F6353936c0FEfCd1cB5f1c
NEXT_PUBLIC_MARKET_ADDRESS=0x82c59961a858f92816d61be7Ec28541E51d37224
NEXT_PUBLIC_CARBON_PRICE_ORACLE_ADDRESS=0xE3E2262fb8C00374b1E73F34AE34df2cE36F03FA
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS=0xCfBE2B410E5707b35231B9237bD7E523403Db889
NEXT_PUBLIC_CARBON_USDT_MARKET_ADDRESS=0x8dBe778e693B4c0665974BED7a5C63B668B8f6A3

# 应用配置
NEXT_PUBLIC_APP_NAME=GreenTrace
NEXT_PUBLIC_APP_DESCRIPTION=碳信用NFT生态系统
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 构建生产版本
```bash
npm run build
npm start
```

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── create/            # NFT创建页面
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 主页面
├── components/            # React组件
│   ├── Auth.tsx          # 钱包连接组件
│   ├── CreateNFT.tsx     # NFT创建组件
│   ├── Navigation.tsx    # 导航组件
│   └── providers.tsx     # Web3提供者
├── contracts/            # 智能合约相关
│   ├── abi/              # 合约ABI文件
│   ├── hooks/            # 合约交互钩子
│   ├── types/            # TypeScript类型定义
│   └── addresses.ts      # 合约地址配置
└── lib/                  # 工具库
    └── wagmi.ts          # Wagmi配置
```

## 🔧 合约交互

### 主要钩子函数

#### GreenTrace合约
- `useGreenTraceConstants()`: 获取合约常量
- `useRequestMintNFT()`: 请求铸造NFT
- `useCalculateRequestFee()`: 计算请求费用
- `useSubmitMintAudit()`: 提交铸造审计
- `useExchangeNFT()`: 兑换NFT

#### CarbonToken合约
- `useCarbonTokenBalance()`: 查询代币余额
- `useCarbonTokenAllowance()`: 查询授权额度
- `useApproveCarbonToken()`: 授权代币
- `useTransferCarbonToken()`: 转账代币

## 🌐 支持的网络

- **Sepolia测试网** (主要开发环境)
- **以太坊主网** (生产环境)
- **本地Foundry测试网** (本地开发)

## 💡 使用流程

1. **连接钱包**: 使用MetaMask或其他支持的钱包
2. **创建NFT**: 填写环保行为信息并提交
3. **支付费用**: 使用碳代币支付请求费用
4. **等待审计**: 专业审计员验证行为真实性
5. **获得NFT**: 审核通过后获得绿色NFT
6. **兑换代币**: 将NFT兑换为碳代币

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🔗 相关链接

- [项目文档](https://docs.greentrace.io)
- [智能合约](https://github.com/greentrace/contracts)
- [API文档](https://api.greentrace.io)

## 📞 联系我们

- 邮箱: contact@greentrace.io
- 推特: [@GreenTrace](https://twitter.com/GreenTrace)
- Discord: [GreenTrace社区](https://discord.gg/greentrace)
