# GreenTrace 项目开发文档

---

## 1. 项目简介

GreenTrace 是一个基于区块链的碳减排项目管理与交易平台，结合 NFT、碳币（ERC20）、链下数据与 Chainlink，实现碳减排项目的发起、拍卖、审计、NFT铸造、NFT 交易、碳币兑换、数据可视化等功能。

---

## 2. 技术架构

### 2.1 合约层

- 主要合约：
  - GreenTrace（主业务合约，负责审计、NFT 兑换、费用分配等）
  - CarbonToken（ERC20 碳币合约）
  - GreenTalesNFT（ERC721 环保故事 NFT 合约）
  - GreenTalesMarket（NFT 交易市场合约）
  - GreenTalesAuction（NFT 拍卖与需求征集合约）
- 依赖 OpenZeppelin 合约库
- 预留 Chainlink VRF/Oracle 接口用于链下数据交互

### 2.2 前端层

- 技术栈：Next.js + RainbowKit + TailwindCSS
- 钱包连接与 Web3 交互：RainbowKit + wagmi + ethers.js
- UI 设计：TailwindCSS + shadcn/ui
- 数据可视化：Chart.js 或 React-Chartjs-2
- 状态管理：React Context/Zustand
- 预留与链下系统、Chainlink 交互的接口

### 2.3 后端链下系统（预留）

- 主要负责链下数据存储、业务逻辑、与 Chainlink 节点对接
- 技术建议：Node.js/Express + MongoDB/PostgreSQL
- 提供 RESTful API 或 GraphQL 服务

---

## 3. 合约功能说明

### 3.1 GreenTrace 主合约

- 审计管理：添加/移除审计员，提交/完成审计
- NFT 兑换碳币：NFT 审核通过后可兑换碳币，自动分配手续费、审计费
- 权限控制：审计员、业务合约白名单
- 事件通知：审计、兑换、铸造等事件

### 3.2 CarbonToken

- ERC20 标准碳币
- 仅允许 GreenTrace 合约铸造
- 初始供应量分配

### 3.3 GreenTalesNFT

- ERC721 标准 NFT
- 记录环保故事、碳减排量、价格等元数据
- 仅允许 GreenTrace 合约铸造/销毁

### 3.4 GreenTalesMarket

- NFT 挂单、购买、取消挂单
- 价格与历史成交记录
- 平台手续费收取

### 3.5 GreenTalesAuction

- NFT 拍卖与需求征集
- 多人出价、押金、拍卖完成自动铸造 NFT

---

## 4. 前端功能模块与技术栈

### 4.1 功能模块

#### 4.1.1 用户认证模块
- 邮箱/用户名登录
- 钱包地址登录
- 第三方登录(Google, Twitter等)
- 用户资料管理
- 密码重置
- 账户安全设置

#### 4.1.2 钱包连接与账户管理
- 多钱包支持
- 网络切换
- 余额显示
- 交易历史

#### 4.1.3 环保故事（NFT）功能
- NFT创建与展示
- 元数据管理
- 图片上传
- 属性设置

#### 4.1.4 市场功能
- NFT挂单
- 购买功能
- 取消挂单
- 价格管理

#### 4.1.5 拍卖功能
- 拍卖创建
- 出价功能
- 拍卖结束处理
- 押金管理

#### 4.1.6 碳币功能
- 余额显示
- 转账功能
- 兑换功能
- 交易历史

#### 4.1.7 审计功能
- 审计申请
- 状态展示
- 文件上传
- 评论功能

#### 4.1.8 数据统计
- 碳减排总量
- 交易量统计
- 价格趋势
- 用户分析

### 4.2 技术栈

- Next.js（页面与路由）
- RainbowKit + wagmi + ethers.js（钱包与合约交互）
- TailwindCSS + shadcn/ui（UI 设计）
- Chart.js/React-Chartjs-2（数据可视化）
- Zustand/React Context（状态管理）

---

## 5. 前端与合约交互说明

### 5.1 钱包与合约连接

- 使用 RainbowKit 实现钱包连接（支持 MetaMask、WalletConnect 等）
- 通过 wagmi/ethers.js 调用合约方法

### 5.2 合约交互核心流程

- 链接钱包后，获取用户地址、余额、NFT 列表等
- 创建 NFT：调用 GreenTalesNFT 合约 mint 方法
- NFT 挂单/购买：调用 GreenTalesMarket 合约相关方法
- NFT 兑换碳币：调用 GreenTrace 合约 exchangeNFT 方法
- 审计申请/提交：调用 GreenTrace 合约相关方法
- 监听合约事件，实时刷新前端数据

### 5.3 Chainlink 与链下数据交互（预留）

- 预留调用 Chainlink Oracle 的前端入口（如链下碳减排数据上链）
- 预留与后端链下系统的 API 交互接口（如项目详情、链下审计报告等）

---

## 6. 后端链下系统设计思路（预留）

- 负责存储链下业务数据（如详细项目文档、审计报告、用户行为日志等）
- 提供 API 给前端查询链下数据
- 与 Chainlink 节点对接，实现链下数据上链
- 可扩展为数据分析、合规审计等服务

---

## 7. 开发流程建议

### 7.1 合约开发

- 使用 Foundry/Hardhat 编写、测试、部署合约
- 编写详细注释与单元测试
- 部署到测试网，确保合约安全

### 7.2 前端开发

- Next.js 页面与组件开发
- 钱包与合约交互逻辑实现
- UI 设计与数据可视化
- 集成合约事件监听，提升用户体验

### 7.3 后端开发（预留）

- 设计数据库结构
- 实现 API 服务
- 与 Chainlink 节点对接

---

## 8. 部署与测试建议

- 合约建议先在本地链（Foundry/Hardhat）和测试网（Goerli/Sepolia）部署
- 前端建议本地开发后部署到 Vercel
- 后端链下系统可本地或云端部署
- 建议集成自动化测试与 CI/CD 流程
- 上线前进行安全审计与压力测试

---

> 本文档为 GreenTrace 项目全流程开发参考，后续可根据实际需求持续完善。 