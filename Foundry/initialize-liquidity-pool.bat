@echo off
echo ========================================
echo GreenTrace 流动性池初始化脚本
echo ========================================

echo 注意：请先更新 script/InitializeLiquidityPool.s.sol 中的 LIQUIDITY_POOL 地址
echo 然后按任意键继续...
pause

echo 开始初始化流动性池...

forge script script/InitializeLiquidityPool.s.sol ^
--rpc-url "https://eth-sepolia.g.alchemy.com/v2/hAep1geH-r3ppdFDXWBK5Ymvmn9Zl7ql" ^
--private-key "0xd5bf6d8e891ca65623637e6a5e37ac7312dc503847e9292ff831628a78772bc8" ^
--broadcast ^
-vvvv ^
--skip-simulation

echo.
echo ========================================
echo 初始化完成！
echo ========================================
echo.
echo 流动性池已初始化，可以开始测试功能了。
echo.
pause 