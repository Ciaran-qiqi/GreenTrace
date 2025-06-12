@echo off
for /f "tokens=*" %%a in (.env) do set %%a
forge script script/Deploy.s.sol:DeployScript --rpc-url https://sepolia.infura.io/v3/709ad8f74ca84d26ab30bf6828e6c9f4 --broadcast --verify --legacy --timeout 300 