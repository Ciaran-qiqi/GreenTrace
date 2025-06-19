import { Address } from 'viem';

export enum AuditStatus {
  PENDING = 0,
  APPROVED = 1,
  REJECTED = 2
}

export enum AuditType {
  MINT = 0,
  EXCHANGE = 1
}

export interface AuditInfo {
  auditor: Address;
  tokenId: bigint;
  carbonValue: bigint;
  status: AuditStatus;
  auditType: AuditType;
  timestamp: bigint;
}

export interface MintRequestParams {
  title: string;
  storyDetails: string;
  carbonReduction: bigint;
  tokenURI: string;
}

export interface BusinessMintParams {
  recipient: Address;
  title: string;
  storyDetails: string;
  carbonReduction: bigint;
  initialPrice: bigint;
  tokenURI: string;
}

export interface PayAndMintParams {
  tokenId: bigint;
  to: Address;
  title: string;
  details: string;
  carbonReduction: bigint;
  tokenURI: string;
}

export interface MintAuditParams {
  tokenId: bigint;
  carbonValue: bigint;
  reason: string;
}

export interface ExchangeAuditParams {
  tokenId: bigint;
  carbonValue: bigint;
}

export interface GreenTraceConstants {
  baseRate?: bigint;
  systemFeeRate?: bigint;
  auditFeeRate?: bigint;
  initialized?: boolean;
  isTestEnvironment?: boolean;
}

export interface FormattedAuditInfo {
  auditor: string;
  tokenId: string;
  carbonValue: number;
  status: string;
  auditType: string;
  timestamp: string;
}

export interface MintRequestedEvent {
  tokenId: bigint;
  requester: Address;
  title: string;
  details: string;
  carbonReduction: bigint;
  tokenURI: string;
  totalFee: bigint;
}

export interface NFTMintedAfterAuditEvent {
  tokenId: bigint;
  recipient: Address;
  title: string;
  carbonReduction: bigint;
}

export interface NFTExchangedEvent {
  tokenId: bigint;
  owner: Address;
  carbonAmount: bigint;
}

export interface AuditSubmittedEvent {
  tokenId: bigint;
  auditor: Address;
  carbonValue: bigint;
  auditType: AuditType;
}

export interface AuditCompletedEvent {
  tokenId: bigint;
  status: AuditStatus;
  auditType: AuditType;
}

export interface WriteContractHookReturn {
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  hash?: string;
} 