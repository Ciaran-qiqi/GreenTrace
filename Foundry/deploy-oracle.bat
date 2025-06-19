@echo off
echo ========================================
echo 部署碳价预言机合约
echo ========================================

:: 设置环境变量
set PRIVATE_KEY=0xd5bf6d8e891ca65623637e6a5e37ac7312dc503847e9292ff831628a78772bc8
set SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/hAep1geH-r3ppdFDXWBK5Ymvmn9Zl7ql

echo 环境变量已设置
echo PRIVATE_KEY: %PRIVATE_KEY:~0,10%...
echo SEPOLIA_RPC_URL: %SEPOLIA_RPC_URL%

echo.
echo 开始部署预言机合约...
echo.

:: 执行部署脚本
forge script script/DeployOracleOnly.s.sol --rpc-url %SEPOLIA_RPC_URL% --broadcast --verify

echo.
echo 部署完成！
pause 