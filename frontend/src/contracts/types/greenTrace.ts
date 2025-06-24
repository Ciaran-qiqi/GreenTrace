import { Address } from 'viem';

// 审计状态枚举
export enum AuditStatus {
  PENDING = 0,    // 待审核
  APPROVED = 1,   // 已通过
  REJECTED = 2    // 已拒绝
}

// 审计类型枚举
export enum AuditType {
  MINT = 0,       // 铸造审计
  EXCHANGE = 1    // 兑换审计
}

// 审计信息接口
export interface AuditInfo {
  auditor: Address;           // 审计员地址
  tokenId: bigint;           // NFT代币ID
  carbonValue: bigint;       // 碳价值
  status: AuditStatus;       // 审计状态
  auditType: AuditType;      // 审计类型
  timestamp: bigint;         // 时间戳
}

// NFT铸造请求参数接口
export interface MintRequestParams {
  title: string;             // NFT标题
  storyDetails: string;      // 环保行为详情
  carbonReduction: bigint;   // 碳减排量
  tokenURI: string;          // 元数据URI
}

// 商业铸造参数接口
export interface BusinessMintParams {
  recipient: Address;        // 接收者地址
  title: string;             // NFT标题
  storyDetails: string;      // 环保行为详情
  carbonReduction: bigint;   // 碳减排量
  initialPrice: bigint;      // 初始价格
  tokenURI: string;          // 元数据URI
}

// 支付并铸造参数接口
export interface PayAndMintParams {
  tokenId: bigint;           // 代币ID
  to: Address;               // 接收者地址
  title: string;             // NFT标题
  details: string;           // 详情
  carbonReduction: bigint;   // 碳减排量
  tokenURI: string;          // 元数据URI
}

// 铸造审计参数接口
export interface MintAuditParams {
  tokenId: bigint;           // 代币ID
  carbonValue: bigint;       // 碳价值
  reason: string;            // 审计理由
}

// 兑换审计参数接口
export interface ExchangeAuditParams {
  tokenId: bigint;           // 代币ID
  carbonValue: bigint;       // 碳价值
}

// GreenTrace常量接口
export interface GreenTraceConstants {
  baseRate?: bigint;         // 基础费率
  systemFeeRate?: bigint;    // 系统费率
  auditFeeRate?: bigint;     // 审计费率
  initialized?: boolean;     // 是否已初始化
  isTestEnvironment?: boolean; // 是否为测试环境
}

// 格式化审计信息接口
export interface FormattedAuditInfo {
  auditor: string;           // 审计员地址
  tokenId: string;           // 代币ID
  carbonValue: number;       // 碳价值
  status: string;            // 状态
  auditType: string;         // 审计类型
  timestamp: string;         // 时间戳
}

// 铸造请求事件接口
export interface MintRequestedEvent {
  tokenId: bigint;           // 代币ID
  requester: Address;        // 请求者地址
  title: string;             // 标题
  details: string;           // 详情
  carbonReduction: bigint;   // 碳减排量
  tokenURI: string;          // 元数据URI
  totalFee: bigint;          // 总费用
}

// NFT铸造后审计事件接口
export interface NFTMintedAfterAuditEvent {
  tokenId: bigint;           // 代币ID
  recipient: Address;        // 接收者地址
  title: string;             // 标题
  carbonReduction: bigint;   // 碳减排量
}

// NFT兑换事件接口
export interface NFTExchangedEvent {
  tokenId: bigint;           // 代币ID
  owner: Address;            // 所有者地址
  carbonAmount: bigint;      // 碳代币数量
}

// 审计提交事件接口
export interface AuditSubmittedEvent {
  tokenId: bigint;           // 代币ID
  auditor: Address;          // 审计员地址
  carbonValue: bigint;       // 碳价值
  auditType: AuditType;      // 审计类型
}

// 审计完成事件接口
export interface AuditCompletedEvent {
  tokenId: bigint;           // 代币ID
  status: AuditStatus;       // 审计状态
  auditType: AuditType;      // 审计类型
}

// 写合约钩子返回接口
export interface WriteContractHookReturn {
  isPending: boolean;        // 是否等待中
  isConfirming: boolean;     // 是否确认中
  isConfirmed: boolean;      // 是否已确认
  error: Error | null;       // 错误信息
  hash?: string;             // 交易哈希
} 