@REM 先读取
source .env


@REM 然后执行部署命令
forge script script/Deploy.s.sol:DeployScript ^
--rpc-url %SEPOLIA_RPC_URL% ^
--private-key %PRIVATE_KEY% ^
--broadcast 
--verify 
-vvvv 

@REM 成功部署的版本
forge script script/Deploy.s.sol --rpc-url %SEPOLIA_RPC_URL%.--private-key %PRIVATE_KEY%--broadcast --verify -vvvv

forge script script/Deploy.s.sol --rpc-url "https://eth-sepolia.g.alchemy.com/v2/" --private-key "0x" --broadcast --verify -vvvv --skip-simulation




@REM 老师参考版本
forge script script/Deploy.s.sol:DeployScript \
--chain-id 11155111 \
--rpc-url %SEPOLIA_RPC_URL% \
--etherscan-api-key %ETHERSCAN_API_KEY% \
--broadcast \
--slow \
--verify \
-vvvv 
