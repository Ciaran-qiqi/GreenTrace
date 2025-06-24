import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  // GreenTrace 事件
  MintRequested,
  AuditSubmitted,
  AuditRejected,
  NFTMintedAfterAudit,
  ExchangeRequested,
  NFTExchanged,
  Transfer as NFTTransfer,
  
  // CarbonToken 事件
  Transfer as CarbonTokenTransfer,
  Mint as CarbonTokenMint,
  Burn as CarbonTokenBurn,
  
  // CarbonPriceOracle 事件
  PriceUpdated,
  
  // GreenTalesMarket 事件
  NFTListed,
  NFTSold,
  NFTDelisted,
  
  // GreenTalesLiquidityPool 事件
  LiquidityAdded,
  LiquidityRemoved,
  Swap,
  
  // CarbonUSDTMarket 事件
  CarbonBought,
  CarbonSold
} from "../generated/GreenTrace/GreenTrace"

import { 
  MintRequest, 
  Audit, 
  ExchangeRequest, 
  Statistics,
  CarbonToken,
  CarbonTokenTransfer as CarbonTokenTransferEntity,
  CarbonPriceOracle,
  CarbonPriceUpdate,
  GreenTalesMarket,
  MarketTrade,
  GreenTalesLiquidityPool,
  LiquidityPoolEvent,
  CarbonUSDTMarket,
  USDTMarketTrade
} from "../generated/schema"

// ==================== GreenTrace 事件处理 ====================

export function handleMintRequested(event: MintRequested): void {
  let entity = new MintRequest(event.params.tokenId.toString())
  
  entity.tokenId = event.params.tokenId
  entity.requester = event.params.requester
  entity.title = event.params.title
  entity.details = event.params.details
  entity.carbonReduction = event.params.carbonReduction
  entity.tokenURI = event.params.tokenURI
  entity.totalFee = event.params.totalFee
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  
  entity.auditStatus = "pending"
  entity.isMinted = false
  
  entity.createdAt = event.block.timestamp
  entity.updatedAt = event.block.timestamp
  
  entity.save()
  updateStatistics("mintRequested")
}

export function handleAuditSubmitted(event: AuditSubmitted): void {
  let mintRequest = MintRequest.load(event.params.tokenId.toString())
  if (!mintRequest) return
  
  mintRequest.auditor = event.params.auditor
  mintRequest.carbonValue = event.params.carbonValue
  mintRequest.auditStatus = "approved"
  mintRequest.auditTimestamp = event.block.timestamp
  mintRequest.updatedAt = event.block.timestamp
  
  mintRequest.save()
  
  let audit = new Audit(event.params.tokenId.toString())
  audit.tokenId = event.params.tokenId
  audit.auditor = event.params.auditor
  audit.carbonValue = event.params.carbonValue
  audit.status = "approved"
  audit.auditType = "mint"
  audit.timestamp = event.block.timestamp
  audit.mintRequest = mintRequest.id
  
  audit.save()
  updateStatistics("auditApproved")
}

export function handleAuditRejected(event: AuditRejected): void {
  let mintRequest = MintRequest.load(event.params.tokenId.toString())
  if (!mintRequest) return
  
  mintRequest.auditStatus = "rejected"
  mintRequest.auditReason = event.params.reason
  mintRequest.auditTimestamp = event.block.timestamp
  mintRequest.updatedAt = event.block.timestamp
  
  mintRequest.save()
  
  let audit = new Audit(event.params.tokenId.toString())
  audit.tokenId = event.params.tokenId
  audit.auditor = event.params.auditor
  audit.carbonValue = BigInt.fromI32(0)
  audit.status = "rejected"
  audit.auditType = "mint"
  audit.timestamp = event.block.timestamp
  audit.reason = event.params.reason
  audit.mintRequest = mintRequest.id
  
  audit.save()
  updateStatistics("auditRejected")
}

export function handleNFTMintedAfterAudit(event: NFTMintedAfterAudit): void {
  let mintRequest = MintRequest.load(event.params.tokenId.toString())
  if (!mintRequest) return
  
  mintRequest.isMinted = true
  mintRequest.mintTimestamp = event.block.timestamp
  mintRequest.owner = event.params.recipient
  mintRequest.updatedAt = event.block.timestamp
  
  mintRequest.save()
  updateStatistics("nftMinted")
}

export function handleExchangeRequested(event: ExchangeRequested): void {
  let entity = new ExchangeRequest(event.params.tokenId.toString())
  
  entity.tokenId = event.params.tokenId
  entity.requester = event.params.requester
  entity.basePrice = event.params.basePrice
  entity.totalFee = event.params.totalFee
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash
  
  entity.auditStatus = "pending"
  entity.isExchanged = false
  
  entity.createdAt = event.block.timestamp
  entity.updatedAt = event.block.timestamp
  
  entity.save()
  updateStatistics("exchangeRequested")
}

