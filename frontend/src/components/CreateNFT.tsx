import React, { useState, useEffect } from 'react';
import { parseEther, formatEther } from 'viem';
import { useAccount, useBalance } from 'wagmi';
import {
  useRequestMintNFT,
  useGreenTraceConstants,
  useCalculateRequestFee
} from '@/src/contracts/hooks/useGreenTrace';
import {
  useGreenTraceAllowance,
  useCarbonTokenInfo
} from '@/src/contracts/hooks/useCarbonToken';

interface CreateFormData {
  title: string;
  storyDetails: string;
  carbonReduction: string;
  tokenURI: string;
}

const initialFormData: CreateFormData = {
  title: '',
  storyDetails: '',
  carbonReduction: '',
  tokenURI: '',
};

export const CreateNFT: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  const [formData, setFormData] = useState<CreateFormData>(initialFormData);
  const [carbonAmount, setCarbonAmount] = useState<bigint | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);
  const [fee, setFee] = useState<any>(0);
  const [currentStep, setCurrentStep] = useState<'idle' | 'approving' | 'minting'>('idle');
  const [pendingMintData, setPendingMintData] = useState<{
    title: string;
    storyDetails: string;
    carbonAmount: bigint;
    tokenURI: string;
  } | null>(null);

  const constants = useGreenTraceConstants();

  const {
    requestMint,
    isPending: mintPending,
    isConfirming: mintConfirming,
    isConfirmed: mintConfirmed,
    error: mintError,
    hash: mintHash
  } = useRequestMintNFT();

  const { isLoading: feeLoading } = useCalculateRequestFee(carbonAmount);
  const initfee = 1;
  const initPercent = 1;
  const {
    allowance,
    balance: tokenBalance,
    isLoadingAllowance,
    isLoadingBalance,
    hasEnoughAllowance,
    hasEnoughBalance,
    approveMax,
    approveAmount,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isConfirmed: approveConfirmed,
    error: approveError,
    hash: approveHash,
    greenTraceAddress,
  } = useGreenTraceAllowance();

  const tokenInfo = useCarbonTokenInfo();
  useEffect(() => {
    console.log(allowance, "312312");
  }, [allowance])
  // 监听授权完成，自动执行创建NFT
  useEffect(() => {
    if (approveConfirmed && currentStep === 'approving' && pendingMintData) {
      console.log('授权完成，开始创建NFT...');
      setCurrentStep('minting');

      // 授权完成后自动创建NFT
      requestMint(
        pendingMintData.title,
        pendingMintData.storyDetails,
        pendingMintData.carbonAmount,
        pendingMintData.tokenURI
      );
    }
  }, [approveConfirmed, currentStep, pendingMintData, requestMint]);

  // 监听创建完成，重置状态
  useEffect(() => {
    if (mintConfirmed && currentStep === 'minting') {
      console.log('NFT创建完成');
      setCurrentStep('idle');
      setPendingMintData(null);
    }
  }, [mintConfirmed, currentStep]);

  // 监听错误，重置状态
  useEffect(() => {
    if ((approveError || mintError) && currentStep !== 'idle') {
      console.log('交易出错，重置状态');
      setCurrentStep('idle');
      setPendingMintData(null);
    }
  }, [approveError, mintError, currentStep]);

  // 表单验证
  useEffect(() => {
    const { title, storyDetails, carbonReduction, tokenURI } = formData;
    const isValid = title.trim() !== '' &&
      storyDetails.trim() !== '' &&
      carbonReduction !== '' &&
      parseFloat(carbonReduction) > 0 &&
      tokenURI.trim() !== '';
    setIsFormValid(isValid);
  }, [formData]);

  // 更新碳减排量
  useEffect(() => {
    if (formData.carbonReduction && parseFloat(formData.carbonReduction) > 0) {
      try {
        const amount = parseEther(formData.carbonReduction);
        setCarbonAmount(amount);
      } catch (err) {
        console.error('碳减排量格式错误:', err);
        setCarbonAmount(null);
      }
    } else {
      setCarbonAmount(null);
    }
  }, [formData.carbonReduction]);

  // 处理表单输入
  const handleInputChange = (field: keyof CreateFormData, value: string) => {
    if (field === 'carbonReduction') {
      const calucFee = Number(value) * (initPercent / 100);
      setFee(calucFee > initfee ? calucFee : initfee);
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

  };

  // 重置表单
  const resetForm = () => {
    setFormData(initialFormData);
    setCarbonAmount(null);
    setCurrentStep('idle');
    setPendingMintData(null);
  };

  // 自动生成示例数据
  const fillExampleData = () => {
    setFormData({
      title: '绿色出行记录',
      storyDetails: '今天选择乘坐公共交通工具出行，减少了私家车使用，预计减少碳排放约50kg。这是我为保护环境做出的小小贡献。',
      carbonReduction: '50',
      tokenURI: 'https://example.com/metadata/green-transport.json',
    });
  };

  // 检查是否需要授权
  const needsApproval = () => {
    if (!fee) return false;
    return true;
  };

  // 检查是否有足够余额
  const hasInsufficientBalance = () => {
    if (!fee || typeof fee !== 'bigint') return false;
    return !hasEnoughBalance(fee);
  };

  // 执行授权
  const executeApprove = (mintData: typeof pendingMintData) => {
    console.log('开始授权流程...');
    setCurrentStep('approving');
    setPendingMintData(mintData);
    const approveAmountValue = parseEther(fee.toString());
    console.log(approveAmountValue, "approveAmountValue")
    approveAmount(approveAmountValue);
  };

  // 处理表单提交（主要逻辑）
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      alert('请先连接钱包');
      return;
    }

    if (!isFormValid) {
      alert('请填写完整信息');
      return;
    }

    if (!carbonAmount) {
      alert('请输入有效的碳减排量');
      return;
    }

    if (hasInsufficientBalance()) {
      alert('CarbonToken余额不足，无法支付手续费');
      return;
    }

    const mintData = {
      title: formData.title,
      storyDetails: formData.storyDetails,
      carbonAmount,
      tokenURI: formData.tokenURI,
    };
    requestMint(
      mintData.title,
      mintData.storyDetails,
      mintData.carbonAmount,
      mintData.tokenURI
    );
    // 检查是否需要授权
    // 暂时注释
    // if (needsApproval()) {
    //   console.log('需要授权，开始授权流程');
    //   executeApprove(mintData);
    // } else {
    //   setCurrentStep('minting');
    //   requestMint(
    //     mintData.title,
    //     mintData.storyDetails,
    //     mintData.carbonAmount,
    //     mintData.tokenURI
    //   );
    // }
  };

  // 获取当前操作状态文本
  const getButtonText = () => {
    if (currentStep === 'approving') {
      return approvePending ? '授权中...' : approveConfirming ? '授权确认中...' : '授权中...';
    }
    if (currentStep === 'minting') {
      return mintPending ? '创建中...' : mintConfirming ? '创建确认中...' : '创建中...';
    }
    if (needsApproval() && !hasInsufficientBalance()) {
      return '授权并创建NFT';
    }
    return '创建NFT';
  };

  // 检查是否正在处理中
  const isProcessing = currentStep !== 'idle' || approvePending || approveConfirming || mintPending || mintConfirming;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
      {/* 连接状态提示 */}
      {!isConnected && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-center">
            请先连接钱包以创建NFT
          </p>
        </div>
      )}

      {/* 成功提示 */}
      {mintConfirmed && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-green-800 font-semibold mb-2">🎉 创建成功！</h3>
          <p className="text-green-700 text-sm">
            您的绿色NFT创建请求已提交，等待审计员审核。
          </p>
          {mintHash && (
            <p className="text-green-600 text-xs mt-2 break-all">
              交易哈希: {mintHash}
            </p>
          )}
          <button
            onClick={resetForm}
            className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            创建新的NFT
          </button>
        </div>
      )}

      {/* 授权成功提示 */}
      {approveConfirmed && !mintConfirmed && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-green-800 font-semibold mb-2">✅ 授权成功！</h3>
          <p className="text-green-700 text-sm">
            CarbonToken授权成功，现在可以创建NFT了。
          </p>
          {approveHash && (
            <p className="text-green-600 text-xs mt-2 break-all">
              授权交易哈希: {approveHash}
            </p>
          )}
        </div>
      )}

      {/* 授权错误提示 */}
      {approveError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">
            ❌ 授权失败: {approveError instanceof Error ? approveError.message : '未知错误'}
          </p>
        </div>
      )}

      {/* 铸造错误提示 */}
      {mintError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">
            ❌ 创建失败: {mintError instanceof Error ? mintError.message : '未知错误'}
          </p>
        </div>
      )}

      {/* 主表单 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 标题输入 */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            NFT标题 *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            placeholder="为您的绿色行为起个名字"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isProcessing}
          />
        </div>

        {/* 故事详情 */}
        <div>
          <label htmlFor="storyDetails" className="block text-sm font-medium text-gray-700 mb-2">
            绿色故事详情 *
          </label>
          <textarea
            id="storyDetails"
            value={formData.storyDetails}
            onChange={(e) => handleInputChange('storyDetails', e.target.value)}
            placeholder="详细描述您的绿色行为和环保贡献..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isProcessing}
          />
        </div>

        {/* 碳减排量 */}
        <div>
          <label htmlFor="carbonReduction" className="block text-sm font-medium text-gray-700 mb-2">
            预计碳减排量 (kg) *
          </label>
          <input
            type="number"
            id="carbonReduction"
            value={formData.carbonReduction}
            onChange={(e) => handleInputChange('carbonReduction', e.target.value)}
            placeholder="例如: 50"
            min="0"
            step="0.1"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isProcessing}
          />
        </div>

        {/* 元数据URI */}
        <div>
          <label htmlFor="tokenURI" className="block text-sm font-medium text-gray-700 mb-2">
            NFT元数据URI *
          </label>
          <input
            type="url"
            id="tokenURI"
            value={formData.tokenURI}
            onChange={(e) => handleInputChange('tokenURI', e.target.value)}
            placeholder="https://example.com/metadata/your-nft.json"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isProcessing}
          />
        </div>

        {/* CarbonToken信息 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-blue-800 font-semibold mb-2">💰 CarbonToken信息</h3>

          {/* 代币余额 */}
          <div className="mb-3">
            <p className="text-blue-700">
              代币余额: {
                isLoadingBalance ? '加载中...' :
                  tokenBalance && typeof tokenBalance === 'bigint' ?
                    `${formatEther(tokenBalance)} ${String(tokenInfo.symbol) || 'CARBON'}` : '0'
              }
            </p>
          </div>

          {/* 当前授权额度 */}
          <div className="mb-3">
            <p className="text-blue-700">
              已授权额度: {
                isLoadingAllowance ? '加载中...' :
                  allowance && typeof allowance === 'bigint' ?
                    `${formatEther(allowance)} ${String(tokenInfo.symbol) || 'CARBON'}` : '0'
              }
            </p>
            <p className="text-blue-600 text-xs">
              授权给: {greenTraceAddress ? `${greenTraceAddress.slice(0, 6)}...${greenTraceAddress.slice(-4)}` : '未知'}
            </p>
          </div>

          {/* 费用预估 */}
          {fee && typeof fee === 'bigint' && (
            <div className="mb-3">
              <p className="text-blue-700">
                预估手续费: {formatEther(fee)} {String(tokenInfo.symbol) || 'CARBON'}
              </p>
            </div>
          )}

          {/* ETH余额 */}
          {balance && (
            <p className="text-blue-600 text-sm">
              ETH余额: {formatEther(balance.value)} ETH
            </p>
          )}
        </div>

        {/* 状态提示 */}
        {fee && typeof fee === 'bigint' && (
          <div className="space-y-3">
            {/* 余额不足警告 */}
            {hasInsufficientBalance() && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">
                  ⚠️ CarbonToken余额不足，无法支付手续费
                </p>
              </div>
            )}

            {/* 当前流程状态 */}
            {currentStep === 'approving' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  🔄 正在授权CarbonToken使用权限...
                </p>
              </div>
            )}

            {currentStep === 'minting' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  🔄 正在创建NFT...
                </p>
              </div>
            )}

            {/* 需要授权提示 */}
            {needsApproval() && !hasInsufficientBalance() && currentStep === 'idle' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm">
                  ℹ️ 首次使用需要授权CarbonToken，点击下方按钮将自动授权并创建NFT
                </p>
              </div>
            )}

            {/* 授权充足提示 */}
            {!needsApproval() && !hasInsufficientBalance() && currentStep === 'idle' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">
                  ✅ 授权充足，可以直接创建NFT
                </p>
              </div>
            )}
          </div>
        )}

        {/* 合约信息 */}
        {constants.initialized && (
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm">
            <h3 className="font-semibold text-gray-700 mb-2">📋 合约信息</h3>
            <div className="grid grid-cols-2 gap-2 text-gray-600">
              <div>系统费率: {constants.systemFeeRate ? `${Number(constants.systemFeeRate) / 100}%` : '加载中...'}</div>
              <div>审计费率: {constants.auditFeeRate ? `${Number(constants.auditFeeRate) / 100}%` : '加载中...'}</div>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={fillExampleData}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            disabled={isProcessing}
          >
            填入示例数据
          </button>

          <button
            type="submit"
            disabled={!isConnected || !isFormValid || isProcessing || hasInsufficientBalance()}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {getButtonText()}
          </button>
        </div>

        {/* 流程说明 */}
        {fee && typeof fee === 'bigint' && needsApproval() && !hasInsufficientBalance() && currentStep === 'idle' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-blue-800 font-medium mb-1">创建流程：</h4>
            <ol className="text-blue-700 text-sm space-y-1">
              <li>1. 授权CarbonToken使用权限</li>
              <li>2. 自动创建NFT</li>
            </ol>
            <p className="text-blue-600 text-xs mt-2">
              * 只需点击一次按钮，系统将自动完成整个流程
            </p>
          </div>
        )}
      </form>

      {/* 提示信息 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-700 mb-2">💡 温馨提示</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• NFT创建需要支付一定的手续费</li>
          <li>• 提交后需要等待审计员审核您的绿色行为</li>
          <li>• 审核通过后，NFT将自动铸造到您的钱包</li>
          <li>• 您可以将审核通过的NFT兑换为碳代币</li>
        </ul>
      </div>
    </div>
  );
}; 