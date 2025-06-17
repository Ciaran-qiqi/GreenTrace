import { useCallback, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import GreenTraceABI from '@/src/contracts/abi/GreenTrace.json';

export function useContract() {
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initContract = useCallback(async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('请安装MetaMask钱包');
      }

      // 创建provider
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = await provider.getSigner();

      // 创建合约实例
      const contractAddress = process.env.NEXT_PUBLIC_GREEN_TRACE_ADDRESS;
      if (!contractAddress) {
        throw new Error('合约地址未配置');
      }

      const contract = new ethers.Contract(
        contractAddress,
        GreenTraceABI.abi,
        signer
      );

      setContract(contract);
      setError(null);
    } catch (err: any) {
      console.error('初始化合约失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mounted) {
        await initContract();
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [initContract]);

  return {
    contract,
    loading,
    error,
    initContract
  };
} 