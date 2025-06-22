@echo off
echo ========================================
echo GreenTrace Remaining Contracts Deployment Script
echo ========================================

echo Starting deployment of GreenTalesLiquidityPool and CarbonUSDTMarket...

forge script script/DeployRemainingContracts.s.sol ^
--rpc-url "https://eth-sepolia.g.alchemy.com/v2/hAep1geH-r3ppdFDXWBK5Ymvmn9Zl7ql" ^
--private-key "0xd5bf6d8e891ca65623637e6a5e37ac7312dc503847e9292ff831628a78772bc8" ^
--broadcast ^
--verify ^
-vvvv ^
--skip-simulation

echo.
echo ========================================
echo Deployment completed!
echo ========================================
echo.
echo Please record the new contract addresses and update the initialization script.
echo Next step: Run InitializeLiquidityPool.s.sol to initialize the liquidity pool
echo.
pause 