export function handleNFTExchanged(event: NFTExchanged): void {
  let exchangeRequest = ExchangeRequest.load(event.params.tokenId.toString())
  if (!exchangeRequest) return
  
  exchangeRequest.isExchanged = true
  exchangeRequest.exchangeTimestamp = event.block.timestamp
  exchangeRequest.returnAmount = event.params.carbonAmount
  exchangeRequest.updatedAt = event.block.timestamp
  
  exchangeRequest.save()
  updateStatistics("nftExchanged")
}

export function handleNFTTransfer(event: NFTTransfer): void {
  if (event.params.from.equals(Address.zero())) {
    let mintRequest = MintRequest.load(event.params.tokenId.toString())
    if (mintRequest) {
      mintRequest.owner = event.params.to
      mintRequest.updatedAt = event.block.timestamp
      mintRequest.save()
    }
  }
}

// ==================== CarbonToken 事件处理 ====================

export function handleCarbonTokenTransfer(event: CarbonTokenTransfer): void {
  let transfer = new CarbonTokenTransferEntity(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  transfer.from = event.params.from
  transfer.to = event.params.to
  transfer.amount = event.params.value
  transfer.blockNumber = event.block.number
  transfer.blockTimestamp = event.block.timestamp
  transfer.transactionHash = event.transaction.hash
  
  // 获取或创建CarbonToken实体
  let carbonToken = CarbonToken.load(event.address.toHexString())
  if (!carbonToken) {
    carbonToken = new CarbonToken(event.address.toHexString())
    carbonToken.address = event.address
    carbonToken.name = "Carbon Token"
    carbonToken.symbol = "CT"
    carbonToken.decimals = 18
    carbonToken.totalSupply = BigInt.fromI32(0)
    carbonToken.totalTransfers = BigInt.fromI32(0)
    carbonToken.totalVolume = BigInt.fromI32(0)
    carbonToken.createdAt = event.block.timestamp
  }
  
  carbonToken.totalTransfers = carbonToken.totalTransfers.plus(BigInt.fromI32(1))
  carbonToken.totalVolume = carbonToken.totalVolume.plus(event.params.value)
  carbonToken.updatedAt = event.block.timestamp
  
  transfer.contract = carbonToken.id
  carbonToken.save()
  transfer.save()
  
  updateStatistics("carbonTransfer")
}

export function handleCarbonTokenMint(event: CarbonTokenMint): void {
  let carbonToken = CarbonToken.load(event.address.toHexString())
  if (!carbonToken) return
  
  carbonToken.totalSupply = carbonToken.totalSupply.plus(event.params.amount)
  carbonToken.updatedAt = event.block.timestamp
  carbonToken.save()
}

export function handleCarbonTokenBurn(event: CarbonTokenBurn): void {
  let carbonToken = CarbonToken.load(event.address.toHexString())
  if (!carbonToken) return
  
  carbonToken.totalSupply = carbonToken.totalSupply.minus(event.params.amount)
  carbonToken.updatedAt = event.block.timestamp
  carbonToken.save()
}

// ==================== CarbonPriceOracle 事件处理 ====================

export function handlePriceUpdate(event: PriceUpdated): void {
  let priceUpdate = new CarbonPriceUpdate(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  priceUpdate.price = event.params.price
  priceUpdate.timestamp = event.params.timestamp
  priceUpdate.blockNumber = event.block.number
  priceUpdate.transactionHash = event.transaction.hash
  
  // 获取或创建CarbonPriceOracle实体
  let oracle = CarbonPriceOracle.load(event.address.toHexString())
  if (!oracle) {
    oracle = new CarbonPriceOracle(event.address.toHexString())
    oracle.address = event.address
    oracle.currentPrice = BigInt.fromI32(0)
    oracle.lastUpdateTime = BigInt.fromI32(0)
    oracle.totalUpdates = BigInt.fromI32(0)
    oracle.priceHistory = []
    oracle.createdAt = event.block.timestamp
  }
  
  oracle.currentPrice = event.params.price
  oracle.lastUpdateTime = event.params.timestamp
  oracle.totalUpdates = oracle.totalUpdates.plus(BigInt.fromI32(1))
  oracle.priceHistory.push(event.params.price)
  oracle.updatedAt = event.block.timestamp
  
  priceUpdate.oracle = oracle.id
  oracle.save()
  priceUpdate.save()
  
  updateStatistics("priceUpdate")
}

// ==================== GreenTalesMarket 事件处理 ====================

export function handleNFTListed(event: NFTListed): void {
  let market = GreenTalesMarket.load(event.address.toHexString())
  if (!market) {
    market = new GreenTalesMarket(event.address.toHexString())
    market.address = event.address
    market.totalTrades = BigInt.fromI32(0)
    market.totalVolume = BigInt.fromI32(0)
    market.activeListings = BigInt.fromI32(0)
    market.createdAt = event.block.timestamp
  }
  
  market.activeListings = market.activeListings.plus(BigInt.fromI32(1))
  market.updatedAt = event.block.timestamp
  market.save()
}

export function handleNFTSold(event: NFTSold): void {
  let trade = new MarketTrade(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  trade.seller = event.params.seller
  trade.buyer = event.params.buyer
  trade.tokenId = event.params.tokenId
  trade.price = event.params.price
  trade.blockNumber = event.block.number
  trade.blockTimestamp = event.block.timestamp
  trade.transactionHash = event.transaction.hash
  
  let market = GreenTalesMarket.load(event.address.toHexString())
  if (!market) {
    market = new GreenTalesMarket(event.address.toHexString())
    market.address = event.address
    market.totalTrades = BigInt.fromI32(0)
    market.totalVolume = BigInt.fromI32(0)
    market.activeListings = BigInt.fromI32(0)
    market.createdAt = event.block.timestamp
  }
  
  market.totalTrades = market.totalTrades.plus(BigInt.fromI32(1))
  market.totalVolume = market.totalVolume.plus(event.params.price)
  market.activeListings = market.activeListings.minus(BigInt.fromI32(1))
  market.updatedAt = event.block.timestamp
  
  trade.market = market.id
  market.save()
  trade.save()
  
  updateStatistics("marketTrade")
}

export function handleNFTDelisted(event: NFTDelisted): void {
  let market = GreenTalesMarket.load(event.address.toHexString())
  if (!market) return
  
  market.activeListings = market.activeListings.minus(BigInt.fromI32(1))
  market.updatedAt = event.block.timestamp
  market.save()
}

// ==================== GreenTalesLiquidityPool 事件处理 ====================

export function handleLiquidityAdded(event: LiquidityAdded): void {
  let poolEvent = new LiquidityPoolEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  poolEvent.eventType = "add"
  poolEvent.user = event.params.provider
  poolEvent.amount0 = event.params.amount0
  poolEvent.amount1 = event.params.amount1
  poolEvent.blockNumber = event.block.number
  poolEvent.blockTimestamp = event.block.timestamp
  poolEvent.transactionHash = event.transaction.hash
  
  let pool = GreenTalesLiquidityPool.load(event.address.toHexString())
  if (!pool) {
    pool = new GreenTalesLiquidityPool(event.address.toHexString())
    pool.address = event.address
    pool.token0 = Address.zero()
    pool.token1 = Address.zero()
    pool.reserve0 = BigInt.fromI32(0)
    pool.reserve1 = BigInt.fromI32(0)
    pool.totalSupply = BigInt.fromI32(0)
    pool.totalEvents = BigInt.fromI32(0)
    pool.totalVolume = BigInt.fromI32(0)
    pool.createdAt = event.block.timestamp
  }
  
  pool.totalEvents = pool.totalEvents.plus(BigInt.fromI32(1))
  pool.totalVolume = pool.totalVolume.plus(event.params.amount0).plus(event.params.amount1)
  pool.updatedAt = event.block.timestamp
  
  poolEvent.pool = pool.id
  pool.save()
  poolEvent.save()
  
  updateStatistics("liquidityEvent")
}

export function handleLiquidityRemoved(event: LiquidityRemoved): void {
  let poolEvent = new LiquidityPoolEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  poolEvent.eventType = "remove"
  poolEvent.user = event.params.provider
  poolEvent.amount0 = event.params.amount0
  poolEvent.amount1 = event.params.amount1
  poolEvent.blockNumber = event.block.number
  poolEvent.blockTimestamp = event.block.timestamp
  poolEvent.transactionHash = event.transaction.hash
  
  let pool = GreenTalesLiquidityPool.load(event.address.toHexString())
  if (!pool) return
  
  pool.totalEvents = pool.totalEvents.plus(BigInt.fromI32(1))
  pool.updatedAt = event.block.timestamp
  
  poolEvent.pool = pool.id
  pool.save()
  poolEvent.save()
  
  updateStatistics("liquidityEvent")
}

export function handleSwap(event: Swap): void {
  let poolEvent = new LiquidityPoolEvent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  poolEvent.eventType = "swap"
  poolEvent.user = event.params.to
  poolEvent.amount0 = event.params.amount0In.plus(event.params.amount0Out)
  poolEvent.amount1 = event.params.amount1In.plus(event.params.amount1Out)
  poolEvent.blockNumber = event.block.number
  poolEvent.blockTimestamp = event.block.timestamp
  poolEvent.transactionHash = event.transaction.hash
  
  let pool = GreenTalesLiquidityPool.load(event.address.toHexString())
  if (!pool) return
  
  pool.totalEvents = pool.totalEvents.plus(BigInt.fromI32(1))
  pool.totalVolume = pool.totalVolume.plus(event.params.amount0In).plus(event.params.amount1In)
  pool.updatedAt = event.block.timestamp
  
  poolEvent.pool = pool.id
  pool.save()
  poolEvent.save()
  
  updateStatistics("liquidityEvent")
}

// ==================== CarbonUSDTMarket 事件处理 ====================

export function handleCarbonBought(event: CarbonBought): void {
  let trade = new USDTMarketTrade(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  trade.user = event.params.buyer
  trade.action = "buy"
  trade.carbonAmount = event.params.carbonAmount
  trade.usdtAmount = event.params.usdtAmount
  trade.blockNumber = event.block.number
  trade.blockTimestamp = event.block.timestamp
  trade.transactionHash = event.transaction.hash
  
  let market = CarbonUSDTMarket.load(event.address.toHexString())
  if (!market) {
    market = new CarbonUSDTMarket(event.address.toHexString())
    market.address = event.address
    market.totalTrades = BigInt.fromI32(0)
    market.totalCarbonVolume = BigInt.fromI32(0)
    market.totalUSDTVolume = BigInt.fromI32(0)
    market.createdAt = event.block.timestamp
  }
  
  market.totalTrades = market.totalTrades.plus(BigInt.fromI32(1))
  market.totalCarbonVolume = market.totalCarbonVolume.plus(event.params.carbonAmount)
  market.totalUSDTVolume = market.totalUSDTVolume.plus(event.params.usdtAmount)
  market.updatedAt = event.block.timestamp
  
  trade.market = market.id
  market.save()
  trade.save()
  
  updateStatistics("usdtTrade")
}

export function handleCarbonSold(event: CarbonSold): void {
  let trade = new USDTMarketTrade(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  )
  
  trade.user = event.params.seller
  trade.action = "sell"
  trade.carbonAmount = event.params.carbonAmount
  trade.usdtAmount = event.params.usdtAmount
  trade.blockNumber = event.block.number
  trade.blockTimestamp = event.block.timestamp
  trade.transactionHash = event.transaction.hash
  
  let market = CarbonUSDTMarket.load(event.address.toHexString())
  if (!market) {
    market = new CarbonUSDTMarket(event.address.toHexString())
    market.address = event.address
    market.totalTrades = BigInt.fromI32(0)
    market.totalCarbonVolume = BigInt.fromI32(0)
    market.totalUSDTVolume = BigInt.fromI32(0)
    market.createdAt = event.block.timestamp
  }
  
  market.totalTrades = market.totalTrades.plus(BigInt.fromI32(1))
  market.totalCarbonVolume = market.totalCarbonVolume.plus(event.params.carbonAmount)
  market.totalUSDTVolume = market.totalUSDTVolume.plus(event.params.usdtAmount)
  market.updatedAt = event.block.timestamp
  
  trade.market = market.id
  market.save()
  trade.save()
  
  updateStatistics("usdtTrade")
}

// ==================== 统计信息更新 ====================

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
    stats.totalCarbonTransfers = BigInt.fromI32(0)
    stats.totalMarketTrades = BigInt.fromI32(0)
    stats.totalLiquidityEvents = BigInt.fromI32(0)
    stats.totalUSDTTrades = BigInt.fromI32(0)
    stats.currentCarbonPrice = BigInt.fromI32(0)
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
  } else if (action == "carbonTransfer") {
    stats.totalCarbonTransfers = stats.totalCarbonTransfers.plus(BigInt.fromI32(1))
  } else if (action == "marketTrade") {
    stats.totalMarketTrades = stats.totalMarketTrades.plus(BigInt.fromI32(1))
  } else if (action == "liquidityEvent") {
    stats.totalLiquidityEvents = stats.totalLiquidityEvents.plus(BigInt.fromI32(1))
  } else if (action == "usdtTrade") {
    stats.totalUSDTTrades = stats.totalUSDTTrades.plus(BigInt.fromI32(1))
  }
  
  stats.save()
}