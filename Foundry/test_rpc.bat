@echo off
echo 获取当前区块号：
curl -X POST -H "Content-Type: application/json" --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}" https://sepolia.infura.io/v3/709ad8f74ca84d26ab30bf6828e6c9f4
echo.
echo 获取gas价格：
curl -X POST -H "Content-Type: application/json" --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_gasPrice\",\"params\":[],\"id\":1}" https://sepolia.infura.io/v3/709ad8f74ca84d26ab30bf6828e6c9f4 