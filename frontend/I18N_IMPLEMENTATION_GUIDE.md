# GreenTrace i18n 国际化实现指南

## 🌐 系统概述

GreenTrace项目现已集成了完整的i18n（国际化）系统，支持中英文双语切换，提供了可靠、美观的多语言用户体验。

### ✨ 核心特性

- **🚀 动态语言切换** - 无需刷新页面即可切换语言
- **💾 持久化存储** - 语言偏好自动保存到localStorage
- **🔄 智能回退** - 翻译缺失时智能回退到默认语言
- **⚡ 性能优化** - 翻译文件缓存和预加载机制
- **🎨 美观界面** - 提供下拉菜单和按钮组两种语言切换器样式
- **📱 响应式设计** - 桌面端和移动端都有适配的语言切换器

## 📁 文件架构

```
src/
├── lib/
│   └── i18n.ts                 # i18n核心配置和工具函数
├── hooks/
│   └── useI18n.tsx            # React Hook和Context Provider
├── components/
│   ├── LanguageToggle.tsx     # 语言切换组件
│   └── Navigation.tsx         # 已集成i18n的导航组件
├── app/
│   └── layout.tsx             # 根布局(已集成I18nProvider)
└── messages/
    ├── zh.json                # 中文翻译文件
    └── en.json                # 英文翻译文件
```

## 🛠️ 系统配置

### 支持的语言
- **中文 (zh)** - 默认语言 🇨🇳
- **英文 (en)** - 国际化语言 🇺🇸

### 配置选项
```typescript
export const I18N_CONFIG = {
  defaultLanguage: 'zh' as Language,     // 默认语言
  supportedLanguages: ['zh', 'en'],      // 支持的语言列表
  storageKey: 'greentrace-language',     // localStorage存储键
  fallbackLanguage: 'zh' as Language,   // 回退语言
};
```

## 🔧 使用方法

### 1. 基础翻译使用

```tsx
import { useTranslation } from '@/hooks/useI18n';

export const MyComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('navigation.home', '🏠 首页')}</h1>
      <p>{t('common.loading', '加载中...')}</p>
    </div>
  );
};
```

### 2. 语言切换组件

```tsx
import { LanguageToggle } from '@/components/LanguageToggle';

// 下拉菜单样式
<LanguageToggle 
  style="dropdown" 
  size="md" 
  showFlag={true} 
  showName={true}
/>

// 按钮组样式
<LanguageToggle 
  style="buttons" 
  size="sm" 
  showFlag={true} 
  showName={false}
/>
```

### 3. 参数化翻译

```tsx
const { t } = useTranslation();

// 翻译文件中: "welcome": "欢迎 {{name}}，您有 {{count}} 条消息"
const message = t('welcome', '欢迎用户', { 
  name: 'John', 
  count: 5 
});
// 结果: "欢迎 John，您有 5 条消息"
```

### 4. 嵌套键访问

```tsx
const { t } = useTranslation();

// 访问嵌套的翻译键
const homeTitle = t('navigation.home', '首页');           // "🏠 首页"
const adminRole = t('navigation.roles.admin', '管理员');  // "管理员"
```

## 📝 翻译文件结构

### 中文翻译 (`messages/zh.json`)

```json
{
  "common": {
    "loading": "加载中...",
    "error": "错误",
    "success": "成功"
  },
  "navigation": {
    "home": "🏠 首页",
    "carbonMarket": "📈 碳币市场",
    "roles": {
      "admin": "管理员",
      "auditor": "审计员"
    }
  }
}
```

### 英文翻译 (`messages/en.json`)

```json
{
  "common": {
    "loading": "Loading...",
    "error": "Error", 
    "success": "Success"
  },
  "navigation": {
    "home": "🏠 Home",
    "carbonMarket": "📈 Carbon Market",
    "roles": {
      "admin": "Administrator",
      "auditor": "Auditor"
    }
  }
}
```

## 🎯 实际应用示例

### Navigation组件集成

导航组件已完全集成i18n功能：

```tsx
// 原来的硬编码中文
<span>🏠 首页</span>
<span>📈 碳币市场</span>
<span>🔍 审计中心</span>

// 现在的i18n版本
<span>{t('navigation.home', '🏠 首页')}</span>
<span>{t('navigation.carbonMarket', '📈 碳币市场')}</span>
<span>{t('navigation.auditCenter', '🔍 审计中心')}</span>
```

### 路由映射确认

