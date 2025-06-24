// The Graph AssemblyScript 映射文件
// 注意：这个文件使用 @graphprotocol/graph-ts 库，这是The Graph的标准库
// 在AssemblyScript环境中运行，不是普通的TypeScript环境

import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  MintRequested,
  AuditSubmitted,
  AuditRejected,
  NFTMintedAfterAudit,
  ExchangeRequested,
  NFTExchanged
} from "../generated/GreenTrace/GreenTrace"
import { MintRequest, Audit, ExchangeRequest, Statistics } from "../generated/schema"

// 处理铸造请求事件
export function handleMintRequested(event: MintRequested): void {
  let entity = new MintRequest(event.params.tokenId.toString())
  
  entity.tokenId = event.params.tokenId
  entity.requester = event.params.requester // Address类型可以直接赋值给Bytes
  entity.title = event.params.title
  entity.details = event.params.details
  entity.carbonReduction = event.params.carbonReduction
  entity.tokenURI = event.params.tokenURI
  entity.totalFee = event.params.totalFee
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  
  // 初始状态
  entity.auditStatus = "pending"
  entity.isMinted = false
  
  entity.createdAt = event.block.timestamp
  entity.updatedAt = event.block.timestamp
  
  entity.save()
  
  // 更新统计信息
  updateStatistics("mintRequested")
}

// 处理审计提交事件
export function handleAuditSubmitted(event: AuditSubmitted): void {
  let mintRequest = MintRequest.load(event.params.tokenId.toString())
  if (!mintRequest) return
  
  // 更新铸造请求的审计信息
  mintRequest.auditor = event.params.auditor // Address类型可以直接赋值给Bytes
  mintRequest.carbonValue = event.params.carbonValue
  mintRequest.auditStatus = "approved"
  mintRequest.auditTimestamp = event.block.timestamp
  mintRequest.updatedAt = event.block.timestamp
  
  mintRequest.save()
  
  // 创建审计记录
  let audit = new Audit(event.params.tokenId.toString())
  audit.tokenId = event.params.tokenId
  audit.auditor = event.params.auditor // Address类型可以直接赋值给Bytes
  audit.carbonValue = event.params.carbonValue
  audit.status = "approved"
  audit.auditType = "mint"
  audit.timestamp = event.block.timestamp
  audit.mintRequest = mintRequest.id
  
  audit.save()
  
  // 更新统计信息
  updateStatistics("auditApproved")
}

// 处理审计拒绝事件
export function handleAuditRejected(event: AuditRejected): void {
  let mintRequest = MintRequest.load(event.params.tokenId.toString())
  if (!mintRequest) return
  
  // 更新铸造请求的审计信息
  mintRequest.auditStatus = "rejected"
  mintRequest.auditReason = event.params.reason
  mintRequest.auditTimestamp = event.block.timestamp
  mintRequest.updatedAt = event.block.timestamp
  
  mintRequest.save()
  
  // 创建审计记录
  let audit = new Audit(event.params.tokenId.toString())
  audit.tokenId = event.params.tokenId
  audit.auditor = event.params.auditor // Address类型可以直接赋值给Bytes
  audit.carbonValue = BigInt.fromI32(0)
  audit.status = "rejected"
  audit.auditType = "mint"
  audit.timestamp = event.block.timestamp
  audit.reason = event.params.reason
  audit.mintRequest = mintRequest.id
  
  audit.save()
  
  // 更新统计信息
  updateStatistics("auditRejected")
}

// 处理NFT铸造完成事件
export function handleNFTMintedAfterAudit(event: NFTMintedAfterAudit): void {
  let mintRequest = MintRequest.load(event.params.tokenId.toString())
  if (!mintRequest) return
  
  // 更新铸造请求状态
  mintRequest.isMinted = true
  mintRequest.mintTimestamp = event.block.timestamp
  mintRequest.owner = event.params.recipient // Address类型可以直接赋值给Bytes
  mintRequest.updatedAt = event.block.timestamp
  
  mintRequest.save()
  
  // 更新统计信息
  updateStatistics("nftMinted")
}

// 处理兑换请求事件
export function handleExchangeRequested(event: ExchangeRequested): void {
  let entity = new ExchangeRequest(event.params.tokenId.toString())
  
  entity.tokenId = event.params.tokenId
  entity.requester = event.params.requester // Address类型可以直接赋值给Bytes
  entity.basePrice = event.params.basePrice
  entity.totalFee = event.params.totalFee
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  
  // 初始状态
  entity.auditStatus = "pending"
  entity.isExchanged = false
  
  entity.createdAt = event.block.timestamp
  entity.updatedAt = event.block.timestamp
  
  entity.save()
  
  // 更新统计信息
  updateStatistics("exchangeRequested")
}

// 处理NFT兑换事件
export function handleNFTExchanged(event: NFTExchanged): void {
  let exchangeRequest = ExchangeRequest.load(event.params.tokenId.toString())
  if (!exchangeRequest) return
  
  // 更新兑换请求状态
  exchangeRequest.isExchanged = true
  exchangeRequest.exchangeTimestamp = event.block.timestamp
  exchangeRequest.returnAmount = event.params.carbonAmount
  exchangeRequest.updatedAt = event.block.timestamp
  
  exchangeRequest.save()
  
  // 更新统计信息
  updateStatistics("nftExchanged")
}

// 更新统计信息
function updateStatistics(action: string): void {
  let stats = Statistics.load("global")
  if (!stats) {
    stats = new Statistics("global")
    stats.totalMintRequests = BigInt.fromI32(0)
    stats.totalApprovedMints = BigInt.fromI32(0)
    stats.totalRejectedMints = BigInt.fromI32(0)
    stats.totalMintedNFTs = BigInt.fromI32(0)
    stats.totalExchangeRequests = BigInt.fromI32(0)
    stats.totalExchangedNFTs = BigInt.fromI32(0)
    stats.totalCarbonReduction = BigInt.fromI32(0)
    stats.totalFeesCollected = BigInt.fromI32(0)
  }
  
  if (action == "mintRequested") {
    stats.totalMintRequests = stats.totalMintRequests.plus(BigInt.fromI32(1))
  } else if (action == "auditApproved") {
    stats.totalApprovedMints = stats.totalApprovedMints.plus(BigInt.fromI32(1))
  } else if (action == "auditRejected") {
    stats.totalRejectedMints = stats.totalRejectedMints.plus(BigInt.fromI32(1))
  } else if (action == "nftMinted") {
    stats.totalMintedNFTs = stats.totalMintedNFTs.plus(BigInt.fromI32(1))
  } else if (action == "exchangeRequested") {
    stats.totalExchangeRequests = stats.totalExchangeRequests.plus(BigInt.fromI32(1))
  } else if (action == "nftExchanged") {
    stats.totalExchangedNFTs = stats.totalExchangedNFTs.plus(BigInt.fromI32(1))
  }
  
  stats.save()
} 