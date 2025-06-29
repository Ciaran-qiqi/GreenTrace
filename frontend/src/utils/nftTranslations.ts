/**
 * NFT content translation mapping
 * Provide multilingual support for NFT content on the blockchain
 */

export interface NFTTranslation {
  storyTitle: string;
  storyDetail: string;
}

export interface NFTTranslations {
  [tokenId: string]: {
    zh: NFTTranslation;
    en: NFTTranslation;
  };
}

/**
 * NFT translation database
 * Provide Chinese and English translations based on tokenId
 */
export const nftTranslations: NFTTranslations = {
  // Token ID #4 - Shaanxi Yan'an Xuezhang Small Watershed
  '4': {
    zh: {
      storyTitle: '陕西延安薛张小流域‌',
      storyDetail: '黄河沿岸生态保护工程，通过植树造林、梯田整修等措施，累计产生碳汇增量4.36万吨（15.99万吨CO₂当量），碳减排量2641吨（9683吨CO₂当量），总碳汇量达4.63万吨（16.96万吨CO₂当量），并以543.6万元完成全国最大单笔水土保持碳汇交易'
    },
    en: {
      storyTitle: 'Shaanxi Yan\'an Xuezhang Small Watershed',
      storyDetail: 'Yellow River ecological protection project, through afforestation, terrace renovation and other measures, has cumulatively generated 43,600 tons of carbon sink increment (159,900 tons of CO₂ equivalent), carbon emission reduction of 2,641 tons (9,683 tons of CO₂ equivalent), total carbon sink of 46,300 tons (169,600 tons of CO₂ equivalent), and completed the largest single watershed conservation carbon trading in China with 5.436 million yuan'
    }
  },
  
  // Token ID #3 - Hangzhou Wetland Ecological Project
  '3': {
    zh: {
      storyTitle: '杭州市湿地生态项目',
      storyDetail: '杭州西溪湿地保护与修复工程，通过生态修复、水质改善、生物多样性保护等综合措施，累计恢复湿地面积1200公顷，保护珍稀鸟类150余种，年均碳汇量达2.8万吨CO₂当量，成为城市生态文明建设的典型示范。'
    },
    en: {
      storyTitle: 'Hangzhou Wetland Ecological Project',
      storyDetail: 'Hangzhou Xixi Wetland protection and restoration project, through comprehensive measures including ecological restoration, water quality improvement, and biodiversity conservation, has cumulatively restored 1,200 hectares of wetlands, protected over 150 species of rare birds, with an annual carbon sink of 28,000 tons of CO₂ equivalent, becoming a model demonstration of urban ecological civilization construction.'
    }
  },

  // More NFT translations can be added...
};

/**
 * Get NFT translation content
 * @param tokenId - NFT token ID
 * @param language - Target language ('zh' | 'en')
 * @param originalTitle - Original title (as fallback)
 * @param originalDetail - Original detail (as fallback)
 * @returns Translated NFT content
 */
export function getNFTTranslation(
  tokenId: string,
  language: string,
  originalTitle?: string,
  originalDetail?: string
): NFTTranslation {
  // Get translation mapping
  const translation = nftTranslations[tokenId];
  
  if (translation && translation[language as 'zh' | 'en']) {
    return translation[language as 'zh' | 'en'];
  }
  
  // If no translation found, return original content
  return {
    storyTitle: originalTitle || `NFT #${tokenId}`,
    storyDetail: originalDetail || 'This is an exciting story about environmental action...'
  };
}

/**
 * Check if translation is available
 * @param tokenId - NFT token ID
 * @param language - Target language
 * @returns Whether translation is available
 */
export function hasNFTTranslation(tokenId: string, language: string): boolean {
  const translation = nftTranslations[tokenId];
  return !!(translation && translation[language as 'zh' | 'en']);
}

/**
 * Get all supported NFT token ID list
 * @returns Array of supported token IDs
 */
export function getSupportedNFTIds(): string[] {
  return Object.keys(nftTranslations);
} 