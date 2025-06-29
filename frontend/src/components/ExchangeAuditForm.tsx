'use client';

import React, { useState, useEffect } from 'react';
import { useSubmitExchangeAudit } from '@/contracts/hooks/useGreenTrace';
import { ExchangeAuditRequest } from '@/hooks/useExchangeAuditData';
import { formatFeeAmount } from '@/utils/tokenUtils';
import { formatTimestamp } from '@/utils/timeUtils';

// Redemption audit form props

interface ExchangeAuditFormProps {
  request: ExchangeAuditRequest;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Redemption audit form component

export const ExchangeAuditForm: React.FC<ExchangeAuditFormProps> = ({
  request,
  isOpen,
  onClose,
  onComplete
}) => {
  const [carbonValue, setCarbonValue] = useState('');
  const [auditComment, setAuditComment] = useState('');
  const [isApproved, setIsApproved] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  // Use redemption audit hook

  const { submitExchangeAudit, isPending, isConfirming, isConfirmed, error } = useSubmitExchangeAudit();

  // Reset the form

  const resetForm = () => {
    setCarbonValue('');
    setAuditComment('');
    setIsApproved(true);
    setShowConfirm(false);
  };

  // Close pop-up window

  const handleClose = () => {
    if (isPending || isConfirming) return;
    resetForm();
    onClose();
  };

  // Submit audit

  const handleSubmit = () => {
    if (!isApproved && !auditComment.trim()) {
      alert('拒绝申请时必须提供拒绝原因');
      return;
    }
    
    if (isApproved && (!carbonValue || Number(carbonValue) <= 0)) {
      alert('通过审计时必须设置有效的兑换价值');
      return;
    }

    setShowConfirm(true);
  };

  // Confirm Submission

  const confirmSubmit = () => {
    try {
      const cashId = BigInt(request.cashId);
      const value = isApproved ? carbonValue : '0';
      const comment = auditComment.trim() || (isApproved ? '审计通过' : '');
      
      // Convert to wei format (assuming 18 decimal places)

      const valueInWei = isApproved ? BigInt(Number(value) * 10**18) : BigInt(0);
      
      submitExchangeAudit(cashId, valueInWei, comment);
      setShowConfirm(false);
    } catch (error) {
      console.error('提交兑换审计失败:', error);
      alert(`提交失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // Processing audit completed

  useEffect(() => {
    if (isConfirmed) {
      alert('兑换审计提交成功！');
      resetForm();
      onComplete();
    }
  }, [isConfirmed, onComplete]);

  // Handling errors

  useEffect(() => {
    if (error) {
      console.error('兑换审计错误:', error);
      alert(`兑换审计失败: ${error.message}`);
    }
  }, [error]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 relative">
          <h2 className="text-2xl font-bold">兑换审计 - #{request.cashId}</h2>
          <p className="text-purple-100 mt-1">审核NFT兑换申请，确定最终兑换价值</p>
          
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={isPending || isConfirming}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all duration-200"
          >
            <span className="text-xl">×</span>
          </button>
        </div>

        {/* Scroll content area */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6 bg-gradient-to-br from-white/90 via-gray-50/50 to-white/80">
            {/* Redemption application details */}
            <div className="bg-gradient-to-br from-white/80 to-gray-50/60 rounded-xl p-6 border border-gray-200/50 shadow-sm backdrop-blur-sm">
              <h3 className="text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
                <span className="w-6 h-6 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center mr-2">
                  <span className="text-white text-xs">🔄</span>
                </span>
                兑换申请详情
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">申请ID:</span>
                    <span className="font-mono text-purple-600">#{request.cashId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">NFT编号:</span>
                    <span className="font-mono text-blue-600">#{request.nftTokenId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">申请人:</span>
                    <span className="font-mono text-sm text-gray-800 break-all">
                      {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">申请时间:</span>
                    <span className="text-gray-800">{formatTimestamp(request.blockTimestamp)}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">NFT当前价格:</span>
                    <span className="text-green-600 font-semibold">{formatFeeAmount(request.basePrice)} CARB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">申请手续费:</span>
                    <span className="text-orange-600 font-medium">{formatFeeAmount(request.requestFee)} CARB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 font-medium">当前状态:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      request.auditStatus === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : request.auditStatus === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {request.auditStatus === 'pending' && '⏳ 待审核'}
                      {request.auditStatus === 'approved' && '✅ 已批准'}
                      {request.auditStatus === 'rejected' && '❌ 已拒绝'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expense calculation instructions */}
            <div className="bg-gradient-to-br from-blue-50/80 to-blue-100/60 rounded-xl p-6 border border-blue-200/50">
              <h4 className="text-blue-800 font-semibold mb-3 flex items-center">
                <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mr-2">
                  <span className="text-white text-xs">💰</span>
                </span>
                费用计算说明
              </h4>
              <div className="text-sm text-blue-700 space-y-2">
                <div>• <strong>系统手续费</strong>：最终兑换价值的 1%，用于平台运营维护</div>
                <div>• <strong>审计费用</strong>：最终兑换价值的 4%，支付给审计员</div>
                <div>• <strong>实际到账</strong>：兑换价值 - 系统手续费 - 审计费用 = 95% 兑换价值</div>
                <div className="mt-3 p-3 bg-blue-100/50 rounded-lg">
                  <strong>示例</strong>：如果设定兑换价值为 100 CARB，用户实际将收到 95 CARB
                </div>
              </div>
            </div>

            {/* Audit decision */}
            <div className="bg-gradient-to-br from-white/80 to-gray-50/60 rounded-xl p-6 border border-gray-200/50 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">审计决定</h3>
              
              {/* Selection of audit results */}
              <div className="space-y-4 mb-6">
                <div className="flex space-x-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="auditResult"
                      checked={isApproved}
                      onChange={() => setIsApproved(true)}
                      className="mr-3 h-4 w-4 text-green-600"
                    />
                    <span className="text-green-700 font-medium">✅ 通过审计</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="auditResult"
                      checked={!isApproved}
                      onChange={() => setIsApproved(false)}
                      className="mr-3 h-4 w-4 text-red-600"
                    />
                    <span className="text-red-700 font-medium">❌ 拒绝申请</span>
                  </label>
                </div>
              </div>

              {/* Redemption value setting (displayed only when passed) */}
              {isApproved && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    兑换价值 (CARB) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={carbonValue}
                      onChange={(e) => setCarbonValue(e.target.value)}
                      placeholder="请输入兑换价值..."
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-3 text-gray-500">CARB</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    建议基于NFT的实际价值、市场行情和环保影响来确定兑换价值
                  </div>
                </div>
              )}

              {/* Audit opinion */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  审计意见 {!isApproved && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={auditComment}
                  onChange={(e) => setAuditComment(e.target.value)}
                  placeholder={isApproved ? "请填写审计意见（可选）..." : "请填写拒绝原因..."}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
                <div className="mt-2 text-sm text-gray-600">
                  {isApproved 
                    ? "可以补充审计过程中的发现或建议" 
                    : "必须详细说明拒绝的具体原因"
                  }
                </div>
              </div>
            </div>

            {/* Audit results preview */}
            {isApproved && carbonValue && Number(carbonValue) > 0 && (
              <div className="bg-gradient-to-br from-green-50/80 to-green-100/60 rounded-xl p-6 border border-green-200/50">
                <h4 className="text-green-800 font-semibold mb-3">审计结果预览</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">设定兑换价值:</span>
                    <span className="font-semibold">{carbonValue} CARB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">系统手续费 (1%):</span>
                    <span>-{(Number(carbonValue) * 0.01).toFixed(4)} CARB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">审计费用 (4%):</span>
                    <span>-{(Number(carbonValue) * 0.04).toFixed(4)} CARB</span>
                  </div>
                  <div className="border-t border-green-300 pt-2">
                    <div className="flex justify-between">
                      <span className="text-green-800 font-semibold">用户实际获得:</span>
                      <span className="font-bold text-green-600">{(Number(carbonValue) * 0.95).toFixed(4)} CARB</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                onClick={handleClose}
                disabled={isPending || isConfirming}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || isConfirming || (!isApproved && !auditComment.trim()) || (isApproved && (!carbonValue || Number(carbonValue) <= 0))}
                className={`px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  isApproved
                    ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
                    : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white'
                }`}
              >
                {isPending ? '准备中...' : isConfirming ? '提交中...' : (isApproved ? '通过审计' : '拒绝申请')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm submission pop-up window */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">确认提交审计结果</h3>
            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">申请ID:</span>
                <span className="font-medium">#{request.cashId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">审计结果:</span>
                <span className={`font-medium ${isApproved ? 'text-green-600' : 'text-red-600'}`}>
                  {isApproved ? '✅ 通过' : '❌ 拒绝'}
                </span>
              </div>
              {isApproved && (
                <div className="flex justify-between">
                  <span className="text-gray-600">兑换价值:</span>
                  <span className="font-medium">{carbonValue} CARB</span>
                </div>
              )}
              {auditComment && (
                <div>
                  <span className="text-gray-600">审计意见:</span>
                  <div className="mt-1 p-2 bg-gray-50 rounded text-gray-800 text-xs">
                    {auditComment}
                  </div>
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmSubmit}
                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  isApproved
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 