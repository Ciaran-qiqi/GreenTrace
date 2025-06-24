/**
 * NFT元数据工具函数
 * @description 处理NFT元数据的获取、解析和图片提取
 */

// IPFS网关配置
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
];

// NFT元数据接口
export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
}

/**
 * 将IPFS URL转换为HTTP URL
 * @param ipfsUrl IPFS URL (ipfs://... 或 Qm...)
 * @returns HTTP可访问的URL
 */
export function convertIpfsToHttp(ipfsUrl: string): string {
  if (!ipfsUrl) return '';

  // 如果已经是HTTP URL，直接返回
  if (ipfsUrl.startsWith('http://') || ipfsUrl.startsWith('https://')) {
    return ipfsUrl;
  }

  // 提取IPFS哈希
  let hash = '';
  if (ipfsUrl.startsWith('ipfs://')) {
    hash = ipfsUrl.replace('ipfs://', '');
  } else if (ipfsUrl.startsWith('Qm') || ipfsUrl.startsWith('bafy')) {
    hash = ipfsUrl;
  } else {
    return ipfsUrl; // 无法识别的格式，直接返回
  }

  // 使用第一个IPFS网关
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

/**
 * 获取NFT元数据
 * @param tokenURI Token URI
 * @returns NFT元数据对象
 */
export async function fetchNFTMetadata(tokenURI: string): Promise<NFTMetadata | null> {
  if (!tokenURI) {
    console.warn('Token URI为空');
    return null;
  }

  try {
    // 转换IPFS URL为HTTP URL
    const httpUrl = convertIpfsToHttp(tokenURI);
    console.log(`🎨 获取NFT元数据: ${httpUrl}`);

    // 尝试获取元数据
    const response = await fetch(httpUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // 设置超时时间
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
    }

    const metadata: NFTMetadata = await response.json();
    console.log('✅ NFT元数据获取成功:', metadata);

    // 转换图片URL为可访问的HTTP URL
    if (metadata.image) {
      metadata.image = convertIpfsToHttp(metadata.image);
    }

    return metadata;
  } catch (error) {
    console.error('❌ 获取NFT元数据失败:', error);
    return null;
  }
}

/**
 * 批量获取NFT元数据
 * @param tokenURIs Token URI数组
 * @returns 元数据对象数组
 */
export async function fetchBatchNFTMetadata(tokenURIs: string[]): Promise<(NFTMetadata | null)[]> {
  console.log(`🎨 开始批量获取 ${tokenURIs.length} 个NFT元数据`);

  const promises = tokenURIs.map(async (tokenURI, index) => {
    try {
      // 添加延迟避免请求过于频繁
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 100 * index));
      }
      return await fetchNFTMetadata(tokenURI);
    } catch (error) {
      console.error(`获取第${index}个NFT元数据失败:`, error);
      return null;
    }
  });

  const results = await Promise.allSettled(promises);
  const metadata = results.map(result => 
    result.status === 'fulfilled' ? result.value : null
  );

  console.log(`✅ 批量获取完成，成功: ${metadata.filter(m => m !== null).length}/${tokenURIs.length}`);
  return metadata;
}

/**
 * 从元数据中提取图片URL
 * @param metadata NFT元数据
 * @returns 图片URL或null
 */
export function extractImageUrl(metadata: NFTMetadata | null): string | null {
  if (!metadata) return null;
  return metadata.image || null;
}

/**
 * 生成默认NFT图片
 * @param tokenId Token ID
 * @returns 默认图片URL或数据URL
 */
export function generateDefaultNFTImage(tokenId: string): string {
  // 可以返回一个生成的SVG或默认图片
  // 这里返回一个简单的数据URL，实际项目中可以使用更复杂的生成逻辑
  const emoji = getRandomGreenEmoji();
  
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#bg)"/>
      <text x="200" y="180" font-family="Arial" font-size="48" text-anchor="middle" fill="white" opacity="0.9">${emoji}</text>
      <text x="200" y="240" font-family="Arial" font-size="16" text-anchor="middle" fill="white" opacity="0.8">Green NFT</text>
      <text x="200" y="280" font-family="Arial" font-size="14" text-anchor="middle" fill="white" opacity="0.7">#${tokenId}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * 获取随机绿色主题表情符号
 */
function getRandomGreenEmoji(): string {
  const emojis = ['🌱', '🌿', '🍃', '🌳', '🌲', '🌴', '🌾', '🌵', '💚', '♻️'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}

/**
 * 检查图片URL是否可访问
 * @param imageUrl 图片URL
 * @returns 是否可访问
 */
export async function isImageAccessible(imageUrl: string): Promise<boolean> {
  if (!imageUrl) return false;
  
  try {
    const response = await fetch(imageUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5秒超时
    });
    return response.ok;
  } catch {
    return false;
  }
} 