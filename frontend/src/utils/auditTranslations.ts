/**
 * 审计申请内容翻译映射
 * 为链上审计申请内容提供多语言支持
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
 * 审计申请翻译数据库
 * 根据requestId提供中英文翻译
 */
export const auditTranslations: AuditTranslations = {
  // Request ID #1 - 示例申请
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

  // Request ID #2 - 示例申请
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

  // Request ID #3 - 陕西延安薛张小流域项目
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

  // Request ID #4 - 深圳海绵城市项目
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

  // 可以继续添加更多申请的翻译...
};

/**
 * 获取审计申请翻译内容
 * @param requestId - 申请的ID
 * @param language - 目标语言 ('zh' | 'en')
 * @param originalTitle - 原始标题（作为备选）
 * @param originalDetails - 原始详情（作为备选）
 * @param preferOriginal - 是否优先使用原始数据（默认true，优先显示真实链上数据）
 * @returns 翻译后的申请内容
 */
export function getAuditTranslation(
  requestId: string,
  language: string,
  originalTitle?: string,
  originalDetails?: string,
  preferOriginal: boolean = true
): AuditTranslation {
  // 🔥 修复：优先使用真实的链上数据
  if (preferOriginal && originalTitle && originalDetails) {
    // 如果有原始数据且优先使用原始数据，直接返回原始内容
    return {
      title: originalTitle,
      details: originalDetails
    };
  }
  
  // 获取翻译映射
  const translation = auditTranslations[requestId];
  
  if (translation && translation[language as 'zh' | 'en']) {
    return translation[language as 'zh' | 'en'];
  }
  
  // 如果没有找到翻译，返回原始内容
  return {
    title: originalTitle || `Request #${requestId}`,
    details: originalDetails || 'This is an environmental protection project application...'
  };
}

/**
 * 检查是否有翻译可用
 * @param requestId - 申请的ID
 * @param language - 目标语言
 * @returns 是否有翻译可用
 */
export function hasAuditTranslation(requestId: string, language: string): boolean {
  const translation = auditTranslations[requestId];
  return !!(translation && translation[language as 'zh' | 'en']);
}

/**
 * 获取示例翻译数据（当链上数据为空或不可读时使用）
 * @param requestId - 申请的ID
 * @param language - 目标语言 ('zh' | 'en')
 * @returns 示例翻译内容，如果没有则返回null
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
 * 获取所有支持翻译的申请ID列表
 * @returns 支持翻译的申请ID数组
 */
export function getSupportedAuditIds(): string[] {
  return Object.keys(auditTranslations);
} 