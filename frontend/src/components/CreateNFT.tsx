'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { parseEther, formatEther } from 'viem';
import { useAccount, useBalance, useChainId } from 'wagmi';
import {
  useRequestMintNFT,
  useCalculateRequestFee,
  useGreenTraceConstants,
  useIsContractInitialized
} from '@/contracts/hooks/useGreenTrace';
import {
  useGreenTraceAllowance,
  useCarbonTokenInfo
} from '@/contracts/hooks/useCarbonToken';
import {
  uploadFileToIPFS,
  uploadMetadataToIPFS,
  generateNFTMetadata,
  validateFile
} from '@/utils/pinata';


// 注意：使用any类型是因为ethereum对象的类型定义复杂且可能变化
/* eslint-disable @typescript-eslint/no-explicit-any */

// 创建表单数据接口
interface CreateFormData {
  title: string;
  storyDetails: string;
  carbonReduction: string;
  imageFile: File | null;
  imagePreview: string | null;
}

// 初始表单数据
const initialFormData: CreateFormData = {
  title: '',
  storyDetails: '',
  carbonReduction: '',
  imageFile: null,
  imagePreview: null,
};

// NFT创建组件 - 用于创建绿色NFT
export const CreateNFT: React.FC = () => {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });
  const chainId = useChainId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 表单状态管理
  const [formData, setFormData] = useState<CreateFormData>(initialFormData);
  const [carbonAmount, setCarbonAmount] = useState<bigint | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [fee, setFee] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<'idle' | 'uploading' | 'approving' | 'minting'>('idle');
  const [pendingMintData, setPendingMintData] = useState<{
    title: string;
    storyDetails: string;
    carbonAmount: bigint;
    tokenURI: string;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);


  // 合约交互钩子
  const {
    requestMint,
    isPending: mintPending,
    isConfirmed: mintConfirmed,
    error: mintError,
    hash: mintHash
  } = useRequestMintNFT();

  // 监听交易状态变化
  useEffect(() => {
    console.log('requestMint状态变化:', {
      isPending: mintPending,
      isConfirmed: mintConfirmed,
      error: mintError,
      hash: mintHash
    });
  }, [mintPending, mintConfirmed, mintError, mintHash]);

  const {
    allowance,
    balance: tokenBalance,
    isLoadingBalance,
    hasEnoughAllowance,
    hasEnoughBalance,
    approveAmount,
    isPending: approvePending,
    isConfirmed: approveConfirmed,
    error: approveError,
    greenTraceAddress
  } = useGreenTraceAllowance();

  const tokenInfo = useCarbonTokenInfo();
  const { initialized } = useGreenTraceConstants();
  const { data: contractInitialized, isLoading: initCheckLoading } = useIsContractInitialized();

  // 监听授权完成，自动执行创建NFT
  useEffect(() => {
    if (approveConfirmed && currentStep === 'approving' && pendingMintData) {
      console.log('授权完成，开始创建NFT...', {
        approveConfirmed,
        currentStep,
        pendingMintData
      });
      setCurrentStep('minting');
              setUploadProgress('正在提交NFT铸造申请...');

              // 授权完成后自动提交申请
        requestMint(
        pendingMintData.title,
        pendingMintData.storyDetails,
        pendingMintData.carbonAmount,
        pendingMintData.tokenURI
      );
    }
  }, [approveConfirmed, currentStep, pendingMintData, requestMint]);

  // 监听申请完成，显示成功弹窗
  useEffect(() => {
    if (mintConfirmed && currentStep === 'minting' && mintHash) {
      console.log('NFT申请提交完成并确认', {
        mintConfirmed,
        currentStep,
        mintHash
      });
      setCurrentStep('idle');
      setPendingMintData(null);
      setUploadProgress('');
      
      // 显示成功弹窗
      setShowSuccessModal(true);
    }
  }, [mintConfirmed, currentStep, mintHash]);

  // 监听错误，重置状态
  useEffect(() => {
    if ((approveError || mintError) && currentStep !== 'idle') {
      console.error('交易出错，重置状态', {
        approveError,
        mintError,
        currentStep
      });
      
      // 显示错误信息
      const errorMessage = approveError?.message || mintError?.message || '交易失败';
      alert(`交易失败: ${errorMessage}`);
      
      setCurrentStep('idle');
      setPendingMintData(null);
      setUploadProgress('');
    }
  }, [approveError, mintError, currentStep]);

  // 表单验证
  useEffect(() => {
    const { title, storyDetails, carbonReduction, imageFile } = formData;
    const isValid = title.trim() !== '' &&
      storyDetails.trim() !== '' &&
      carbonReduction !== '' &&
      parseFloat(carbonReduction) > 0 &&
      imageFile !== null;
    setIsFormValid(isValid);
  }, [formData]);

  // 使用合约计算申请费用
  const { data: requestFeeData } = useCalculateRequestFee(carbonAmount);

  // 更新碳减排量并计算费用
  useEffect(() => {
    if (formData.carbonReduction && parseFloat(formData.carbonReduction) > 0) {
      try {
        const amount = parseEther(formData.carbonReduction);
        setCarbonAmount(amount);
      } catch (err) {
        console.error('碳减排量格式错误:', err);
        setCarbonAmount(null);
        setFee(0);
      }
    } else {
      setCarbonAmount(null);
      setFee(0);
    }
  }, [formData.carbonReduction]);

  // 更新费用显示
  useEffect(() => {
    if (requestFeeData && typeof requestFeeData === 'bigint') {
      const feeInEther = parseFloat(formatEther(requestFeeData));
      setFee(feeInEther);
      console.log('合约计算的申请费用:', {
        requestFeeData: requestFeeData.toString(),
        feeInEther,
        carbonAmount: carbonAmount?.toString()
      });
    } else {
      setFee(0);
      console.log('费用数据为空，设置为0');
    }
  }, [requestFeeData, carbonAmount]);

  // 处理表单输入
  const handleInputChange = (field: keyof Omit<CreateFormData, 'imageFile' | 'imagePreview'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 处理图片上传
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件
    const validation = validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // 创建预览URL
    const previewUrl = URL.createObjectURL(file);
    setFormData(prev => ({
      ...prev,
      imageFile: file,
      imagePreview: previewUrl
    }));
  };

  // 触发文件选择
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 移除图片
  const removeImage = () => {
    if (formData.imagePreview) {
      URL.revokeObjectURL(formData.imagePreview);
    }
    setFormData(prev => ({
      ...prev,
      imageFile: null,
      imagePreview: null
    }));
  };

  // 重置表单
  const resetForm = () => {
    if (formData.imagePreview) {
      URL.revokeObjectURL(formData.imagePreview);
    }
    setFormData(initialFormData);
    setCarbonAmount(null);
    setCurrentStep('idle');
    setPendingMintData(null);
    setUploadProgress('');
  };

  // 自动生成示例数据
  const fillExampleData = () => {
    setFormData({
      title: '绿色出行记录',
      storyDetails: '今天选择乘坐公共交通工具出行，减少了私家车使用，预计减少碳排放约0.05tCO₂e。这是我为保护环境做出的小小贡献。',
      carbonReduction: '0.05',
      imageFile: null,
      imagePreview: null,
    });
  };

  // 检查是否需要授权
  const needsApproval = () => {
    if (!fee) {
      console.log('needsApproval: fee为0，返回false');
      return false;
    }
    const feeAmount = parseEther(fee.toString());
    const hasAllowance = hasEnoughAllowance(feeAmount);
    
    console.log('needsApproval详细检查:', {
      fee,
      feeAmount: feeAmount.toString(),
      allowance: allowance?.toString() || 'undefined',
      balance: tokenBalance?.toString() || 'undefined',
      greenTraceAddress,
      hasAllowance,
      needsApproval: !hasAllowance
    });
    
    return !hasAllowance;
  };

  // 检查是否有足够余额
  const hasInsufficientBalance = () => {
    if (!fee) return false;
    const feeAmount = parseEther(fee.toString());
    return !hasEnoughBalance(feeAmount);
  };

  // 执行授权
  const executeApprove = (mintData: typeof pendingMintData) => {
    console.log('开始授权流程...');
    setCurrentStep('approving');
    setPendingMintData(mintData);
    const approveAmountValue = parseEther(fee.toString());
    console.log('授权金额:', approveAmountValue.toString());
    approveAmount(approveAmountValue);
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      alert('请先连接钱包');
      return;
    }

    if (!isFormValid) {
      alert('请填写完整的表单信息');
      return;
    }

    if (!carbonAmount) {
      alert('请输入有效的碳减排量');
      return;
    }

    if (!formData.imageFile) {
      alert('请上传图片');
      return;
    }

    try {
      setCurrentStep('uploading');
      setUploadProgress('正在上传图片到IPFS...');

      // 1. 上传图片到IPFS
      const imageUrl = await uploadFileToIPFS(formData.imageFile);
      setUploadProgress('正在生成元数据...');

      // 2. 生成NFT元数据
      const metadata = generateNFTMetadata(
        formData.title,
        formData.storyDetails,
        imageUrl,
        parseFloat(formData.carbonReduction),
        Math.floor(Date.now() / 1000)
      );

      setUploadProgress('正在上传元数据到IPFS...');

      // 3. 上传元数据到IPFS
      const tokenURI = await uploadMetadataToIPFS(metadata);
      console.log('元数据上传完成，tokenURI:', tokenURI);
      setUploadProgress('上传完成，准备创建NFT...');

      const mintData = {
        title: formData.title,
        storyDetails: formData.storyDetails,
        carbonAmount: carbonAmount,
        tokenURI: tokenURI,
      };

      console.log('准备提交NFT申请，mintData:', mintData);

      // 4. 检查是否需要授权
      if (needsApproval()) {
        console.log('需要授权，开始授权流程...');
        executeApprove(mintData);
      } else {
        console.log('无需授权，直接提交申请...');
        // 直接提交申请
        setCurrentStep('minting');
        setUploadProgress('正在提交NFT铸造申请...');
        
        // 添加详细的预检查
        console.log('=== 交易预检查开始 ===');
        console.log('1. 网络状态检查:', {
          isConnected,
          address,
          balance: balance?.formatted,
          chainId: (window as any).ethereum?.chainId
        });
        
                 console.log('2. 合约状态检查:', {
           contractAddress: '0x11e6b5Aeff2FaeFe489776aDa627B2C621ee8673',
           greenTraceAddress,
           tokenBalance: tokenBalance?.toString(),
           allowance: allowance?.toString(),
           initialized: initialized?.toString(),
           contractInitialized: contractInitialized?.toString(),
           initCheckLoading
         });
        
        console.log('3. 交易参数检查:', {
          title: mintData.title,
          storyDetails: mintData.storyDetails,
          carbonAmount: mintData.carbonAmount.toString(),
          tokenURI: mintData.tokenURI,
          feeRequired: fee
        });
        
        // 检查钱包是否真正连接
        if (typeof window !== 'undefined' && (window as any).ethereum) {
          console.log('4. 钱包状态检查:', {
            isMetaMask: (window as any).ethereum.isMetaMask,
            chainId: (window as any).ethereum.chainId,
            selectedAddress: (window as any).ethereum.selectedAddress,
            isConnected: (window as any).ethereum.isConnected?.()
          });
        }
        
        console.log('=== 交易预检查结束 ===');
        
        // 添加合约连接测试
        // 简单的连接状态记录（不阻塞主流程）
        console.log('=== 开始NFT申请流程 ===');
        console.log('钱包连接状态:', isConnected ? '已连接' : '未连接');
        console.log('当前账户:', address || '未知');
        console.log('链ID:', chainId?.toString() || '未知');
        
        console.log('调用requestMint函数，参数:', {
          title: mintData.title,
          storyDetails: mintData.storyDetails,
          carbonAmount: mintData.carbonAmount.toString(),
          tokenURI: mintData.tokenURI
        });
        
        try {
          // 在调用requestMint之前，检查MetaMask是否有待确认的交易
          if ((window as any).ethereum) {
            console.log('检查MetaMask是否有待确认的交易...');
            try {
              // 尝试获取pending的交易数量
              const pendingTxCount = await (window as any).ethereum.request({
                method: 'eth_getTransactionCount',
                params: [address, 'pending']
              });
              const confirmedTxCount = await (window as any).ethereum.request({
                method: 'eth_getTransactionCount',
                params: [address, 'latest']
              });
              console.log('交易计数检查:', {
                pending: pendingTxCount,
                confirmed: confirmedTxCount,
                hasPending: parseInt(pendingTxCount, 16) > parseInt(confirmedTxCount, 16)
              });
            } catch (err) {
              console.warn('无法检查待确认交易:', err);
            }
          }

          requestMint(
            mintData.title,
            mintData.storyDetails,
            mintData.carbonAmount,
            mintData.tokenURI
          );
          
          // 设置一个定时器来提醒用户检查MetaMask
          setTimeout(() => {
            if (currentStep === 'minting') {
              console.log('🔔 提醒：请检查MetaMask扩展是否有待确认的交易');
              // 尝试主动获焦点到MetaMask
              if ((window as any).ethereum) {
                (window as any).ethereum.request({ method: 'eth_requestAccounts' }).catch(() => {});
              }
            }
          }, 3000);
          
        } catch (error) {
          console.error('requestMint调用异常:', error);
          alert(`交易失败: ${error}`);
          setCurrentStep('idle');
          setUploadProgress('');
        }
      }
    } catch (error) {
      console.error('创建NFT失败:', error);
      alert(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setCurrentStep('idle');
      setUploadProgress('');
    }
  };

  // 获取按钮文本
  const getButtonText = () => {
    if (!isConnected) return '请先连接钱包';
    if (!isFormValid) return '请填写完整信息';
    if (hasInsufficientBalance()) return '余额不足';
    if (needsApproval()) return '需要授权碳代币';
    if (currentStep === 'uploading') return '上传中...';
    if (currentStep === 'approving') return '授权中...';
    if (currentStep === 'minting') return '提交申请中...';
    // 如果有交易hash但还在等待确认
    if (mintHash && !mintConfirmed) return '等待区块链确认...';
    return `提交NFT铸造申请 (需支付 ${fee} CARB)`;
  };

  // 获取按钮状态
  const getButtonDisabled = () => {
    return !isConnected || !isFormValid || hasInsufficientBalance() || 
           currentStep === 'uploading' || currentStep === 'approving' || currentStep === 'minting' ||
           (mintHash && !mintConfirmed); // 如果有交易但未确认，也禁用按钮
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">创建绿色NFT</h2>
        
        {/* 状态信息 */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">钱包状态:</span>
              <span className={`ml-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? '已连接' : '未连接'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">ETH余额:</span>
              <span className="ml-2 text-gray-800">
                {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : '加载中...'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">碳代币余额:</span>
              <span className="ml-2 text-gray-800">
                {isLoadingBalance ? '加载中...' : 
                 tokenBalance !== undefined ? `${formatEther(tokenBalance as bigint)} ${tokenInfo.symbol || 'CARB'}` : 
                 '查询失败'}
              </span>
              {!isLoadingBalance && tokenBalance === undefined ? (
                <div className="text-xs text-red-500 mt-1">
                  请检查网络连接或合约地址配置
                </div>
              ) : null}
            </div>
            <div>
              <span className="text-gray-600">预计费用:</span>
              <span className="ml-2 text-gray-800">
                {fee > 0 ? `${fee} CARB` : '计算中...'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">授权状态:</span>
              <span className="ml-2 text-gray-800">
                {fee > 0 ? (needsApproval() ? '需要授权' : '已授权') : '等待费用计算'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">余额足够:</span>
              <span className="ml-2 text-gray-800">
                {fee > 0 ? (hasInsufficientBalance() ? '余额不足' : '余额充足') : '等待费用计算'}
              </span>
            </div>
            {/* 调试信息 */}
            {process.env.NODE_ENV === 'development' && (
              <div className="col-span-2 mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-500 space-y-1">
                  <div>碳减排量: {carbonAmount?.toString() || '未设置'}</div>
                  <div>费用数据: {requestFeeData?.toString() || '未计算'}</div>
                  <div>计算费用: {fee}</div>
                  <div>需要授权: {needsApproval() ? '是' : '否'}</div>
                </div>
              </div>
            )}
          </div>
          
          {/* 调试信息 - 开发环境且查询失败时显示 */}
          {process.env.NODE_ENV === 'development' && !isLoadingBalance && tokenBalance === undefined ? (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 space-y-1">
                <div>钱包地址: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '未连接'}</div>
                <div>代币合约: 0x808b...8198</div>
                <div>余额查询状态: 失败</div>
                <div>代币信息: {tokenInfo.name || '未获取'} ({tokenInfo.symbol || '未获取'})</div>
              </div>
            </div>
          ) : null}
        </div>



        {/* 创建表单 */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* NFT标题 */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              NFT标题 *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="例如：绿色出行记录"
              required
            />
          </div>

          {/* 环保行为详情 */}
          <div>
            <label htmlFor="storyDetails" className="block text-sm font-medium text-gray-700 mb-2">
              环保行为详情 *
            </label>
            <textarea
              id="storyDetails"
              value={formData.storyDetails}
              onChange={(e) => handleInputChange('storyDetails', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="详细描述您的环保行为，包括时间、地点、具体行动等..."
              required
            />
          </div>

          {/* 碳减排量 */}
          <div>
            <label htmlFor="carbonReduction" className="block text-sm font-medium text-gray-700 mb-2">
              碳减排量 (tCO₂e) *
            </label>
            <input
              type="number"
              id="carbonReduction"
              value={formData.carbonReduction}
              onChange={(e) => handleInputChange('carbonReduction', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="例如：0.05"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* 图片上传 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              环保行为图片 *
            </label>
            <div className="space-y-4">
              {/* 图片预览 */}
              {formData.imagePreview && (
                <div className="relative">
                  <img
                    src={formData.imagePreview}
                    alt="预览"
                    className="w-full h-48 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
              
              {/* 上传按钮 */}
              <div
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  formData.imagePreview
                    ? 'border-gray-300 bg-gray-50'
                    : 'border-green-300 bg-green-50 hover:border-green-400 hover:bg-green-100'
                }`}
              >
                <div className="text-4xl mb-2">📸</div>
                <p className="text-sm text-gray-600">
                  {formData.imagePreview ? '点击更换图片' : '点击上传图片'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  支持 JPG, PNG, GIF, WebP 格式，最大 10MB
                </p>
              </div>
              
              {/* 隐藏的文件输入 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={fillExampleData}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              填充示例
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              重置
            </button>
            {/* 调试按钮 - 仅开发环境显示 */}
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={async () => {
                  if (!isConnected) {
                    alert('请先连接钱包');
                    return;
                  }
                  try {
                    console.log('🧪 开始合约连接测试...');
                    
                    // 测试1: 检查网络连接
                    console.log('📡 测试网络连接...');
                    const networkTest = {
                      网络链ID: chainId?.toString(),
                      是否Sepolia: chainId === 11155111,
                      钱包地址: address,
                      ETH余额: balance?.formatted
                    };
                    console.log('✅ 网络测试结果:', networkTest);
                    
                    // 测试2: 检查合约状态
                    console.log('🔗 测试合约状态...');
                    const contractTest = {
                      合约地址: '0x141B2c6Df6AE9863f1cD8FC4624d165209b9c18c',
                      合约初始化: contractInitialized ? '已初始化' : '未初始化或查询中',
                      CARB余额: tokenBalance ? formatEther(tokenBalance as bigint) : '查询中'
                    };
                    console.log('✅ 合约测试结果:', contractTest);
                    
                    // 测试3: 检查网络延迟
                    console.log('⏱️ 测试网络延迟...');
                    const startTime = Date.now();
                    try {
                      // 简单的网络测试 - 访问etherscan
                      await fetch('https://sepolia.etherscan.io/');
                      const latency = Date.now() - startTime;
                      console.log('✅ 网络延迟测试:', `${latency}ms`);
                    } catch (error) {
                      console.log('⚠️ 网络延迟测试失败:', error);
                    }
                    
                    // 生成测试报告
                    const report = `🔍 合约连接测试报告

📊 基本信息:
• 钱包连接: ${isConnected ? '✅ 已连接' : '❌ 未连接'}
• 网络: ${chainId === 11155111 ? '✅ Sepolia测试网' : `⚠️ 当前链ID: ${chainId?.toString() || '未知'}`}
• 地址: ${address}

💰 余额信息:
• ETH余额: ${balance?.formatted || '查询中'} ETH
• CARB余额: ${tokenBalance ? formatEther(tokenBalance as bigint) : '查询中'} CARB

🔗 合约状态:
• 合约地址: 0x141B...18c
• 初始化状态: ${contractInitialized ? '✅ 已初始化' : '⚠️ 未初始化或查询中'}

${isConnected && tokenBalance && contractInitialized ? 
  '🎉 所有检查通过，系统运行正常！' : 
  '⚠️ 发现问题，请检查网络连接和合约状态'
}`;
                    
                    alert(report);
                    console.log('🎯 测试完成');
                    
                  } catch (error) {
                    console.error('🧪 合约连接测试过程中出错:', error);
                    alert(`测试过程中出错: ${error instanceof Error ? error.message : '未知错误'}\n\n这通常是网络问题，不影响正常使用。`);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                🧪 系统检测
              </button>
            )}
          </div>

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={getButtonDisabled()}
            className={`w-full py-3 px-4 rounded-md font-medium text-white transition-colors ${
              getButtonDisabled()
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500'
            }`}
          >
            {getButtonText()}
          </button>
        </form>

        {/* 上传进度 */}
        {uploadProgress && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <span className="text-blue-800">{uploadProgress}</span>
            </div>
          </div>
        )}

        {/* 交易状态 */}
        {(approvePending || mintPending) && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
              <div className="flex-1">
                <div className="text-blue-800">
                  {approvePending ? '正在等待授权确认...' : '正在等待交易确认...'}
                </div>
                <div className="text-blue-600 text-sm mt-1">
                  {mintPending && !mintHash ? (
                    <span>⚠️ 请检查您的钱包，可能有待确认的交易弹窗</span>
                  ) : mintPending && mintHash ? (
                    <span>✅ 交易已提交，等待区块链确认中...</span>
                  ) : (
                    <span>请在钱包中确认交易</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 错误信息 */}
        {(approveError || mintError) && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-red-800">
              <strong>错误:</strong> {approveError?.message || mintError?.message}
            </div>
          </div>
        )}

        {/* 成功弹窗 */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-gradient-to-br from-black/40 via-gray-900/30 to-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 max-w-lg w-full mx-4 overflow-hidden relative">
              {/* 装饰性顶部渐变 */}
              <div className="h-1 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600"></div>
              
              {/* 关闭按钮 */}
              <button
                onClick={() => setShowSuccessModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white/90 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-all duration-200 backdrop-blur-sm shadow-lg"
              >
                <span className="text-lg">×</span>
              </button>

              <div className="p-8">
                <div className="text-center">
                  {/* 成功图标 - 添加动画和渐变 */}
                  <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                    <div className="text-white text-3xl">✅</div>
                  </div>
                  
                  {/* 标题 - 添加渐变文字 */}
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent mb-3">
                    🎉 申请提交成功！
                  </h2>
                  
                  {/* 描述 */}
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    您的NFT申请已成功提交到区块链并进入审核队列
                  </p>
                  
                  {/* 交易信息卡片 */}
                  <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/60 backdrop-blur-sm rounded-xl p-4 mb-6 border border-blue-200/30">
                    <div className="text-sm">
                      <div className="font-semibold text-blue-800 mb-2">📋 交易详情</div>
                      <div className="space-y-1 text-blue-700">
                        <div className="flex justify-between items-center">
                          <span>交易哈希:</span>
                          <span className="font-mono text-xs bg-white/60 px-2 py-1 rounded">
                            {mintHash?.slice(0, 8)}...{mintHash?.slice(-8)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>申请费用:</span>
                          <span className="font-semibold text-green-600">{fee} CARB</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 费用说明卡片 */}
                  <div className="bg-gradient-to-br from-amber-50/80 to-yellow-50/60 backdrop-blur-sm rounded-xl p-5 mb-6 border border-amber-200/30">
                    <h3 className="font-bold text-amber-800 mb-3 flex items-center justify-center">
                      <span className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center mr-2">
                        <span className="text-white text-xs">💰</span>
                      </span>
                      费用说明
                    </h3>
                    <div className="text-amber-700 text-sm space-y-2">
                      <div className="flex items-center justify-between bg-white/50 rounded-lg p-2">
                        <span className="flex items-center">
                          <span className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs mr-2">✓</span>
                          已支付申请费
                        </span>
                        <span className="font-semibold">{fee} CARB</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/50 rounded-lg p-2">
                        <span className="flex items-center">
                          <span className="w-5 h-5 bg-orange-400 text-white rounded-full flex items-center justify-center text-xs mr-2">⏳</span>
                          审核通过后铸造费
                        </span>
                        <span className="font-semibold">约{(fee * 5).toFixed(2)} CARB</span>
                      </div>
                    </div>
                    <div className="text-xs text-amber-600 mt-3 bg-white/40 rounded-lg p-2">
                      💡 铸造费 = 系统费(1%) + 审计费(4%) = 5%碳价值
                    </div>
                  </div>
                  
                  {/* 流程指引卡片 */}
                  <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/60 backdrop-blur-sm rounded-xl p-5 mb-6 border border-blue-200/30">
                    <h3 className="font-bold text-blue-800 mb-3 flex items-center justify-center">
                      <span className="w-6 h-6 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center mr-2">
                        <span className="text-white text-xs">📅</span>
                      </span>
                      接下来的步骤
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start bg-white/50 rounded-lg p-3">
                        <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">✓</span>
                        <div className="text-left">
                          <div className="font-medium text-green-800">申请已提交</div>
                          <div className="text-green-600 text-sm">支付申请费用，进入审核队列</div>
                        </div>
                      </div>
                      <div className="flex items-start bg-white/50 rounded-lg p-3">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">2</span>
                        <div className="text-left">
                          <div className="font-medium text-blue-800">专家审核</div>
                          <div className="text-blue-600 text-sm">24小时内完成环保行为评估</div>
                        </div>
                      </div>
                      <div className="flex items-start bg-white/50 rounded-lg p-3">
                        <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">3</span>
                        <div className="text-left">
                          <div className="font-medium text-purple-800">完成铸造</div>
                          <div className="text-purple-600 text-sm">审核通过后支付铸造费，获得NFT</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 温馨提示 */}
                  <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/60 backdrop-blur-sm rounded-xl p-4 mb-6 border border-green-200/30">
                    <p className="text-green-800 text-sm leading-relaxed">
                      <span className="font-semibold">🌱 温馨提示：</span>
                      您的申请已安全记录在区块链上，请保持钱包连接状态。
                                             审核通过后，您可以在&ldquo;创建记录&rdquo;页面查看进度并完成后续铸造步骤。
                    </p>
                  </div>
                  
                  {/* 按钮组 */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => {
                        setShowSuccessModal(false);
                        // 重置表单
                        setFormData(initialFormData);
                      }}
                      className="flex-1 px-6 py-3 text-gray-700 bg-white/70 backdrop-blur-sm border border-gray-300/50 rounded-xl hover:bg-white/80 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                    >
                      继续申请
                    </button>
                    <button
                      onClick={() => {
                        setShowSuccessModal(false);
                        // 重置表单
                        setFormData(initialFormData);
                        // 跳转到创建记录页面，并触发自动刷新
                        router.push('/created?from=create&refresh=true');
                      }}
                      className="flex-1 px-6 py-3 text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      查看申请状态
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 