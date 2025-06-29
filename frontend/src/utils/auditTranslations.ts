/**
 * Audit application content translation mapping
 * Provide multilingual support for on-chain audit application content
 */

export interface AuditTranslation {
  title: string;
  details: string;
}

export interface AuditTranslations {
  [requestId: string]: {
    zh: AuditTranslation;
    en: AuditTranslation;
  };
}

/**
 * Audit application translation database
 * Provide Chinese and English translations based on requestId
 */
export const auditTranslations: AuditTranslations = {
  // Request ID #1 - Example application
  '1': {
    zh: {
      title: '杭州西湖区垃圾分类示范项目',
      details: '在杭州西湖区开展垃圾分类示范项目，通过设置智能分类垃圾桶、开展社区宣传教育活动，提高居民垃圾分类意识和参与度。项目覆盖10个小区，涉及5000余户家庭，预计年减少垃圾填埋量1200吨，减少甲烷排放150吨CO₂当量。'
    },
    en: {
      title: 'Hangzhou Xihu District Waste Classification Demonstration Project',
      details: 'Implemented a waste classification demonstration project in Xihu District, Hangzhou, by installing smart sorting bins and conducting community education campaigns to improve residents\' awareness and participation in waste sorting. The project covers 10 residential communities involving over 5,000 households, expected to reduce landfill waste by 1,200 tons annually and methane emissions by 150 tons of CO₂ equivalent.'
    }
  },

  // Request ID #2 - Example application
  '2': {
    zh: {
      title: '上海浦东新区屋顶绿化碳汇项目',
      details: '在上海浦东新区推进屋顶绿化碳汇项目，在商务楼宇和住宅建筑屋顶建设绿色植被覆盖系统。项目总面积达8万平方米，种植各类植物15万株，年均碳汇量达320吨CO₂当量，同时改善城市热岛效应，降低建筑能耗约15%。'
    },
    en: {
      title: 'Shanghai Pudong New Area Rooftop Greening Carbon Sink Project',
      details: 'Promoted rooftop greening carbon sink project in Pudong New Area, Shanghai, by establishing green vegetation coverage systems on commercial buildings and residential rooftops. The project covers a total area of 80,000 square meters with 150,000 plants of various species, achieving an annual carbon sink of 320 tons of CO₂ equivalent while mitigating urban heat island effects and reducing building energy consumption by approximately 15%.'
    }
  },

  // Request ID #3 - Shaanxi Yan'an Xuezhang Small Watershed Project
  '3': {
    zh: {
      title: '陕西延安薛张小流域水土保持碳汇项目',
      details: '黄河沿岸生态保护工程，通过植树造林、梯田整修等措施，累计产生碳汇增量4.36万吨（15.99万吨CO₂当量），碳减排量2641吨（9683吨CO₂当量），总碳汇量达4.63万吨（16.96万吨CO₂当量），并以543.6万元完成全国最大单笔水土保持碳汇交易。'
    },
    en: {
      title: 'Shaanxi Yan\'an Xuezhang Small Watershed Soil and Water Conservation Carbon Sink Project',
      details: 'Yellow River ecological protection project, through afforestation, terrace renovation and other measures, has cumulatively generated 43,600 tons of carbon sink increment (159,900 tons of CO₂ equivalent), carbon emission reduction of 2,641 tons (9,683 tons of CO₂ equivalent), total carbon sink of 46,300 tons (169,600 tons of CO₂ equivalent), and completed the largest single watershed conservation carbon trading in China with 5.436 million yuan.'
    }
  },

  // Request ID #4 - Shenzhen Sponge City Project
  '4': {
    zh: {
      title: '深圳福田区海绵城市建设项目',
      details: '深圳福田区海绵城市建设项目，通过建设透水铺装、雨水花园、生态湿地等设施，提升城市雨水收集利用能力。项目覆盖CBD核心区域15平方公里，年雨水收集利用量达500万立方米，减少城市径流污染85%，年均碳汇量达180吨CO₂当量。'
    },
    en: {
      title: 'Shenzhen Futian District Sponge City Construction Project',
      details: 'Sponge city construction project in Futian District, Shenzhen, enhancing urban rainwater collection and utilization capacity through permeable pavement, rain gardens, and ecological wetlands. The project covers 15 square kilometers of CBD core area, achieving annual rainwater collection and utilization of 5 million cubic meters, reducing urban runoff pollution by 85%, with an average annual carbon sink of 180 tons of CO₂ equivalent.'
    }
  },

  // More application translations can be added...
};

/**
 * Get audit application translation content
 * @param requestId - Application ID
 * @param language - Target language ('zh' | 'en')
 * @param originalTitle - Original title (as fallback)
 * @param originalDetails - Original details (as fallback)
 * @param preferOriginal - Whether to prefer original data (default true, show real on-chain data first)
 * @returns Translated application content
 */
export function getAuditTranslation(
  requestId: string,
  language: string,
  originalTitle?: string,
  originalDetails?: string,
  preferOriginal: boolean = true
): AuditTranslation {
  // 🔥 Fix: Prefer real on-chain data
  if (preferOriginal && originalTitle && originalDetails) {
    // If original data exists and preferOriginal is true, return original content
    return {
      title: originalTitle,
      details: originalDetails
    };
  }
  
  // Get translation mapping
  const translation = auditTranslations[requestId];
  
  if (translation && translation[language as 'zh' | 'en']) {
    return translation[language as 'zh' | 'en'];
  }
  
  // If no translation found, return original content
  return {
    title: originalTitle || `Request #${requestId}`,
    details: originalDetails || 'This is an environmental protection project application...'
  };
}

/**
 * Check if translation is available
 * @param requestId - Application ID
 * @param language - Target language
 * @returns Whether translation is available
 */
export function hasAuditTranslation(requestId: string, language: string): boolean {
  const translation = auditTranslations[requestId];
  return !!(translation && translation[language as 'zh' | 'en']);
}

/**
 * Get example translation data (used when on-chain data is empty or unreadable)
 * @param requestId - Application ID
 * @param language - Target language ('zh' | 'en')
 * @returns Example translation content, or null if not found
 */
export function getExampleTranslation(
  requestId: string,
  language: string
): AuditTranslation | null {
  const translation = auditTranslations[requestId];
  
  if (translation && translation[language as 'zh' | 'en']) {
    return translation[language as 'zh' | 'en'];
  }
  
  return null;
}

/**
 * Get all supported application ID list
 * @returns Array of supported application IDs
 */
export function getSupportedAuditIds(): string[] {
  return Object.keys(auditTranslations);
} 