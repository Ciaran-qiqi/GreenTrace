'use client';

import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

// 网络错误处理组件
export const NetworkErrorHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { networkStatus, retryConnection, resetNetworkStatus } = useNetworkStatus();

  // 如果网络状态正常，直接渲染子组件
  if (networkStatus.isOnline && networkStatus.rpcStatus !== 'failed') {
    return <>{children}</>;
  }

  // 网络完全失败时的处理
  if (!networkStatus.isOnline || networkStatus.rpcStatus === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            {/* 错误图标 */}
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-2xl">🌐</span>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              {!networkStatus.isOnline ? '网络连接已断开' : 'RPC节点连接失败'}
            </h2>

            <p className="text-gray-600 mb-6 leading-relaxed">
              {!networkStatus.isOnline 
                ? '请检查您的网络连接后重试'
                : '所有区块链RPC节点暂时不可用，可能是网络问题或节点维护'
              }
            </p>

            {/* 错误详情 */}
            {networkStatus.lastError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="text-sm text-red-800">
                  <div className="font-semibold mb-1">错误详情:</div>
                  <div className="text-red-600">{networkStatus.lastError}</div>
                </div>
              </div>
            )}

            {/* 重试统计 */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="text-sm text-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <span>重试次数:</span>
                  <span className="font-medium">{networkStatus.retryCount}/5</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(networkStatus.retryCount / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* 解决方案建议 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="text-sm text-blue-800">
                <div className="font-semibold mb-2">💡 解决方案:</div>
                <ul className="text-left space-y-1 text-blue-600">
                  <li>• 检查网络连接是否正常</li>
                  <li>• 刷新页面重新连接</li>
                  <li>• 尝试切换网络后再切回来</li>
                  <li>• 检查是否有防火墙阻止连接</li>
                  <li>• 稍后再试（可能是临时网络问题）</li>
                </ul>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="space-y-3">
              <button
                onClick={retryConnection}
                disabled={!networkStatus.canRetry}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-xl font-semibold transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {networkStatus.canRetry ? '重试连接' : '重试次数已用完'}
              </button>

              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-semibold transition-colors duration-200"
              >
                刷新页面
              </button>

              <button
                onClick={resetNetworkStatus}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold transition-colors duration-200"
              >
                重置状态
              </button>
            </div>

            {/* 技术信息 */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <details className="text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  技术详情
                </summary>
                <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                  <div>在线状态: {networkStatus.isOnline ? '✅ 在线' : '❌ 离线'}</div>
                  <div>RPC状态: {
                    networkStatus.rpcStatus === 'healthy' ? '✅ 健康' :
                    networkStatus.rpcStatus === 'degraded' ? '⚠️ 降级' : '❌ 失败'
                  }</div>
                  <div>重试次数: {networkStatus.retryCount}</div>
                  <div>可重试: {networkStatus.canRetry ? '是' : '否'}</div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 降级状态时显示警告但不阻止使用
  return (
    <div className="relative">
      {networkStatus.rpcStatus === 'degraded' && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>网络连接不稳定:</strong> 部分RPC节点连接异常，可能影响交易速度。
                <button 
                  onClick={retryConnection}
                  className="ml-2 underline hover:no-underline"
                >
                  点击重试
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}; 