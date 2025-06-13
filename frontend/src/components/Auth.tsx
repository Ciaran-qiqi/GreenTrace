import React, { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

// 模拟用户数据
const MOCK_USERS = [
  { 
    email: 'test@example.com', 
    password: '123456',
    walletAddress: '0x294761C91734360C5A70e33F8372778ED2849767', // 示例钱包地址
    name: 'Ciaran',
    avatar: 'https://ui-avatars.com/api/?name=C&background=random&color=fff&size=200' // 使用首字母C生成的头像
  }
];

// 用户认证组件
export const Auth: React.FC = () => {
  // 使用 wagmi 的 useAccount hook 获取钱包连接状态
  const { address, isConnected } = useAccount();
  // 使用 wagmi 的 useDisconnect hook 获取断开连接函数
  const { disconnect } = useDisconnect();
  // 注册状态
  const [isRegistering, setIsRegistering] = useState(false);
  // 表单数据
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    avatar: '' // 初始为空，等待用户选择或使用默认值
  });
  // 登录状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // 错误信息
  const [error, setError] = useState('');
  // 当前用户
  const [currentUser, setCurrentUser] = useState<typeof MOCK_USERS[0] | null>(null);
  // 是否显示钱包绑定界面
  const [showWalletBinding, setShowWalletBinding] = useState(false);
  // 是否显示钱包地址弹窗
  const [showWalletAddress, setShowWalletAddress] = useState(false);

  // 生成默认头像（用户名首字母）
  const generateDefaultAvatar = (name: string) => {
    const firstLetter = name.charAt(0).toUpperCase();
    return `https://ui-avatars.com/api/?name=${firstLetter}&background=random&color=fff&size=200`;
  };

  // 处理头像选择
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          avatar: reader.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // 处理表单输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 清除错误信息
    setError('');
  };

  // 处理注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 表单验证
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 6) {
      setError('密码长度不能少于6位');
      return;
    }

    if (!formData.name.trim()) {
      setError('请输入姓名');
      return;
    }

    // 检查邮箱是否已注册
    if (MOCK_USERS.some(user => user.email === formData.email)) {
      setError('该邮箱已被注册');
      return;
    }

    // 如果没有选择头像，使用默认头像（用户名首字母）
    const avatar = formData.avatar || generateDefaultAvatar(formData.name);

    // 模拟注册成功
    const newUser = {
      email: formData.email,
      password: formData.password,
      walletAddress: '', // 初始状态不绑定钱包
      name: formData.name.trim(),
      avatar: avatar
    };
    MOCK_USERS.push(newUser);

    // 清空表单
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      avatar: ''
    });

    // 切换到登录界面
    setIsRegistering(false);
    alert('注册成功，请登录');
  };

  // 处理登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 查找用户
    const user = MOCK_USERS.find(
      u => u.email === formData.email && u.password === formData.password
    );

    if (!user) {
      setError('邮箱或密码错误');
      return;
    }

    // 模拟登录成功
    setCurrentUser(user);
    setIsLoggedIn(true);
    // 清空表单
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      avatar: ''
    });

    // 如果用户没有绑定钱包，显示钱包绑定界面
    if (!user.walletAddress) {
      setShowWalletBinding(true);
    }
  };

  // 处理钱包绑定
  const handleWalletBinding = () => {
    if (!isConnected || !address) {
      setError('请先连接钱包');
      return;
    }

    // 检查钱包地址是否已被其他用户绑定
    const existingUser = MOCK_USERS.find(user => user.walletAddress === address && user.email !== currentUser?.email);
    if (existingUser) {
      setError(`该钱包地址已被用户 ${existingUser.email} 绑定，请重新连接其他钱包`);
      // 主动断开当前钱包连接
      disconnect();
      return;
    }

    // 更新用户钱包地址
    if (currentUser) {
      currentUser.walletAddress = address;
      setCurrentUser({ ...currentUser });
      setShowWalletBinding(false);
      alert('钱包绑定成功！');
    }
  };

  // 复制钱包地址到剪贴板
  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text).then(() => {
        showToast('钱包地址已复制到剪贴板');
      }).catch(() => {
        // 如果Clipboard API失败，使用备用方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        showToast('钱包地址已复制到剪贴板');
      });
    } catch (err) {
      console.error('复制失败:', err);
      showToast('复制失败，请手动复制地址', 'error');
    }
  };

  // 显示提示信息
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const existingToast = document.querySelector('.toast-message');
    if (existingToast && existingToast.parentNode) {
      existingToast.parentNode.removeChild(existingToast);
    }

    const toast = document.createElement('div');
    toast.className = `toast-message fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 opacity-0 translate-y-[-20px] z-50 flex items-center space-x-2 ${
      type === 'success' 
        ? 'bg-green-50 border border-green-200 text-green-700' 
        : 'bg-red-50 border border-red-200 text-red-700'
    }`;
    
    // 添加图标
    const icon = document.createElement('div');
    icon.className = `flex-shrink-0 ${
      type === 'success' ? 'text-green-500' : 'text-red-500'
    }`;
    icon.innerHTML = type === 'success' 
      ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
      : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    
    const messageText = document.createElement('span');
    messageText.className = 'text-sm font-medium';
    messageText.textContent = message;
    
    toast.appendChild(icon);
    toast.appendChild(messageText);
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  // 在弹窗中的复制按钮事件处理
  const handleCopyClick = (address: string, modal: HTMLDivElement) => {
    copyToClipboard(address);
    // 使用淡出动画关闭弹窗
    const dialog = modal.querySelector('div');
    if (dialog) {
      dialog.style.opacity = '0';
      dialog.style.transform = 'scale(0.95)';
    }
    setTimeout(() => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
    }, 200);
  };

  // 格式化钱包地址显示
  const formatAddress = (address: string | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 如果已登录，显示用户信息或钱包绑定界面
  if (isLoggedIn && currentUser) {
    if (showWalletBinding) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-center mb-8 text-green-600">
              绑定钱包
            </h1>
            
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-gray-600 text-lg">
                  {currentUser.walletAddress ? '已绑定钱包地址' : '请连接您的钱包以完成绑定'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {currentUser.walletAddress ? '您可以重新绑定其他钱包' : '连接后即可完成账户与钱包的绑定'}
                </p>
              </div>

              {/* 钱包连接状态 */}
              <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
                {isConnected && address ? (
                  <div className="text-center space-y-4">
                    <div>
                      <p className="text-green-600 font-medium text-lg">已连接钱包</p>
                      <div className="mt-2 bg-white p-3 rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500 break-all">
                            {formatAddress(address)}
                          </p>
                          <button
                            onClick={() => copyToClipboard(address)}
                            className="ml-2 px-3 py-1.5 text-xs text-green-500 hover:text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-all duration-200 flex items-center space-x-1 group"
                          >
                            <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            <span>复制</span>
                          </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 break-all">
                          {address}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        disconnect();
                      }}
                      className="px-6 py-2 text-sm text-red-500 hover:text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all duration-200 flex items-center justify-center space-x-2 group"
                    >
                      <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>断开连接</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <div>
                      <p className="text-gray-600 font-medium text-lg">请选择钱包进行连接</p>
                      <p className="text-sm text-gray-500 mt-2">
                        支持 MetaMask、WalletConnect 等主流钱包
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <div className="transform hover:scale-105 transition-all duration-200">
                        <ConnectButton />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm text-center">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleWalletBinding}
                  disabled={!isConnected}
                  className="w-full bg-green-500 text-white py-3 rounded-xl hover:bg-green-600 transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                >
                  绑定钱包
                </button>

                <button
                  onClick={() => {
                    setIsLoggedIn(false);
                    setCurrentUser(null);
                    setShowWalletBinding(false);
                    setError('');
                  }}
                  className="w-full text-green-500 hover:text-green-600 py-2 font-medium"
                >
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#f5f7fa]">
        {/* 顶部导航栏 */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-green-600">GreenTrace</h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <button
                    onClick={() => setShowWalletAddress(true)}
                    className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg p-2 transition-colors duration-200"
                  >
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span className="text-sm text-gray-700">{currentUser.name}</span>
                  </button>
                </div>
                <div className="transform hover:scale-105 transition-all duration-200">
                  <ConnectButton />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">欢迎使用 GreenTrace</h2>
            <p className="text-lg text-gray-600">开始您的绿色溯源之旅</p>
          </div>
        </div>

        {/* 用户信息弹窗 */}
        {showWalletAddress && currentUser?.walletAddress && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#f8f9fa] rounded-lg p-6 max-w-md w-full mx-4 transform transition-all duration-300 scale-100 opacity-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">用户信息</h3>
                <button 
                  onClick={() => setShowWalletAddress(false)}
                  className="text-gray-400 hover:text-gray-500 transition-colors duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{currentUser.name}</h4>
                    <p className="text-sm text-gray-500">{currentUser.email}</p>
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-sm text-gray-600 break-all">钱包地址：{currentUser.walletAddress}</p>
                </div>
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      setIsLoggedIn(false);
                      setCurrentUser(null);
                      setShowWalletAddress(false);
                      setError('');
                    }}
                    className="px-4 py-2 text-sm text-red-500 hover:text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all duration-200 flex items-center space-x-1 active:scale-95 cursor-pointer select-none"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>退出登录</span>
                  </button>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => {
                        copyToClipboard(currentUser.walletAddress);
                        setShowWalletAddress(false);
                      }}
                      className="px-4 py-2 text-sm text-green-500 hover:text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-all duration-200 flex items-center space-x-1 active:scale-95 cursor-pointer select-none"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      <span>复制地址</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowWalletAddress(false);
                        setShowWalletBinding(true);
                      }}
                      className="px-4 py-2 text-sm text-green-500 hover:text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-all duration-200 flex items-center space-x-1 active:scale-95 cursor-pointer select-none"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>重新绑定钱包</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        {!isLoggedIn ? (
          // 登录表单
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">登录</h2>
              <p className="mt-2 text-sm text-gray-600">欢迎回来，请登录您的账号</p>
            </div>
            {error && !showWalletBinding && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
                <div className="flex-shrink-0 text-red-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              </div>
            )}
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
              {isRegistering && (
                <>
                  <div>
                    <input
                      type="text"
                      name="name"
                      placeholder="请输入姓名"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                      {formData.avatar ? (
                        <img
                          src={formData.avatar}
                          alt="头像预览"
                          className="w-full h-full object-cover"
                        />
                      ) : formData.name ? (
                        <img
                          src={generateDefaultAvatar(formData.name)}
                          alt="默认头像"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-gray-400">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-gray-600 mb-2">选择头像</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">如果不选择头像，将使用姓名首字母作为头像</p>
                    </div>
                  </div>
                </>
              )}
              <div>
                <input
                  type="email"
                  name="email"
                  placeholder="请输入邮箱"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              
              <div>
                <input
                  type="password"
                  name="password"
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              {isRegistering && (
                <div>
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="请确认密码"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 transition-colors"
              >
                {isRegistering ? '注册' : '登录'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                  setFormData({
                    email: '',
                    password: '',
                    confirmPassword: '',
                    name: '',
                    avatar: ''
                  });
                }}
                className="w-full text-green-500 hover:text-green-600"
              >
                {isRegistering ? '已有账户？去登录' : '没有账户？去注册'}
              </button>
            </form>

            {/* 测试账号提示 */}
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>测试账号：test@example.com</p>
              <p>测试密码：123456</p>
            </div>
          </div>
        ) : (
          // 用户信息展示
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">用户信息</h2>
              <p className="mt-2 text-sm text-gray-600">您的账户信息</p>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">邮箱：{currentUser?.email}</p>
              {currentUser?.walletAddress ? (
                <div className="mt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-600">
                        已绑定钱包地址：
                      </p>
                      <div className="relative group">
                        <button
                          onClick={() => {
                            setShowWalletAddress(true);
                          }}
                          className="text-sm text-gray-600 hover:text-green-600 transition-colors duration-200 flex items-center space-x-1 group cursor-pointer"
                        >
                          <span>{formatAddress(currentUser?.walletAddress)}</span>
                          <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowWalletBinding(true)}
                      className="text-sm text-green-500 hover:text-green-600 flex items-center space-x-1 group transition-all duration-200"
                    >
                      <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>重新绑定</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-red-600">未绑定钱包</p>
                  <button
                    onClick={() => setShowWalletBinding(true)}
                    className="mt-2 text-sm text-green-500 hover:text-green-600 flex items-center space-x-1 group transition-all duration-200"
                  >
                    <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>绑定钱包</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setIsLoggedIn(false);
                setCurrentUser(null);
                setShowWalletBinding(false);
                setError('');
              }}
              className="w-full text-green-500 hover:text-green-600 flex items-center justify-center space-x-2 group transition-all duration-200"
            >
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>退出登录</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}; 