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
      "@typescript-eslint/no-explicit-any": "warn", // 将any类型从错误改为警告
      "@typescript-eslint/no-unsafe-assignment": "off", // 关闭不安全赋值检查
      "@typescript-eslint/no-unsafe-return": "off", // 关闭不安全返回检查
    },
  },
];

export default eslintConfig;
