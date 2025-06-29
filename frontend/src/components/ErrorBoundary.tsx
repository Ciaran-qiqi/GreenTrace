import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Error boundary component
 * Used to capture and display configuration errors
 */
export default function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  return (
    <div>
      {fallback || (
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
            <div className="text-6xl mb-4">🔧</div>
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">系统配置检查</h2>
            <p className="text-yellow-600 mb-4">
              正在初始化碳币交易系统，请稍候...
            </p>
            <div className="text-sm text-yellow-500">
              如果此页面持续显示，请检查合约地址配置
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Configuration error display component
 */
export function ConfigError({ message, details }: { message: string; details?: string[] }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-red-800 mb-2">配置错误</h2>
          <p className="text-red-600 mb-4">{message}</p>
        </div>
        
        {details && (
          <div className="bg-red-100 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-red-800 mb-2">详细信息：</h4>
            <div className="text-sm text-red-600 space-y-1">
              {details.map((detail, index) => (
                <div key={index} className="font-mono">{detail}</div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2">解决方案：</h4>
          <div className="text-sm text-blue-600 space-y-2">
            <div>1. 检查 <code className="bg-blue-100 px-2 py-1 rounded">.env.local</code> 文件中的环境变量配置</div>
            <div>2. 确保所有合约地址都是有效的以太坊地址（42字符，以0x开头）</div>
            <div>3. 如果在测试网环境，请确认合约已正确部署</div>
            <div>4. 重启开发服务器：<code className="bg-blue-100 px-2 py-1 rounded">npm run dev</code></div>
          </div>
        </div>
      </div>
    </div>
  )
} 