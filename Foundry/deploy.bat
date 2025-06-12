@echo off
echo Loading environment variables...
for /f "tokens=*" %%a in (.env) do set %%a

echo.
echo Checking required environment variables...

set "missing_vars="
if not defined PRIVATE_KEY (
    set "missing_vars=!missing_vars!PRIVATE_KEY "
)
if not defined SEPOLIA_RPC_URL (
    set "missing_vars=!missing_vars!SEPOLIA_RPC_URL "
)

if defined missing_vars (
    echo Error: Missing required environment variables: %missing_vars%
    echo Please check your .env file
    pause
    exit /b 1
)

echo Environment variables loaded successfully:
echo PRIVATE_KEY: %PRIVATE_KEY:~0,6%...%PRIVATE_KEY:~-4%
echo SEPOLIA_RPC_URL: %SEPOLIA_RPC_URL%
echo.

echo Choose contract to deploy:
echo 1. CarbonToken
echo 2. NFT
echo 3. GreenTrace
echo 4. Market
echo 5. Auction
echo 6. Initialize
echo 7. Deploy All
echo.

set /p choice=Enter option (1-7): 

if "%choice%"=="1" (
    forge script script/Deploy.s.sol:DeployScript --rpc-url %SEPOLIA_RPC_URL% --broadcast --private-key %PRIVATE_KEY% --sig "deployCarbonToken()" --legacy --timeout 300
) else if "%choice%"=="2" (
    forge script script/Deploy.s.sol:DeployScript --rpc-url %SEPOLIA_RPC_URL% --broadcast --private-key %PRIVATE_KEY% --sig "deployNFT()" --legacy --timeout 300
) else if "%choice%"=="3" (
    forge script script/Deploy.s.sol:DeployScript --rpc-url %SEPOLIA_RPC_URL% --broadcast --private-key %PRIVATE_KEY% --sig "deployGreenTrace()" --legacy --timeout 300
) else if "%choice%"=="4" (
    forge script script/Deploy.s.sol:DeployScript --rpc-url %SEPOLIA_RPC_URL% --broadcast --private-key %PRIVATE_KEY% --sig "deployMarket()" --legacy --timeout 300
) else if "%choice%"=="5" (
    forge script script/Deploy.s.sol:DeployScript --rpc-url %SEPOLIA_RPC_URL% --broadcast --private-key %PRIVATE_KEY% --sig "deployAuction()" --legacy --timeout 300
) else if "%choice%"=="6" (
    forge script script/Deploy.s.sol:DeployScript --rpc-url %SEPOLIA_RPC_URL% --broadcast --private-key %PRIVATE_KEY% --sig "initializeContracts()" --legacy --timeout 300
) else if "%choice%"=="7" (
    forge script script/Deploy.s.sol:DeployScript --rpc-url %SEPOLIA_RPC_URL% --broadcast --private-key %PRIVATE_KEY% --sig "run()" --legacy --timeout 300
) else (
    echo Invalid option!
) 