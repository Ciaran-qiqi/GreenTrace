REM 先读取
source .env
REM 然后执行部署命令
forge script script/Deploy.s.sol:DeployScript ^
--rpc-url %SEPOLIA_RPC_URL% 
--private-key %PRIVATE_KEY% 
--broadcast 
--verify 
-vvvv 

REM 成功部署的版本
forge script script/Deploy.s.sol --rpc-url %SEPOLIA_RPC_URL%.--private-key %PRIVATE_KEY%--broadcast --verify -vvvv


@REM 写死环境的版本
forge script script/Deploy.s.sol --rpc-url "https://eth-sepolia.g.alchemy.com/v2/" --private-key "0x" --broadcast --verify -vvvv



REM mac 版本(TOML配置)
forge script script/DeployRemainingContracts.s.sol:DeployRemainingContracts \
    --chain-id 11155111 \
    --rpc-url sepolia  \
    --etherscan-api-key sepolia \
    --broadcast \
    --slow \
    --verify \
    -vvvv

REM win bash 版本(TOML配置)
dotenv -e .env -- forge script script/DeployRemainingContracts.s.sol:DeployRemainingContracts \
    --chain-id 11155111 \
    --rpc-url sepolia  \
    --etherscan-api-key sepolia \
    --broadcast \
    --slow \
    --verify \
    -vvvv

