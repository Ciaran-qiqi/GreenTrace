@echo off
echo 测试预言机获取碳价...
cast send 0x4a201AfC160e8a2D3a06F22a3d3f914053A6bCbf "requestCarbonPrice()" --private-key 0xd5bf6d8e891ca65623637e6a5e37ac7312dc503847e9292ff831628a78772bc8 --rpc-url https://eth-sepolia.g.alchemy.com/v2/hAep1geH-r3ppdFDXWBK5Ymvmn9Zl7ql
pause 