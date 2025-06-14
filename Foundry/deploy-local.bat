@REM 先读取env权限
source .env.local

@REM 运行本地部署命令 失败的版本
forge script script/Deploy.s.sol:DeployScript `
--rpc-url http://localhost:8545 `
--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 `
--broadcast `
-vvvv


@REM 成功的版本
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast -vvvv
