'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

// 导航栏组件
export const Navbar = () => {
  // 获取当前路径
  const pathname = usePathname();

  // 导航项配置
  const navItems = [
    { name: '主页', path: '/' },
    { name: '碳币市场', path: '/carbon-market' },
    { name: 'NFT中心', path: '/nft-center' },
    { name: 'NFT交易', path: '/nft-trading' },
    { name: '审计中心', path: '/audit-center' },
  ];

  return (
    <nav className="bg-green-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo区域 */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="GreenTrace Logo"
                width={40}
                height={40}
                className="rounded-full"
              />
              <span className="ml-2 text-xl font-bold">GreenTrace</span>
            </Link>
          </div>

          {/* 导航链接 */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.path
                      ? 'bg-green-700'
                      : 'hover:bg-green-700'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            <Link href="/admin" className="text-gray-300 hover:text-white">
              管理后台
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}; 