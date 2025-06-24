import { Address } from 'viem';
import { formatEther } from 'viem';

// 事件日志接口
export interface EventLog {
  tokenId: number;
  requester: Address;
  title: string;
  details: string;
  carbonReduction: string;
  tokenURI: string;
  totalFee: string;
  blockNumber: number;
  timestamp: number;
}

// 审计信息接口
export interface AuditInfo {
  tokenId: number;
  auditor: Address;
  carbonValue: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  reason?: string;
}

// 获取事件日志的模拟函数
export const fetchMintRequestedEvents = async (
  contractAddress: Address,
  userAddress: Address,
  fromBlock: number = 0
): Promise<EventLog[]> => {
  // TODO: 实现真实的事件查询
  // 这里应该使用 wagmi 的 useContractEvent 或者直接调用 RPC
  
  console.log('查询MintRequested事件:', {
    contractAddress,
    userAddress,
    fromBlock
  });

  // 模拟返回数据
  return [
    {
      tokenId: 1,
      requester: userAddress,
      title: '绿色出行记录',
      details: '今天选择乘坐公共交通工具出行，减少了私家车使用，预计减少碳排放约0.05tCO₂e。',
      carbonReduction: '50000000000000000', // 0.05 CT in wei
      tokenURI: 'ipfs://QmExample1',
      totalFee: '1000000000000000000', // 1 CT in wei
      blockNumber: 123456,
      timestamp: Date.now() - 86400000
    },
    {
      tokenId: 2,
      requester: userAddress,
      title: '垃圾分类行动',
      details: '坚持垃圾分类，将可回收物、厨余垃圾、有害垃圾分别投放到对应垃圾桶。',
      carbonReduction: '20000000000000000', // 0.02 CT in wei
      tokenURI: 'ipfs://QmExample2',
      totalFee: '1000000000000000000', // 1 CT in wei
      blockNumber: 123457,
      timestamp: Date.now() - 3600000
    }
  ];
};

// 获取审计信息的模拟函数
export const fetchAuditInfo = async (
  contractAddress: Address,
  tokenId: number
): Promise<AuditInfo | null> => {
  // TODO: 实现真实的审计信息查询
  // 这里应该调用合约的 audits 函数
  
  console.log('查询审计信息:', { contractAddress, tokenId });

  // 模拟返回数据
  const mockAudits: Record<number, AuditInfo> = {
    1: {
      tokenId: 1,
      auditor: '0x1234567890123456789012345678901234567890' as Address,
      carbonValue: '50000000000000000', // 0.05 CT in wei
      status: 'approved',
      timestamp: Date.now() - 43200000
    },
    2: {
      tokenId: 2,
      auditor: '0x8765432109876543210987654321098765432109' as Address,
      carbonValue: '20000000000000000', // 0.02 CT in wei
      status: 'approved',
      timestamp: Date.now() - 1800000
    }
  };

  return mockAudits[tokenId] || null;
};

// 检查NFT是否已铸造
export const checkNFTMinted = async (
  nftContractAddress: Address,
  tokenId: number
): Promise<boolean> => {
  // TODO: 实现真实的NFT铸造状态检查
  // 这里应该调用NFT合约的 ownerOf 函数
  
  console.log('检查NFT铸造状态:', { nftContractAddress, tokenId });

  // 模拟返回数据
  const mintedTokens = [1]; // 假设tokenId 1已经铸造
  return mintedTokens.includes(tokenId);
};

// 组合完整的NFT记录
export const combineNFTRecord = (
  eventLog: EventLog,
  auditInfo: AuditInfo | null,
  isMinted: boolean
) => {
  let status: 'pending' | 'approved' | 'rejected' | 'minted' = 'pending';
  
  if (auditInfo) {
    if (auditInfo.status === 'approved') {
      status = isMinted ? 'minted' : 'approved';
    } else if (auditInfo.status === 'rejected') {
      status = 'rejected';
    }
  }

  return {
    tokenId: eventLog.tokenId,
    title: eventLog.title,
    details: eventLog.details,
    carbonReduction: formatEther(BigInt(eventLog.carbonReduction)),
    tokenURI: eventLog.tokenURI,
    totalFee: eventLog.totalFee,
    status,
    timestamp: eventLog.timestamp,
    auditor: auditInfo?.auditor,
    carbonValue: auditInfo?.carbonValue ? formatEther(BigInt(auditInfo.carbonValue)) : undefined,
    reason: auditInfo?.reason
  };
}; 