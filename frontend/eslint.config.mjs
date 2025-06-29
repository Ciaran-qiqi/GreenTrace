import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 全局忽略 any 类型警告
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      
      // 忽略未使用变量的警告（在开发过程中很常见）
      "@typescript-eslint/no-unused-vars": "warn",
      
      // 忽略 React Hook 依赖警告（在复杂场景下很难避免）
      "react-hooks/exhaustive-deps": "warn",
      
      // 移除需要类型信息的规则，避免构建错误
      // "@typescript-eslint/no-non-null-assertion": "warn",
      // "@typescript-eslint/prefer-nullish-coalescing": "warn",
      // "@typescript-eslint/prefer-optional-chain": "warn",
    },
  },
];

export default eslintConfig;
