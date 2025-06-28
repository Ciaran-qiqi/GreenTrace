'use client';

import React, { useState } from 'react';
import { useSubmitMintAudit } from '@/contracts/hooks/useGreenTrace';
import { formatFeeAmount, parseTokenAmount, isValidTokenAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';
import { useTranslation } from '@/hooks/useI18n';

import { AuditRequest } from '@/hooks/useAuditData';

// 审计表单组件Props
interface AuditFormProps {
  request: AuditRequest;
  onClose: () => void;
  onComplete: () => void;
}

// 审计表单组件
export const AuditForm: React.FC<AuditFormProps> = ({ 
  request, 
  onClose, 
  onComplete 
}) => {
  const { t } = useTranslation();
  const [auditedCarbonReduction, setAuditedCarbonReduction] = useState(request.carbonReduction);
  const [auditReason, setAuditReason] = useState('');
  const [isApproved, setIsApproved] = useState(true);
  
  // 提交审计结果
  const { 
    submitMintAudit, 
    isPending, 
    isConfirming, 
    isConfirmed, 
    error 
  } = useSubmitMintAudit();

  // 处理提交审计
  const handleSubmitAudit = async () => {
    if (!auditReason.trim()) {
      alert(t('audit.form.fillAuditComment', '请填写审计意见'));
      return;
    }

    // 验证碳减排量输入格式
    if (isApproved && !isValidTokenAmount(auditedCarbonReduction)) {
      alert(t('audit.form.validCarbonReduction', '请输入有效的碳减排量（支持最多18位小数）'));
      return;
    }

    try {
      // 如果拒绝，碳价值设为0；如果通过，使用审计员输入的值
      const carbonValue = isApproved ? parseTokenAmount(auditedCarbonReduction) : BigInt(0);
      
      console.log('提交审计结果:', {
        requestId: request.tokenId,
        isApproved,
        auditedCarbonReduction,
        carbonValueInWei: carbonValue.toString(),
        auditReason
      });
      
      await submitMintAudit(
        BigInt(request.tokenId),
        carbonValue,
        auditReason
      );
    } catch (err) {
      console.error('提交审计失败:', err);
      alert(`${t('audit.form.submitFailed', '提交审计失败')}: ${err instanceof Error ? err.message : t('audit.form.unknownError', '未知错误')}`);
    }
  };

  // 处理审计决定变化
  const handleAuditDecisionChange = (approved: boolean) => {
    setIsApproved(approved);
    if (!approved) {
      // 如果拒绝，将碳减排量设为0
      setAuditedCarbonReduction('0');
    } else {
      // 如果通过，恢复为原始申请量
      setAuditedCarbonReduction(request.carbonReduction);
    }
  };

  // 监听交易确认
  React.useEffect(() => {
    if (isConfirmed) {
      onComplete();
    }
  }, [isConfirmed, onComplete]);

  // 使用统一的时间格式化工具

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-gray-900/50 to-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ top: 0, left: 0, right: 0, bottom: 0, position: 'fixed' }}>
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* 装饰性顶部渐变条 */}
        <div className="h-1 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500"></div>
        
        {/* 标题栏 */}
        <div className="flex justify-between items-center p-6 bg-gradient-to-r from-white/90 to-gray-50/80 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-lg">📋</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {t('audit.form.auditNFTApplication', '审计NFT申请')} #{request.tokenId}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {t('audit.form.reviewCarefully', '请仔细审核申请内容并给出专业意见')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/70 rounded-xl transition-all duration-200 backdrop-blur-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 滚动内容区域 */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6 bg-gradient-to-br from-white/90 via-gray-50/50 to-white/80">
            {/* 申请详情 */}
            <div className="bg-gradient-to-br from-white/80 to-gray-50/60 rounded-xl p-6 border border-gray-200/50 shadow-sm backdrop-blur-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">📄</span>
                </span>
                {t('audit.form.applicationDetails', '申请详情')}
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audit.form.applicationTitle', '申请标题')}
                  </label>
                  <div className="p-4 bg-white/70 rounded-lg border border-gray-200/50 shadow-inner backdrop-blur-sm">
                    <div className="font-medium text-gray-800">{request.title}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audit.form.applicantAddress', '申请人地址')}
                  </label>
                  <div className="p-4 bg-white/70 rounded-lg border border-gray-200/50 shadow-inner backdrop-blur-sm">
                    <div className="font-mono text-sm text-gray-800 break-all">{request.requester}</div>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audit.form.environmentalDetails', '环保行为详情')}
                  </label>
                  <div className="p-4 bg-gradient-to-br from-white/80 to-gray-50/50 rounded-lg border border-gray-200/50 shadow-inner backdrop-blur-sm min-h-[120px]">
                    <div className="text-gray-700 leading-relaxed">{request.details}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audit.form.appliedCarbonReduction', '申请碳减排量')}
                  </label>
                  <div className="p-4 bg-gradient-to-br from-green-50/80 to-emerald-50/50 rounded-lg border border-green-200/50 shadow-inner backdrop-blur-sm">
                    <div className="font-semibold text-green-800 flex items-center">
                      <span className="text-lg mr-2">🌱</span>
                      {request.carbonReduction} tCO₂e
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audit.form.paymentFee', '支付费用')}
                  </label>
                  <div className="p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 rounded-lg border border-blue-200/50 shadow-inner backdrop-blur-sm">
                    <div className="font-semibold text-blue-800 flex items-center">
                      <span className="text-lg mr-2">💰</span>
                      {formatFeeAmount(request.totalFee)} CARB
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audit.form.applicationTime', '申请时间')}
                  </label>
                  <div className="p-4 bg-white/70 rounded-lg border border-gray-200/50 shadow-inner backdrop-blur-sm">
                    <div className="font-medium text-gray-800 flex items-center">
                      <span className="text-lg mr-2">⏰</span>
                      {formatTimestamp(request.blockTimestamp)}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('audit.form.transactionHash', '交易哈希')}
                  </label>
                  <div className="p-4 bg-white/70 rounded-lg border border-gray-200/50 shadow-inner backdrop-blur-sm">
                    <div className="font-mono text-xs text-gray-600 break-all">{request.transactionHash}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 审计表单 */}
            <div className="bg-gradient-to-br from-white/80 to-blue-50/60 rounded-xl p-6 border border-blue-200/50 shadow-sm backdrop-blur-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-6 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">⚖️</span>
                </span>
                {t('audit.form.auditDecision', '审计决策')}
              </h3>
              
              {/* 审计决定 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('audit.form.auditDecision', '审计决定')} *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="auditDecision"
                      checked={isApproved}
                      onChange={() => handleAuditDecisionChange(true)}
                      className="sr-only"
                    />
                    <div className={`flex items-center px-6 py-3 rounded-xl border-2 transition-all duration-200 ${
                      isApproved 
                        ? 'bg-gradient-to-r from-green-100 to-emerald-50 border-green-300 shadow-md' 
                        : 'bg-white/70 border-gray-200 hover:bg-green-50/50'
                    }`}>
                      <span className="text-2xl mr-3">✅</span>
                      <span className={`font-medium ${isApproved ? 'text-green-700' : 'text-gray-600'}`}>
                        {t('audit.form.approveAudit', '通过审计')}
                      </span>
                    </div>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="auditDecision"
                      checked={!isApproved}
                      onChange={() => handleAuditDecisionChange(false)}
                      className="sr-only"
                    />
                    <div className={`flex items-center px-6 py-3 rounded-xl border-2 transition-all duration-200 ${
                      !isApproved 
                        ? 'bg-gradient-to-r from-red-100 to-rose-50 border-red-300 shadow-md' 
                        : 'bg-white/70 border-gray-200 hover:bg-red-50/50'
                    }`}>
                      <span className="text-2xl mr-3">❌</span>
                      <span className={`font-medium ${!isApproved ? 'text-red-700' : 'text-gray-600'}`}>
                        {t('audit.form.rejectApplication', '拒绝申请')}
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 审计后的碳减排量 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('audit.form.auditedCarbonReduction', '审计后的碳减排量')} (tCO₂e) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={auditedCarbonReduction}
                    onChange={(e) => setAuditedCarbonReduction(e.target.value)}
                    disabled={!isApproved}
                    className="w-full p-4 bg-white/80 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 disabled:bg-gray-100/50 disabled:text-gray-400 shadow-inner backdrop-blur-sm transition-all duration-200"
                    placeholder={t('audit.form.enterAuditedCarbonReduction', '输入审计确认的碳减排量')}
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <span className="text-lg">🌱</span>
                  </div>
                </div>
                <p className={`text-sm mt-2 px-3 py-2 rounded-lg ${
                  isApproved 
                    ? 'text-green-700 bg-green-50/70' 
                    : 'text-gray-500 bg-gray-50/70'
                }`}>
                  {isApproved 
                    ? t('audit.form.approvedTip', '💡 输入经过审计验证的实际碳减排量（支持小数，最多18位精度）')
                    : t('audit.form.rejectedTip', '🚫 拒绝申请时自动设为0')
                  }
                </p>
              </div>

              {/* 审计意见 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('audit.form.auditComment', '审计意见')} *
                </label>
                <textarea
                  value={auditReason}
                  onChange={(e) => setAuditReason(e.target.value)}
                  rows={5}
                  className="w-full p-4 bg-white/80 border border-gray-200/50 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-inner backdrop-blur-sm transition-all duration-200 resize-none"
                  placeholder={isApproved 
                    ? t('audit.form.approvedPlaceholder', '请详细说明审计过程、验证结果和通过原因...')
                    : t('audit.form.rejectedPlaceholder', '请详细说明拒绝原因和改进建议...')
                  }
                />
                <p className="text-xs text-gray-500 mt-2 px-3">
                  💬 {t('audit.form.commentTip', '请提供详细的审计意见，帮助申请人了解审核结果')}
                </p>
              </div>

              {/* 错误信息 */}
              {error && (
                <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-200/50 rounded-xl shadow-inner backdrop-blur-sm">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">⚠️</span>
                    <div>
                      <h4 className="font-medium text-red-800 mb-1">{t('audit.form.submitFailed', '审计提交失败')}</h4>
                      <p className="text-red-600 text-sm">{error.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200/50">
                <button
                  onClick={onClose}
                  disabled={isPending || isConfirming}
                  className="px-6 py-3 bg-white/80 border border-gray-300/50 text-gray-700 rounded-xl hover:bg-gray-50/80 disabled:opacity-50 transition-all duration-200 backdrop-blur-sm shadow-sm"
                >
                  {t('audit.form.cancel', '取消')}
                </button>
                <button
                  onClick={handleSubmitAudit}
                  disabled={isPending || isConfirming || !auditReason.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  {isPending || isConfirming ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      {isPending ? t('audit.form.sendingTransaction', '发送交易中...') : t('audit.form.confirmingTransaction', '确认交易中...')}
                    </>
                  ) : (
                    <>
                      <span className="text-lg">📝</span>
                      {t('audit.form.submitAuditResult', '提交审计结果')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 