| 中文显示 | 英文显示 | 路由路径 | 翻译键 |
|---------|---------|---------|--------|
| 🏠 首页 | 🏠 Home | `/` | `navigation.home` |
| 📈 碳币市场 | 📈 Carbon Market | `/carbon-market` | `navigation.carbonMarket` |
| 🌱 NFT创建 | 🌱 NFT Creation | `/created` | `navigation.created` |
| 🛒 NFT市场 | 🛒 NFT Market | `/market` | `navigation.nftMarket` |
| 💼 我的资产 | 💼 My Assets | `/assets` | `navigation.assets` |
| 🏪 我的挂单 | 🏪 My Listings | `/my-listings` | `navigation.myListings` |
| 💧 流动性池 | 💧 Liquidity Pool | `/liquidity` | `navigation.liquidityPool` |
| 🔄 NFT兑换 | 🔄 NFT Exchange | `/exchange` | `navigation.nftExchange` |
| 🔍 审计中心 | 🔍 Audit Center | `/audit` | `navigation.auditCenter` |
| ⚙️ 管理中心 | ⚙️ Admin Center | `/admin` | `navigation.adminCenter` |

## 🎨 语言切换器样式

### 下拉菜单样式
- **位置**: 桌面端导航栏右侧
- **样式**: 白色半透明背景，毛玻璃效果
- **交互**: 点击展开下拉菜单，支持键盘导航
- **指示器**: 当前语言高亮显示，加载时显示动画

### 按钮组样式
- **位置**: 移动端导航菜单顶部
- **样式**: 分段控制器样式，当前语言背景高亮
- **交互**: 直接点击切换，无下拉菜单
- **指示器**: 当前语言绿色背景，加载时显示旋转动画

## 🔍 调试和监控

### 控制台日志
系统会输出详细的日志信息：

```
🌐 开始加载语言: en
✅ 翻译文件加载成功: en
🔄 语言切换: zh → en
🌍 当前语言: en, 翻译数据可用: true
```

### 缓存信息查看
```typescript
import { getCacheInfo } from '@/lib/i18n';

console.log(getCacheInfo());
// 输出: { cacheSize: 2, cachedLanguages: ['zh', 'en'], supportedLanguages: ['zh', 'en'] }
```

## 🚀 性能优化特性

1. **翻译文件缓存** - 加载过的翻译文件会缓存在内存中
2. **预加载机制** - 可选择在应用启动时预加载所有语言
3. **动态导入** - 翻译文件按需加载，减少初始包大小
4. **智能回退** - 翻译缺失时自动使用回退语言或回退文本
5. **本地存储** - 用户语言偏好持久化，下次访问时保持设置

## 📱 移动端适配

- **响应式语言切换器** - 桌面端显示下拉菜单，移动端显示按钮组
- **触控优化** - 移动端按钮更大，易于触控操作
- **布局适配** - 移动端导航菜单中集成语言切换器

## 🔧 扩展指南

### 添加新语言

1. 在 `messages/` 目录下创建新的翻译文件 (如 `ja.json`)
2. 更新 `I18N_CONFIG.supportedLanguages` 数组
3. 在 `LANGUAGE_CONFIG` 中添加语言显示配置
4. 更新 `Language` 类型定义

### 添加新翻译键

1. 在所有语言的翻译文件中添加相同的键
2. 确保键名使用嵌套结构组织
3. 在组件中使用 `t('new.key', '默认文本')` 调用

### 自定义语言切换器

```tsx
import { useLanguageSwitch } from '@/hooks/useI18n';

const CustomLanguageToggle = () => {
  const { currentLanguage, changeLanguage, isChanging } = useLanguageSwitch();
  
  return (
    <button onClick={() => changeLanguage(currentLanguage === 'zh' ? 'en' : 'zh')}>
      {currentLanguage === 'zh' ? '中文' : 'English'}
    </button>
  );
};
```

## ✅ 最佳实践

1. **总是提供回退文本** - `t('key', '默认文本')`
2. **使用有意义的键名** - `navigation.home` 而不是 `nav1`
3. **保持翻译文件同步** - 所有语言文件应包含相同的键
4. **避免在翻译中使用HTML** - 使用参数化替换代替
5. **测试所有语言** - 确保UI在不同语言下都能正常显示
6. **考虑文本长度差异** - 不同语言的文本长度可能差异很大

## 🎯 迁移现有代码

将现有的硬编码中文文本迁移到i18n系统：

```tsx
// 原代码
<h1>碳币交易中心</h1>
<button>立即购买</button>

// 迁移后
import { useTranslation } from '@/hooks/useI18n';

const { t } = useTranslation();

<h1>{t('carbon.tradingCenter', '碳币交易中心')}</h1>
<button>{t('market.buyNow', '立即购买')}</button>
```

## 🎉 总结

GreenTrace的i18n系统提供了：
- **完整的多语言支持**
- **美观的用户界面**
- **优秀的开发体验**
- **高性能的运行效率**
- **易于维护和扩展**

现在您的项目已经具备了国际化的能力，可以轻松地为全球用户提供本地化的体验！🌍✨ 