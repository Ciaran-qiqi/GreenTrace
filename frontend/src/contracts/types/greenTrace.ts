import { Address } from 'viem';

// Audit status enumeration

export enum AuditStatus {
  PENDING = 0,    // Pending review

  APPROVED = 1,   // Passed

  REJECTED = 2    // Rejected

}

// Audit type enumeration

export enum AuditType {
  MINT = 0,       // Casting Audit

  EXCHANGE = 1    // Redemption audit

}

// Audit information interface

export interface AuditInfo {
  auditor: Address;           // Auditor's address

  tokenId: bigint;           // Nft token id

  carbonValue: bigint;       // Carbon value

  status: AuditStatus;       // Audit status

  auditType: AuditType;      // Audit Type

  timestamp: bigint;         // Timestamp

}

// Nft casting request parameter interface

export interface MintRequestParams {
  title: string;             // Nft title

  storyDetails: string;      // Environmental protection behavior details

  carbonReduction: bigint;   // Carbon emission reduction

  tokenURI: string;          // Metadata uri

}

// Commercial casting parameter interface

export interface BusinessMintParams {
  recipient: Address;        // Recipient address

  title: string;             // Nft title

  storyDetails: string;      // Environmental protection behavior details

  carbonReduction: bigint;   // Carbon emission reduction

  initialPrice: bigint;      // Initial price

  tokenURI: string;          // Metadata uri

}

// Pay and cast parameter interface

export interface PayAndMintParams {
  tokenId: bigint;           // Token id

  to: Address;               // Recipient address

  title: string;             // Nft title

  details: string;           // Details

  carbonReduction: bigint;   // Carbon emission reduction

  tokenURI: string;          // Metadata uri

}

// Casting audit parameter interface

export interface MintAuditParams {
  tokenId: bigint;           // Token id

  carbonValue: bigint;       // Carbon value

  reason: string;            // Audit reasons

}

// Exchange audit parameter interface

export interface ExchangeAuditParams {
  tokenId: bigint;           // Token id

  carbonValue: bigint;       // Carbon value

}

// Green trace constant interface

export interface GreenTraceConstants {
  baseRate?: bigint;         // Base rate

  systemFeeRate?: bigint;    // System rate

  auditFeeRate?: bigint;     // Audit rate

  initialized?: boolean;     // Is it initialized

  isTestEnvironment?: boolean; // Is it a test environment?

}

// Format audit information interface

export interface FormattedAuditInfo {
  auditor: string;           // Auditor's address

  tokenId: string;           // Token id

  carbonValue: number;       // Carbon value

  status: string;            // state

  auditType: string;         // Audit Type

  timestamp: string;         // Timestamp

}

// Casting request event interface

export interface MintRequestedEvent {
  tokenId: bigint;           // Token id

  requester: Address;        // Requester's address

  title: string;             // title

  details: string;           // Details

  carbonReduction: bigint;   // Carbon emission reduction

  tokenURI: string;          // Metadata uri

  totalFee: bigint;          // Total cost

}

// Nft post-casting audit event interface

export interface NFTMintedAfterAuditEvent {
  tokenId: bigint;           // Token id

  recipient: Address;        // Recipient address

  title: string;             // title

  carbonReduction: bigint;   // Carbon emission reduction

}

// Nft redemption event interface

export interface NFTExchangedEvent {
  tokenId: bigint;           // Token id

  owner: Address;            // Owner's address

  carbonAmount: bigint;      // Carbon token number

}

// Audit Submit Event Interface

export interface AuditSubmittedEvent {
  tokenId: bigint;           // Token id

  auditor: Address;          // Auditor's address

  carbonValue: bigint;       // Carbon value

  auditType: AuditType;      // Audit Type

}

// Audit completion event interface

export interface AuditCompletedEvent {
  tokenId: bigint;           // Token id

  status: AuditStatus;       // Audit status

  auditType: AuditType;      // Audit Type

}

// Write contract hook to return interface

export interface WriteContractHookReturn {
  isPending: boolean;        // Waiting or not

  isConfirming: boolean;     // Is it confirmed?

  isConfirmed: boolean;      // Is it confirmed

  error: Error | null;       // error message

  hash?: string;             // Transaction hash

} 