'use client';

import { useReadContract } from 'wagmi';
import { Address } from 'viem';
import { useGreenTrace } from '@/contracts/hooks/useGreenTrace';
import { useAccount } from 'wagmi';
import { useState, useEffect } from 'react';

// Event data structure

export interface MintRequestedEvent {
  tokenId: bigint;
  requester: Address;
  title: string;
  details: string;
  carbonReduction: bigint;
  tokenURI: string;
  totalFee: bigint;
  blockNumber: number;
  timestamp: number;
}

// Contract ABI type definition

interface ContractABI {
  type: string;
  name: string;
  inputs: Array<{
    type: string;
    name: string;
    indexed?: boolean;
  }>;
  outputs?: Array<{
    type: string;
    name: string;
  }>;
  stateMutability?: string;
}

// Hook using real blockchain events

export const useBlockchainEvents = () => {
  const { address, isConnected } = useAccount();
  const { address: contractAddress } = useGreenTrace();
  const [events, setEvents] = useState<MintRequestedEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Get historical events (simulated implementation)

  const fetchHistoricalEvents = async () => {
    if (!isConnected || !address || !contractAddress) {
      setEvents([]);
      return;
    }

    setLoading(true);
    
    try {
      // TODO: Implement historical event query
      // Here you should call the getLogs method of RPC

      console.log('获取历史事件...');
      
      // Simulate data

      const mockEvents: MintRequestedEvent[] = [
        {
          tokenId: BigInt(1),
          requester: address,
          title: '绿色出行记录',
          details: '今天选择乘坐公共交通工具出行',
          carbonReduction: BigInt('50000000000000000'), // 0.05 CT

          tokenURI: 'ipfs://QmExample1',
          totalFee: BigInt('1000000000000000000'), // 1 CT

          blockNumber: 123456,
          timestamp: Date.now() - 86400000
        }
      ];
      
      setEvents(mockEvents);
    } catch (error) {
      console.error('获取历史事件失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get historical events when wallet connects

  useEffect(() => {
    if (isConnected && address) {
      fetchHistoricalEvents();
    } else {
      setEvents([]);
    }
  }, [isConnected, address, contractAddress]);

  return {
    events,
    loading,
    refresh: fetchHistoricalEvents
  };
};

// Get audit information hook

export const useAuditInfo = (tokenId: bigint | null) => {
  const { address: contractAddress } = useGreenTrace();

  const { data: auditData } = useReadContract({
    address: contractAddress,
    abi: [
      {
        type: 'function',
        name: 'audits',
        inputs: [{ type: 'uint256', name: 'tokenId' }],
        outputs: [
          { type: 'address', name: 'auditor' },
          { type: 'uint256', name: 'tokenId' },
          { type: 'uint256', name: 'carbonValue' },
          { type: 'uint8', name: 'status' },
          { type: 'uint8', name: 'auditType' },
          { type: 'uint256', name: 'timestamp' }
        ],
        stateMutability: 'view'
      }
    ] as ContractABI[],
    functionName: 'audits',
    args: tokenId ? [tokenId] : undefined,
    query: {
      enabled: !!tokenId && !!contractAddress,
    }
  });

  return auditData;
};

// Check if nft has cast hook

export const useNFTMintStatus = (tokenId: bigint | null) => {
  const { address: nftContractAddress } = useGreenTrace(); // Need to get the nft contract address


  const { data: owner } = useReadContract({
    address: nftContractAddress,
    abi: [
      {
        type: 'function',
        name: 'ownerOf',
        inputs: [{ type: 'uint256', name: 'tokenId' }],
        outputs: [{ type: 'address', name: 'owner' }],
        stateMutability: 'view'
      }
    ] as ContractABI[],
    functionName: 'ownerOf',
    args: tokenId ? [tokenId] : undefined,
    query: {
      enabled: !!tokenId && !!nftContractAddress,
    }
  });

  return {
    isMinted: owner && owner !== '0x0000000000000000000000000000000000000000',
    owner
  };
}; 