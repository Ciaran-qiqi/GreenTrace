import Link from 'next/link';
import { Navigation } from '@/components/Navigation';
import { CarbonPriceCard } from '@/components/CarbonPriceCard';

// 主页面组件 - 展示GreenTrace项目介绍
export default function Home() {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* 主标题区域 */}
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold text-gray-800 mb-6">
                记录绿色碳迹，创造可续未来
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                通过区块链技术记录您的环保行为，将绿色行动转化为有价值的NFT资产，
                为地球贡献一份力量，同时获得碳信用奖励。
              </p>
            </div>

            {/* 功能特色区域 */}
            <div className="grid md:grid-cols-3 gap-8 mb-16">
              <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                <div className="text-4xl mb-4">🌱</div>
                <h3 className="text-xl font-semibold mb-4">创建绿色NFT</h3>
                <p className="text-gray-600 mb-6">
                  记录您的环保行为，创建独特的绿色NFT，包括出行方式、能源使用、废物处理等环保行动。
                </p>
                <Link 
                // 跳转到nft创建页面，无需修改
                  href="/create"
                  className="inline-block px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  开始创建
                </Link>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-4">专业审计验证</h3>
                <p className="text-gray-600 mb-6">
                  专业审计员验证您的绿色行为真实性，确保每个NFT都代表真实的环保贡献。
                </p>
                <div className="text-sm text-gray-500">
                  透明可信的审计流程
                </div>
              </div>
              
              <div className="bg-white p-8 rounded-xl shadow-lg text-center">
                <div className="text-4xl mb-4">🔄</div>
                <h3 className="text-xl font-semibold mb-4">碳代币兑换</h3>
                <p className="text-gray-600 mb-6">
                  将审核通过的NFT兑换为有价值的碳代币，参与碳信用交易，实现环保价值变现。
                </p>
                <div className="text-sm text-gray-500">
                  环保行为的经济激励
                </div>
              </div>
            </div>





            {/* 碳价指数 */}
            <div className="mb-16">
              <CarbonPriceCard />
            </div>

            {/* 统计信息 */}
            <div className="mt-12 grid md:grid-cols-4 gap-6 text-center">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-3xl font-bold text-green-600 mb-2">1000+</div>
                <div className="text-gray-600">已创建NFT</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-3xl font-bold text-blue-600 mb-2">500+</div>
                <div className="text-gray-600">活跃用户</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-3xl font-bold text-purple-600 mb-2">50+</div>
                <div className="text-gray-600">专业审计员</div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-3xl font-bold text-orange-600 mb-2">10,000+</div>
                <div className="text-gray-600">碳减排量(kg)</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
