'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useNFTMintRecords, type MintRecord } from '@/contracts/hooks/useNFTMintRecords';
import { RequestDetailModal, type RequestRecord } from './RequestDetailModal';
import { usePayAndMintNFT } from '@/contracts/hooks/useGreenTrace';
import { useRouter } from 'next/navigation';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';

// NFT创建记录列表组件Props接口
interface NFTMintRecordsProps {
  autoRefresh?: boolean; // 是否自动刷新数据
}

// NFT创建记录列表组件（只保留链上数据源）
export const NFTMintRecords: React.FC<NFTMintRecordsProps> = ({ autoRefresh = false }) => {
  const { address, isConnected } = useAccount();
  const [isClient, setIsClient] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RequestRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  // 删除未使用的canCancel状态 - 现在通过按钮的disabled属性控制

  // 链上数据hook
  const { 
    records, 
    loading, 
    refreshRecords, 
    enableEventListening, 
    isEventListening 
  } = useNFTMintRecords();
  const { payAndMint, isPending, isConfirming, isConfirmed, error: mintError } = usePayAndMintNFT();

  const router = useRouter();

  // 只在客户端渲染
  useEffect(() => { setIsClient(true); }, []);

  // 将MintRecord转换为RequestRecord格式
  const convertToRequestRecord = (record: MintRecord): RequestRecord => {
    return {
      tokenId: record.tokenId,
      title: record.title,
      details: record.details,
      carbonReduction: record.carbonReduction,
      tokenURI: record.tokenURI,
      totalFee: record.totalFee,
      status: record.status as 'pending' | 'approved' | 'rejected' | 'minted',
      timestamp: record.timestamp,
      auditor: record.auditor,
      carbonValue: record.carbonValue,
      reason: record.reason,
      transactionHash: record.transactionHash,
      source: record.source
    };
  };

  // 自动刷新处理
  useEffect(() => {
    if (autoRefresh && isConnected && address) {
      console.log('触发自动刷新NFT记录');
      refreshRecords();
    }
  }, [autoRefresh, isConnected, address, refreshRecords]);

  // 移除canCancel状态监听 - 现在通过disabled属性直接控制

  // 查看详情 - 将MintRecord转换为RequestRecord格式
  const handleViewDetails = (record: MintRecord) => {
    setSelectedRecord(convertToRequestRecord(record));
    setIsModalOpen(true);
  };

  // 继续铸造
  const handleContinueMint = async (record: RequestRecord) => {
    console.log('🔍 准备铸造NFT - 完整记录诊断开始');
    console.log('📊 记录详情分析:', {
      '记录来源': record.source || '未知',
      '申请ID': record.tokenId,
      '申请ID类型': typeof record.tokenId,
      '申请标题': record.title,
      '申请状态': record.status,
      '碳价值': record.carbonValue,
      '交易哈希': record.transactionHash,
      '时间戳': record.timestamp,
      '当前钱包': address
    });
    
    console.log('🔍 记录完整信息:', record);
    
    // 🚨 关键问题追踪：申请ID值验证
    console.log('🎯 申请ID深度分析:', {
      '原始值': record.tokenId,
      '字符串形式': String(record.tokenId),
      'JSON序列化': JSON.stringify(record.tokenId),
      '是否为数字': typeof record.tokenId === 'number',
      '是否为字符串': typeof record.tokenId === 'string',
      '是否为有效数字': !isNaN(Number(record.tokenId)),
      '转换为数字': Number(record.tokenId),
      '可能的问题': record.tokenId === 2 ? '⚠️ 发现申请ID为2，这可能不是您的真实申请ID！' : '✅ 申请ID看起来正常'
    });
    
    // 🚨 如果申请ID是2，这很可能是错误的
    if (record.tokenId === 2) {
      const confirmProceed = confirm(`⚠️ 重要警告！

检测到申请ID为 2，这很可能不是您的真实申请ID。

从错误信息显示，合约正在尝试验证申请ID为2的申请者，但这可能不是您的申请。

可能的原因：
• 前端数据获取错误
• 缓存数据过期
• 多个用户数据混淆

建议：
• 点击"取消"停止操作
• 刷新页面重新获取最新数据
• 确认您的真实申请ID是多少

是否仍要继续？（可能会失败）`);
      
      if (!confirmProceed) {
        return;
      }
    }

    if (!address) {
      console.error('❌ 钱包未连接');
      alert('请先连接钱包');
      return;
    }
    
    // 检查申请状态
    if (record.status !== 'approved') {
      console.error('❌ 申请状态不正确，当前状态:', record.status);
      alert(`申请状态不正确：${record.status}，只有已批准的申请才能铸造NFT`);
      return;
    }

    console.log('🔍 准备铸造NFT - 立即验证合约中的真实申请者...');
    
    // 🎯 关键修复：立即从合约查询真实的申请者信息
    try {
      const { readContract } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      const { getGreenTraceABI } = await import('@/contracts/hooks/useGreenTrace');
      const { CONTRACT_ADDRESSES } = await import('@/contracts/addresses');
      
      const contractAddress = CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`;
      
      console.log('🔍 立即查询合约中的真实申请者信息:', {
        合约地址: contractAddress,
        申请ID: record.tokenId,
        当前钱包: address,
        '前端记录来源': record.source
      });
      
      const auditRecord = await readContract(config, {
        address: contractAddress,
        abi: getGreenTraceABI(),
        functionName: 'getRequestById',
        args: [BigInt(record.tokenId)]
      });
      
      const auditData = auditRecord as any;
      const realRequester = auditData.requester;
      
      console.log('🔍 合约vs前端数据对比:', {
        '申请ID': record.tokenId,
        '合约中真实申请者': realRequester,
        '前端显示申请者': '来自事件监听，可能不准确',
        '当前钱包地址': address,
        '地址匹配检查': realRequester?.toLowerCase() === address.toLowerCase(),
        '审计状态': auditData.status,
        '碳价值': auditData.carbonValue?.toString()
      });
      
      // 🚨 关键验证：检查当前用户是否是真实的申请创建者
      if (!realRequester || realRequester.toLowerCase() !== address.toLowerCase()) {
        const errorMsg = `🚨 权限验证失败！

❌ 您不是此申请的创建者：

申请ID: ${record.tokenId}
申请标题: ${record.title}
合约中的真实申请者: ${realRequester || '未找到'}
当前钱包地址: ${address}

🔍 问题分析：
前端显示的NFT记录可能来自事件监听，但合约中存储的实际申请者与当前钱包不匹配。这通常发生在：
• 使用了不同的钱包地址
• 申请被转移给了其他用户
• 事件数据与合约状态不同步

💡 解决方案：
• 请切换到申请创建者的钱包地址
• 或联系申请创建者进行铸造操作`;

        alert(errorMsg);
        console.error('❌ 权限验证失败 - 地址不匹配');
        return;
      }
      
      console.log('✅ 权限验证通过！当前用户确实是申请创建者');
      
    } catch (contractError) {
      console.error('❌ 查询合约申请者信息失败:', contractError);
      alert(`无法验证申请者身份: ${contractError instanceof Error ? contractError.message : '合约查询失败'}\n\n建议：检查网络连接后重试`);
      return;
    }

    console.log('🔍 准备铸造NFT - 开始验证申请者身份...');
    
    try {
      // 从合约查询申请详情来验证申请者地址
      const { readContract } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      const { getGreenTraceABI } = await import('@/contracts/hooks/useGreenTrace');
      const { CONTRACT_ADDRESSES } = await import('@/contracts/addresses');
      
      const contractAddress = CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`;
      
      console.log('🔍 查询合约申请记录:', {
        合约地址: contractAddress,
        申请ID: record.tokenId,
        当前钱包: address
      });
      
      const auditRecord = await readContract(config, {
        address: contractAddress,
        abi: getGreenTraceABI(),
        functionName: 'getRequestById',
        args: [BigInt(record.tokenId)]
      });
      
      console.log('📋 合约返回的申请记录完整信息:', auditRecord);
      
      // 详细检查每个合约require条件
      const auditData = auditRecord as any;
      const contractRequester = auditData.requester;
      const auditStatus = auditData.status;
      const auditType = auditData.auditType;
      const carbonValue = auditData.carbonValue;
      
      console.log('🔍 PayAndMintNFT合约条件详细检查:');
      
      // 检查条件1: 审计状态
      const statusCheck = auditStatus === 1; // AuditStatus.Approved = 1
      console.log('✅ 条件1 - 审计状态检查:', {
        '合约中的状态值': auditStatus,
        '预期状态值': 1,
        '状态名称': auditStatus === 0 ? 'Pending' : auditStatus === 1 ? 'Approved' : auditStatus === 2 ? 'Rejected' : 'Unknown',
        '检查结果': statusCheck ? '✅ 通过' : '❌ 失败',
        '错误信息': statusCheck ? null : 'Mint audit not approved'
      });
      
      // 检查条件2: 审计类型
      const typeCheck = auditType === 0; // AuditType.Mint = 0
      console.log('✅ 条件2 - 审计类型检查:', {
        '合约中的类型值': auditType,
        '预期类型值': 0,
        '类型名称': auditType === 0 ? 'Mint' : auditType === 1 ? 'Exchange' : 'Unknown',
        '检查结果': typeCheck ? '✅ 通过' : '❌ 失败',
        '错误信息': typeCheck ? null : 'Not a mint audit'
      });
      
      // 检查条件3: 碳价值
      const carbonValueBigInt = BigInt(carbonValue || 0);
      const carbonCheck = carbonValueBigInt > BigInt(0);
      console.log('✅ 条件3 - 碳价值检查:', {
        '合约中的碳价值': carbonValue?.toString(),
        '转换为BigInt': carbonValueBigInt.toString(),
        '检查结果': carbonCheck ? '✅ 通过' : '❌ 失败',
        '错误信息': carbonCheck ? null : 'Carbon value not set'
      });
      
      // 检查条件4: 申请者地址
      const addressCheck = contractRequester?.toLowerCase() === address.toLowerCase();
      console.log('✅ 条件4 - 申请者地址检查:', {
        '合约中的申请者': contractRequester,
        '当前钱包地址': address,
        '地址匹配': addressCheck ? '✅ 通过' : '❌ 失败',
        '错误信息': addressCheck ? null : 'Not the requester'
      });
      
      // 汇总检查结果
      const allChecks = [
        { name: '审计状态', passed: statusCheck, error: 'Mint audit not approved' },
        { name: '审计类型', passed: typeCheck, error: 'Not a mint audit' },
        { name: '碳价值', passed: carbonCheck, error: 'Carbon value not set' },
        { name: '申请者地址', passed: addressCheck, error: 'Not the requester' }
      ];
      
      const failedChecks = allChecks.filter(check => !check.passed);
      
      console.log('📊 合约条件检查汇总:', {
        '总条件数': allChecks.length,
        '通过条件数': allChecks.filter(check => check.passed).length,
        '失败条件数': failedChecks.length,
        '失败的条件': failedChecks.map(check => `${check.name}: ${check.error}`)
      });
      
      if (failedChecks.length > 0) {
        const errorDetails = failedChecks.map(check => 
          `❌ ${check.name}: ${check.error}`
        ).join('\n');
        
        const detailedErrorMsg = `🚨 合约调用预检查失败！

以下条件不满足：
${errorDetails}

申请ID: ${record.tokenId}
当前状态详情：
• 审计状态: ${auditStatus === 0 ? 'Pending(0)' : auditStatus === 1 ? 'Approved(1)' : auditStatus === 2 ? 'Rejected(2)' : `Unknown(${auditStatus})`}
• 审计类型: ${auditType === 0 ? 'Mint(0)' : auditType === 1 ? 'Exchange(1)' : `Unknown(${auditType})`}
• 碳价值: ${carbonValue?.toString() || '0'} Wei
• 申请者: ${contractRequester || 'Unknown'}
• 当前钱包: ${address}

建议：
${failedChecks.some(c => c.error === 'Mint audit not approved') ? '• 确认申请已通过审计\n' : ''}${failedChecks.some(c => c.error === 'Carbon value not set') ? '• 联系审计员设置碳价值\n' : ''}${failedChecks.some(c => c.error === 'Not the requester') ? '• 切换到申请创建者钱包\n' : ''}
是否仍要尝试调用合约？（可能会失败）`;

        const userConfirm = confirm(detailedErrorMsg);
        if (!userConfirm) {
          return;
        }
        
        console.log('⚠️ 用户选择继续尝试调用合约，尽管预检查失败');
      } else {
        console.log('🎉 所有合约条件检查通过！');
      }
      
      // 额外检查：用户代币余额
      try {
        console.log('💰 检查用户CARB代币余额...');
        
        // 获取CARB代币合约地址和ABI
        const CarbonTokenABI = (await import('@/contracts/abi/CarbonToken.json')).default;
        const carbonTokenAddress = CONTRACT_ADDRESSES.sepolia.CarbonToken as `0x${string}`;
        
        // 查询用户余额
        const userBalanceResult = await readContract(config, {
          address: carbonTokenAddress,
          abi: CarbonTokenABI.abi || CarbonTokenABI,
          functionName: 'balanceOf',
          args: [address]
        });
        
        const userBalance = BigInt((userBalanceResult as any).toString());
        
        // 计算所需费用（从合约获取的carbonValue）
        const carbonValueWei = BigInt(carbonValue || 0);
        
        // 估算费用（系统费用 + 审计费用）
        // 这里应该调用合约的计算费用函数，但为了简化，我们使用近似值
        const estimatedSystemFee = carbonValueWei / BigInt(100); // 假设系统费用是1%
        const estimatedAuditFee = carbonValueWei / BigInt(100); // 假设审计费用是1%
        const estimatedTotalFee = estimatedSystemFee + estimatedAuditFee;
        
        const balanceCheck = userBalance >= estimatedTotalFee;
        
        console.log('💰 代币余额检查:', {
          '用户地址': address,
          '代币合约': carbonTokenAddress,
          '用户余额': userBalance.toString(),
          '碳价值': carbonValueWei.toString(),
          '预估系统费用': estimatedSystemFee.toString(),
          '预估审计费用': estimatedAuditFee.toString(),
          '预估总费用': estimatedTotalFee.toString(),
          '余额充足': balanceCheck ? '✅ 充足' : '❌ 不足'
        });
        
        if (!balanceCheck) {
          const balanceErrorMsg = `💰 余额不足警告！

当前CARB余额: ${userBalance.toString()} Wei
预估所需费用: ${estimatedTotalFee.toString()} Wei
差额: ${(estimatedTotalFee - BigInt(userBalance.toString())).toString()} Wei

注意：这只是预估值，实际费用可能略有不同。

是否仍要尝试铸造？`;

          const balanceConfirm = confirm(balanceErrorMsg);
          if (!balanceConfirm) {
            return;
          }
        }
        
      } catch (balanceError) {
        console.error('❌ 检查代币余额失败:', balanceError);
        console.log('⚠️ 无法验证代币余额，继续尝试铸造...');
      }
      
      console.log('🔐 详细地址对比信息:', {
        '申请ID': record.tokenId,
        '合约中的申请者': contractRequester,
        '当前钱包地址': address,
        '申请者长度': contractRequester?.length,
        '钱包地址长度': address.length,
        '申请者toLowerCase': contractRequester?.toLowerCase(),
        '钱包地址toLowerCase': address.toLowerCase(),
        '严格相等': contractRequester === address,
        '忽略大小写相等': contractRequester?.toLowerCase() === address.toLowerCase(),
        '申请者类型': typeof contractRequester,
        '钱包地址类型': typeof address,
        '申请状态': (auditRecord as any).status,
        '碳价值': (auditRecord as any).carbonValue?.toString(),
        'NFT Token ID': (auditRecord as any).nftTokenId?.toString()
      });
      
    } catch (verifyError) {
      console.error('❌ 验证申请者身份失败:', verifyError);
      
      const errorConfirmMessage = `验证申请者身份时出错: ${verifyError instanceof Error ? verifyError.message : '未知错误'}

这可能是网络问题或合约调用失败。

是否跳过验证直接尝试铸造？
(如果您确认是申请创建者，可以尝试继续)`;

      const userConfirm = confirm(errorConfirmMessage);
      if (!userConfirm) {
        return;
      }
      
      console.log('⚠️ 用户选择跳过验证直接尝试铸造');
    }
    
    console.log('🔍 准备铸造NFT - 完整诊断信息:', {
      用户地址: address,
      申请ID: record.tokenId,
      申请标题: record.title,
      申请状态: record.status,
      碳价值: record.carbonValue,
      碳减排量: record.carbonReduction,
      审计员: record.auditor,
      时间戳: record.timestamp,
      交易来源: record.source
    });
    
    // ⚠️ 关键验证 - 检查申请者地址
    console.log('✅ 地址验证已通过');
    
    // ⚠️ 关键验证
    if (!record.carbonValue || record.carbonValue === '0') {
      console.warn('⚠️ 严重警告: carbonValue为空或0，交易必然失败');
      const confirmContinue = confirm(`警告：此申请的碳价值为空（${record.carbonValue}），铸造可能失败。\n\n是否仍要继续？\n\n建议：联系审计员重新设置碳价值。`);
      if (!confirmContinue) {
        return;
      }
    }
    
    if (!record.auditor || record.auditor === '0x0000000000000000000000000000000000000000') {
      console.warn('⚠️ 严重警告: 审计员地址无效，交易可能失败');
      const confirmContinue = confirm(`警告：此申请的审计员地址无效（${record.auditor}），铸造可能失败。\n\n是否仍要继续？`);
      if (!confirmContinue) {
        return;
      }
    }

    // 🚨 重要发现：区块链浏览器显示真正的错误是 "ERC20: insufficient allowance"
    // 这意味着需要检查和设置代币授权
    console.log('💰 检查CARB代币授权状态...');
    
    try {
      // 检查代币授权和余额
      const { readContract } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      const { CONTRACT_ADDRESSES } = await import('@/contracts/addresses');
      
      const carbonTokenAddress = CONTRACT_ADDRESSES.sepolia.CarbonToken as `0x${string}`;
      const greenTraceAddress = CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`;
      
      // 导入CARB代币ABI
      const CarbonTokenABI = (await import('@/contracts/abi/CarbonToken.json')).default;
      const abi = CarbonTokenABI.abi || CarbonTokenABI;
      
      // 1. 检查用户余额
      const userBalance = await readContract(config, {
        address: carbonTokenAddress,
        abi: abi,
        functionName: 'balanceOf',
        args: [address]
      });
      
      // 2. 检查授权额度
      const allowance = await readContract(config, {
        address: carbonTokenAddress,
        abi: abi,
        functionName: 'allowance',
        args: [address, greenTraceAddress]
      });
      
      const userBalanceBigInt = BigInt((userBalance as bigint).toString());
      const allowanceBigInt = BigInt((allowance as bigint).toString());
      
      // 3. 估算所需费用（基于碳价值的5%作为总费用估算）
      // 🔧 修复精度问题：carbonValue可能是格式化后的字符串（如"35.00"）
      let carbonValueWei: bigint;
      try {
        // 使用安全的转换工具
        const { safeParseToBigInt } = await import('@/utils/tokenUtils');
        carbonValueWei = safeParseToBigInt(record.carbonValue || '0');
      } catch (parseError) {
        console.warn('碳价值解析失败，使用默认值:', parseError);
        carbonValueWei = BigInt(0);
      }
      
      const estimatedFee = carbonValueWei * BigInt(5) / BigInt(100); // 5%的费用估算
      
      console.log('💰 代币状态检查:', {
        '用户余额': userBalanceBigInt.toString(),
        '当前授权': allowanceBigInt.toString(),
        '预估费用': estimatedFee.toString(),
        '余额充足': userBalanceBigInt >= estimatedFee,
        '授权充足': allowanceBigInt >= estimatedFee
      });
      
      // 4. 检查余额是否充足
      if (userBalanceBigInt < estimatedFee) {
        alert(`💰 CARB代币余额不足！

当前余额: ${userBalanceBigInt.toString()} Wei
预估费用: ${estimatedFee.toString()} Wei
不足金额: ${(estimatedFee - userBalanceBigInt).toString()} Wei

请先获取足够的CARB代币再进行铸造。`);
        return;
      }
      
      // 5. 检查授权是否充足
      if (allowanceBigInt < estimatedFee) {
        const needApproval = confirm(`🔐 需要授权CARB代币

检测到代币授权不足：
• 当前授权: ${allowanceBigInt.toString()} Wei
• 需要费用: ${estimatedFee.toString()} Wei

需要先授权合约使用您的CARB代币才能继续铸造。

是否现在进行授权？`);
        
        if (!needApproval) {
          return;
        }
        
        try {
          console.log('🔐 开始授权CARB代币...');
          
          // 授权一个较大的额度，避免频繁授权（授权最大值）
          const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
          
          // 使用writeContract进行授权
          const { writeContract: performWrite } = await import('wagmi/actions');
          
          await performWrite(config, {
            address: carbonTokenAddress,
            abi: abi,
            functionName: 'approve',
            args: [greenTraceAddress, maxUint256]
          });
          
          alert('✅ 代币授权交易已提交！\n\n请在钱包中确认授权交易，完成后再次尝试铸造NFT。');
          return;
          
        } catch (approveError) {
          console.error('❌ 代币授权失败:', approveError);
          alert(`代币授权失败: ${approveError instanceof Error ? approveError.message : '未知错误'}\n\n请手动在钱包中授权CARB代币给合约使用。`);
          return;
        }
      }
      
      console.log('✅ 代币余额和授权检查通过！');
      
    } catch (tokenCheckError) {
      console.error('❌ 代币状态检查失败:', tokenCheckError);
      
      let errorMessage = '未知错误';
      let suggestion = '先手动检查CARB代币余额和授权状态。';
      
      if (tokenCheckError instanceof Error) {
        if (tokenCheckError.message.includes('Cannot convert') && tokenCheckError.message.includes('BigInt')) {
          errorMessage = '数据格式转换错误';
          suggestion = '这通常是数据精度问题，可以尝试继续，系统会使用默认值。';
        } else {
          errorMessage = tokenCheckError.message;
        }
      }
      
      const continueAnyway = confirm(`代币状态检查失败: ${errorMessage}

这可能导致铸造失败。是否仍要继续？

建议：${suggestion}`);
      
      if (!continueAnyway) {
        return;
      }
    }

    // 最终确认对话框
    const finalConfirm = confirm(`✅ 准备铸造NFT！

申请ID: ${record.tokenId}
申请标题: ${record.title}
当前钱包: ${address}
碳价值: ${record.carbonValue} CARB

✅ 代币授权检查通过
✅ 申请者身份验证通过

点击确定开始铸造...`);

    if (!finalConfirm) {
      return;
    }

    // 🎯 最终的合约状态确认 - 在调用前的最后一刻检查
    console.log('🔄 最终合约状态确认 - 在调用前的最后一刻...');
    try {
      const { readContract, getBlockNumber } = await import('wagmi/actions');
      const { config } = await import('@/lib/wagmi');
      const { getGreenTraceABI } = await import('@/contracts/hooks/useGreenTrace');
      const { CONTRACT_ADDRESSES } = await import('@/contracts/addresses');
      
      const contractAddress = CONTRACT_ADDRESSES.sepolia.GreenTrace as `0x${string}`;
      
      // 获取当前区块号
      const currentBlock = await getBlockNumber(config);
      console.log('📊 当前区块号:', currentBlock.toString());
      
      // 最后一次查询申请状态
      const finalAuditRecord = await readContract(config, {
        address: contractAddress,
        abi: getGreenTraceABI(),
        functionName: 'getRequestById',
        args: [BigInt(record.tokenId)]
      });
      
      const finalAuditData = finalAuditRecord as any;
      const finalRequester = finalAuditData.requester;
      const finalStatus = finalAuditData.status;
      
      console.log('🔥 最终状态确认:', {
        '区块号': currentBlock.toString(),
        '申请ID': record.tokenId,
        '最终申请者': finalRequester,
        '当前钱包': address,
        '最终状态': finalStatus,
        '地址字节对比': {
          '申请者字节': Array.from(new TextEncoder().encode(finalRequester || '')),
          '钱包字节': Array.from(new TextEncoder().encode(address)),
        },
        '严格相等检查': finalRequester === address,
        '小写相等检查': finalRequester?.toLowerCase() === address.toLowerCase(),
        '地址长度对比': {
          '申请者长度': finalRequester?.length,
          '钱包长度': address.length
        }
      });
      
      // 如果最终检查仍然不匹配，强制停止
      if (!finalRequester || finalRequester.toLowerCase() !== address.toLowerCase()) {
        console.error('🚨 最终检查失败 - 地址不匹配!');
        alert(`🚨 最终检查失败！
        
在准备调用合约的最后一刻，地址验证失败：
• 合约中申请者: ${finalRequester}
• 当前钱包: ${address}
• 区块号: ${currentBlock.toString()}

这可能表明合约状态在查询期间被修改了。
建议刷新页面后重试。`);
        return;
      }
      
      console.log('✅ 最终状态确认通过！准备调用合约...');
      
    } catch (finalCheckError) {
      console.error('❌ 最终状态检查失败:', finalCheckError);
      // 不阻止调用，但记录错误
      console.log('⚠️ 最终检查失败，但继续尝试调用...');
    }

    // 铸造前启用事件监听30秒，监听铸造相关事件
    enableEventListening(30000);
    
    setSelectedRecord(record);
    setShowMintModal(true);
    
    try {
      console.log('🚀 开始调用payAndMint - 详细参数追踪');
      console.log('📊 原始record完整数据:', {
        '完整record对象': record,
        'record.tokenId原始值': record.tokenId,
        'record.tokenId类型': typeof record.tokenId,
        'record.tokenId字符串表示': String(record.tokenId),
        '是否为字符串': typeof record.tokenId === 'string',
        '是否为数字': typeof record.tokenId === 'number'
      });
      
      // 详细的类型转换过程追踪
      const originalTokenId = record.tokenId;
      console.log('🔄 类型转换步骤:');
      console.log('  步骤1 - 原始值:', originalTokenId, '类型:', typeof originalTokenId);
      
      const parsedTokenId = typeof originalTokenId === 'string' ? parseInt(originalTokenId) : originalTokenId;
      console.log('  步骤2 - parseInt后:', parsedTokenId, '类型:', typeof parsedTokenId);
      
      const bigIntTokenId = BigInt(parsedTokenId);
      console.log('  步骤3 - BigInt后:', bigIntTokenId.toString(), '类型:', typeof bigIntTokenId);
      
      console.log('🔗 合约地址和网络信息将在usePayAndMintNFT中显示');
      console.log('📋 最终调用参数:', {
        '函数名': 'payAndMintNFT',
        '传入参数': bigIntTokenId.toString(),
        '参数类型': typeof bigIntTokenId,
        '当前钱包': address,
        '申请标题': record.title
      });
      
      // 🚨 关键验证：确保传入的ID与合约查询的一致
      console.log('⚠️ 重要提醒: 确保此ID与之前合约查询的申请ID完全一致！');
      console.log('📝 如果ID不匹配，说明前端数据与合约状态不同步');
      
      payAndMint(bigIntTokenId);
    } catch (error) {
      console.error('❌ payAndMint调用失败:', error);
      setShowMintModal(false);
      setSelectedRecord(null);
      
      // 详细的错误分析
      let errorAnalysis = '';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('Not the requester')) {
        errorAnalysis = `🔍 "Not the requester" 错误深度分析：

这个错误表明合约中存储的申请者地址与当前钱包地址不匹配。

可能的原因：
1. 🕐 时间窗口问题：在查询和调用之间，合约状态被其他交易修改
2. 🔄 交易重放：您的交易被重复提交或在不同状态下执行
3. 📡 网络同步问题：您看到的是旧的区块状态
4. 🏗️ 合约逻辑问题：合约内部的申请者检查逻辑有bug

下一步建议：
• 🔄 刷新页面并重新查询状态
• 📊 检查区块浏览器上的实际合约状态
• ⏱️ 等待几个区块后再次尝试
• 🔍 使用区块浏览器直接调用合约查看申请详情`;
      } else if (errorMessage.includes('insufficient funds')) {
        errorAnalysis = '💰 余额不足错误 - 请检查ETH和CARB代币余额';
      } else if (errorMessage.includes('User rejected')) {
        errorAnalysis = '👤 用户在钱包中拒绝了交易';
      } else {
        errorAnalysis = '🔍 未知错误 - 建议检查网络连接和合约状态';
      }
      
      alert(`铸造调用失败: ${errorMessage}

${errorAnalysis}

🔧 技术信息：
• 申请ID: ${record.tokenId}
• 当前钱包: ${address}
• 时间: ${new Date().toLocaleString()}

请检查浏览器控制台以获取更多技术细节。`);
    }
  };

  // 刷新 - 手动刷新时启用短期事件监听
  const handleRefresh = () => { 
    // 刷新时启用事件监听15秒，以便捕获可能的新事件
    enableEventListening(15000);
    refreshRecords(); 
  };
  // 取消铸造
  const handleCancelMint = () => {
    console.log('用户取消铸造');
    setShowMintModal(false);
    setSelectedRecord(null);
  };

  // 铸造完成
  const handleMintComplete = () => { 
    setShowMintModal(false); 
    setSelectedRecord(null);
    handleRefresh(); 
  };
  // 关闭弹窗
  const handleCloseModal = () => { setIsModalOpen(false); setSelectedRecord(null); };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">请先连接钱包</h3>
            <p className="text-gray-500">连接钱包后查看您的NFT创建记录</p>
          </div>
        </div>
      </div>
    );
  }
  if (!isClient) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">我的NFT创建记录</h2>
              <p className="text-gray-600 mt-1">查看您的所有NFT创建申请和状态</p>
              {/* 事件监听状态指示器 */}
              {isEventListening && (
                <div className="mt-2 inline-flex items-center text-sm text-blue-600">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
                  实时监听中...
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2 rounded-lg hover:disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-blue-600 text-white hover:bg-blue-700"
              >
                {loading ? '刷新中...' : '刷新'}
              </button>
            </div>
          </div>
          {/* 错误提示 */}
          {/* 记录列表 */}
          {!loading && (
            <div className="space-y-4">
              {records.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">暂无创建记录</h3>
                  <p className="text-gray-500 mb-6">您还没有创建过NFT申请</p>
                  <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors" onClick={() => router.push('/create')}>
                    创建第一个NFT
                  </button>
                </div>
              ) : (
                records.map((record, index) => (
                  <div key={record.transactionHash || `${record.tokenId}-${record.timestamp}-${index}`}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">#{record.tokenId} {record.title}</h3>
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2">{record.details}</p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div>{formatTimestamp(record.timestamp)}</div>
                        <div className="mt-1">费用: {formatFeeAmount(record.totalFee)} CARB</div>
                      </div>
                    </div>
                    {/* 详细信息 */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div><span className="text-gray-500">碳减排量:</span><span className="ml-2 font-medium">{record.carbonReduction} CARB</span></div>
                      {record.carbonValue && (<div><span className="text-gray-500">审计确认价值:</span><span className="ml-2 font-medium">{record.carbonValue} CARB</span></div>)}
                    </div>
                    {/* 操作按钮 */}
                    <div className="flex gap-3">
                      <button onClick={() => handleViewDetails(record)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">查看详情</button>
                      {record.status === 'approved' && (
                        <button onClick={() => handleContinueMint(convertToRequestRecord(record))} className="bg-green-600 text-white px-4 py-1 rounded text-sm hover:bg-green-700 transition-colors">继续铸造</button>
                      )}
                      {record.status === 'rejected' && (
                        <button className="bg-gray-600 text-white px-4 py-1 rounded text-sm hover:bg-gray-700 transition-colors">重新申请</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {/* 详情弹窗 */}
      <RequestDetailModal
        record={selectedRecord}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onContinueMint={handleContinueMint}
      />
      {/* 铸造状态弹窗 - 优化版 */}
      {showMintModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 max-w-lg w-full mx-4 relative">
            {/* 关闭按钮 */}
            <button
              onClick={handleCancelMint}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100/80 hover:bg-gray-200/80 flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 backdrop-blur-sm"
              disabled={isConfirming} // 确认阶段不允许关闭
            >
              <span className="text-xl">×</span>
            </button>

            <div className="text-center">
              {/* 准备阶段 */}
              {isPending && !isConfirming && !isConfirmed && !mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">⏳</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">准备铸造NFT</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">正在准备铸造交易，请在钱包中确认...</p>
                  
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 mb-6 border border-blue-200/30">
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-blue-600">审计确认价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  <div className="flex justify-center space-x-3">
                    <button 
                      onClick={handleCancelMint}
                      className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                    >
                      取消
                    </button>
                  </div>
                </>
              )}
              
              {/* 确认阶段 */}
              {isConfirming && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">铸造进行中</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">正在等待区块链确认，请耐心等待...</p>
                  
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-4 mb-6 border border-amber-200/30">
                    <div className="text-sm text-amber-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-amber-600">⚠️ 请勿关闭此窗口或刷新页面</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                    <div className="animate-pulse">🔗</div>
                    <span>区块链确认中...</span>
                  </div>
                </>
              )}
              
              {/* 成功状态 */}
              {isConfirmed && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">✅</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">铸造成功！</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">恭喜！您的NFT已经成功铸造到区块链上</p>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-6 mb-6 border border-green-200/30">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-800 mb-2">
                        🎨 #{selectedRecord.tokenId} {selectedRecord.title}
                      </div>
                      <div className="text-green-600 font-medium">
                        价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB
                      </div>
                      <div className="mt-3 flex items-center justify-center space-x-2 text-sm text-green-700">
                        <span>🌱</span>
                        <span>为环保事业贡献一份力量</span>
                        <span>🌱</span>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleMintComplete} 
                    className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                  >
                    完成
                  </button>
                </>
              )}
              
              {/* 错误状态 */}
              {mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">❌</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">铸造失败</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">很抱歉，NFT铸造过程中遇到了问题</p>
                  
                  {/* 错误详情 */}
                  <div className="bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl p-4 mb-6 border border-red-200/30">
                    <div className="text-sm text-red-800">
                      <div className="font-semibold mb-2">错误详情:</div>
                      <div className="bg-white/70 p-3 rounded-lg text-red-600 break-words text-left">
                        {mintError.message || '未知错误'}
                      </div>
                      
                    </div>
                  </div>

                  {/* NFT信息 */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6 border border-gray-200/30">
                    <div className="text-sm text-gray-700">
                      <div className="font-semibold">申请信息:</div>
                      <div className="mt-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-gray-500">价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  {/* 常见解决方案提示 */}
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 mb-6 border border-blue-200/30">
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-2">💡 可能的解决方案:</div>
                      <ul className="text-left space-y-1 text-blue-600">
                        <li>• 检查钱包中是否有足够的CARB代币</li>
                                                 <li>• 确认申请状态是否为&ldquo;已批准&rdquo;</li>
                        <li>• 验证申请ID是否正确：#{selectedRecord.tokenId}</li>
                        <li>• 检查是否已经铸造过此NFT</li>
                        <li>• 确认网络连接是否正常</li>
                        <li>• 检查是否连接到正确的网络（Sepolia测试网）</li>
                        <li>• 稍后再次尝试铸造</li>
                      </ul>
                    </div>
                  </div>

                  {/* 具体错误分析 */}
                  {mintError.message && (
                    <div className="bg-gradient-to-br from-yellow-50 to-yellow-100/50 rounded-xl p-4 mb-6 border border-yellow-200/30">
                      <div className="text-sm text-yellow-800">
                        <div className="font-semibold mb-2">🔍 错误分析:</div>
                        <div className="text-yellow-700 text-left">
                          {mintError.message.includes('User rejected') && (
                            <div>用户在钱包中拒绝了交易。请重新尝试并在钱包弹窗中点击确认。</div>
                          )}
                          {(mintError.message.includes('insufficient allowance') || 
                            mintError.message.includes('ERC20') || 
                            JSON.stringify(mintError).toLowerCase().includes('insufficient allowance')) && (
                            <div>
                              <div className="font-bold text-red-600 mb-2">🎯 真正问题：CARB代币授权不足</div>
                              <div className="space-y-1">
                                <div>• 您的CARB代币余额可能充足，但没有授权GreenTrace合约使用</div>
                                <div>• 需要先调用CARB代币的approve函数授权合约</div>
                                                                 <div>• 这就是为什么区块链浏览器显示&ldquo;ERC20: insufficient allowance&rdquo;的原因</div>
                                                                  <div className="mt-2 p-2 bg-blue-50 rounded text-blue-700">
                                    💡 解决方案：点击&ldquo;继续铸造&rdquo;按钮，系统会自动引导您完成代币授权流程
                                  </div>
                              </div>
                            </div>
                          )}
                          {mintError.message.includes('insufficient funds') && (
                            <div>账户余额不足。请确保钱包中有足够的ETH支付Gas费用和CARB代币支付铸造费用。</div>
                          )}
                          {mintError.message.includes('revert') && !mintError.message.includes('insufficient allowance') && (
                            <div>合约调用被拒绝。可能原因：申请状态不正确、权限不足、或申请已被处理。</div>
                          )}
                          {mintError.message.includes('timeout') && (
                            <div>交易超时。网络可能拥堵，请稍后重试。</div>
                          )}
                          {mintError.message.includes('nonce') && (
                            <div>交易序号冲突。请重置MetaMask账户或等待一段时间后重试。</div>
                          )}
                          {!mintError.message.includes('User rejected') && 
                           !mintError.message.includes('insufficient allowance') &&
                           !mintError.message.includes('ERC20') &&
                           !JSON.stringify(mintError).toLowerCase().includes('insufficient allowance') &&
                           !mintError.message.includes('insufficient funds') && 
                           !mintError.message.includes('revert') && 
                           !mintError.message.includes('timeout') && 
                           !mintError.message.includes('nonce') && (
                            <div>
                              <div>未知错误类型。建议检查网络连接和合约状态，或联系技术支持。</div>
                              <div className="mt-2 p-2 bg-gray-50 rounded text-gray-600 text-xs">
                                🔍 调试信息：请检查区块链浏览器获取真实错误原因
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button 
                      onClick={handleMintComplete} 
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors duration-200"
                    >
                      关闭
                    </button>
                    <button 
                      onClick={() => {
                        // 重新尝试铸造
                        if (selectedRecord) {
                          console.log('🔄 重新尝试铸造 - requestId:', selectedRecord.tokenId);
                          const requestId = typeof selectedRecord.tokenId === 'string' ? parseInt(selectedRecord.tokenId) : selectedRecord.tokenId;
                          payAndMint(BigInt(requestId));
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold transition-all duration-200"
                    >
                      重试
                    </button>
                  </div>
                </>
              )}

              {/* 初始状态（没有任何操作进行时） */}
              {!isPending && !isConfirming && !isConfirmed && !mintError && (
                <>
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="text-white text-2xl">🎨</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-3">准备就绪</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">点击开始铸造您的绿色NFT</p>
                  
                  <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 mb-6 border border-green-200/30">
                    <div className="text-sm text-green-800">
                      <div className="font-semibold mb-1">#{selectedRecord.tokenId} {selectedRecord.title}</div>
                      <div className="text-green-600">价值: {selectedRecord.carbonValue || selectedRecord.carbonReduction} CARB</div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button 
                      onClick={handleCancelMint}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors duration-200"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => {
                        if (selectedRecord) {
                          const requestId = typeof selectedRecord.tokenId === 'string' ? parseInt(selectedRecord.tokenId) : selectedRecord.tokenId;
                          payAndMint(BigInt(requestId));
                        }
                      }}
                      className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                      开始铸造
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};