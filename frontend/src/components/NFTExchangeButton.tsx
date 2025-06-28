'use client';

import React, { useState } from 'react';
import { useRequestExchangeNFT } from '@/contracts/hooks/useGreenTrace';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { useTranslation } from '@/hooks/useI18n';

// NFT信息接口
interface NFTInfo {
  tokenId: string;
  title: string;
  storyDetails: string;
  carbonReduction: string;
  initialPrice: string;
  lastPrice: string;
  createTime: string;
  owner: string;
}

// NFT兑换按钮组件属性
interface NFTExchangeButtonProps {
  nft: NFTInfo;
  onExchangeSuccess?: () => void;
  buttonText?: string;
  className?: string;
}

// NFT兑换按钮组件
export const NFTExchangeButton: React.FC<NFTExchangeButtonProps> = ({
  nft,
  onExchangeSuccess,
  buttonText = '申请兑换',
  className = ''
}) => {
  const { t } = useTranslation();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // 请求兑换NFT的Hook
  const { requestExchange, isPending, isConfirming, isConfirmed, error } = useRequestExchangeNFT();

  // 计算申请手续费（合约逻辑：碳减排量1%或1个碳币中的较大值）
  const calculateRequestFee = (carbonReduction: string) => {
    const reduction = BigInt(carbonReduction);
    const percentageFee = reduction / BigInt(100); // 1%
    const minFee = BigInt('1000000000000000000'); // 1 CARB (18位小数)
    return percentageFee > minFee ? percentageFee : minFee;
  };

  // 处理申请兑换
  const handleRequestExchange = () => {
    setShowConfirmModal(true);
  };

  // 确认申请兑换
  const confirmRequestExchange = () => {
    try {
      requestExchange(BigInt(nft.tokenId));
    } catch (error) {
      console.error(t('exchange.errors.requestFailed', '申请兑换失败:'), error);
      alert(t('exchange.errors.requestFailed', '申请兑换失败: {error}', { error: error instanceof Error ? error.message : t('common.unknownError', '未知错误') }));
    }
  };

  // 关闭确认弹窗
  const closeConfirmModal = () => {
    setShowConfirmModal(false);
  };

  // 处理兑换完成
  React.useEffect(() => {
    if (isConfirmed) {
      closeConfirmModal();
      if (onExchangeSuccess) {
        onExchangeSuccess();
      }
    }
  }, [isConfirmed, onExchangeSuccess]);

  // 处理错误
  React.useEffect(() => {
    if (error) {
      console.error(t('exchange.errors.requestFailed', '兑换申请错误:'), error);
      alert(t('exchange.errors.requestFailed', '兑换申请失败: {error}', { error: error.message }));
    }
  }, [error, t]);

  return (
    <>
      <button
        onClick={handleRequestExchange}
        disabled={isPending || isConfirming}
        className={`flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm disabled:opacity-50 ${className}`}
      >
        {isPending ? t('exchange.preparing', '准备中...') : isConfirming ? t('exchange.confirming', '确认中...') : buttonText}
      </button>

      {/* 申请兑换确认弹窗 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 max-w-lg w-full mx-4">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">{t('exchange.confirmExchangeTitle', '确认申请兑换')}</h3>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-6 mb-6 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-3">{t('exchange.nftInfo', 'NFT信息')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-600">{t('exchange.nftId', 'NFT编号')}:</span>
                  <span className="font-medium">#{nft.tokenId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">{t('exchange.title', '标题')}:</span>
                  <span className="font-medium">{nft.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">{t('assets.carbonReduction', '碳减排量')}:</span>
                  <span className="font-medium">{formatFeeAmount(nft.carbonReduction)} CARB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-600">{t('assets.currentPrice', '当前价格')}:</span>
                  <span className="font-medium">
                    {formatFeeAmount(nft.lastPrice !== '0' ? nft.lastPrice : nft.initialPrice)} CARB
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-6 mb-6 border border-orange-200">
              <h4 className="font-semibold text-orange-800 mb-3">{t('exchange.feeInfo', '费用说明')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-orange-600">{t('exchange.applicationFee', '申请手续费')}:</span>
                  <span className="font-medium">{formatFeeAmount(calculateRequestFee(nft.carbonReduction).toString())} CARB</span>
                </div>
                <div className="text-xs text-orange-600 mt-2">
                  * {t('exchange.feeExplanation', '申请手续费为碳减排量的1%或1个CARB中的较大值')}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6 border border-gray-200">
              <div className="text-sm text-gray-700">
                <div className="font-semibold mb-2">⚠️ {t('exchange.importantNotice', '重要提醒')}:</div>
                <ul className="space-y-1 text-xs">
                  <li>• {t('exchange.notice1', '提交申请后，NFT将进入兑换流程，无法撤销')}</li>
                  <li>• {t('exchange.notice2', '审计员将评估NFT实际价值，确定最终兑换金额')}</li>
                  <li>• {t('exchange.notice3', '兑换完成后，NFT将被销毁，您将获得相应的CARB代币')}</li>
                  <li>• {t('exchange.notice4', '实际到账金额将扣除系统手续费(1%)和审计费(4%)')}</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeConfirmModal}
                disabled={isPending || isConfirming}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {t('common.cancel', '取消')}
              </button>
              <button
                onClick={confirmRequestExchange}
                disabled={isPending || isConfirming}
                className="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:opacity-50"
              >
                {isPending ? t('exchange.preparing', '准备中...') : isConfirming ? t('exchange.confirming', '确认中...') : t('exchange.confirmExchange', '确认申请')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 