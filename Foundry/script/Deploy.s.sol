// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTrace.sol";
import "../src/GreenTalesMarket.sol";
import "../src/GreenTalesAuction.sol";
import "../src/GreenTalesTender.sol";

contract DeployScript is Script {
    // 部署状态
    bool public carbonTokenDeployed;
    bool public nftDeployed;
    bool public greenTraceDeployed;
    bool public marketDeployed;
    bool public auctionDeployed;
    bool public tenderDeployed;

    // 合约地址
    address public carbonTokenAddress;
    address public nftAddress;
    address public greenTraceAddress;
    address public marketAddress;
    address public auctionAddress;
    address public tenderAddress;

    // 部署参数
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18; // 100万代币
    uint256 public constant PLATFORM_FEE_RATE = 250; // 2.5%
    address public feeCollector;

    // 错误信息
    error DeploymentFailed(string message);
    error InitializationFailed(string message);
    error ValidationFailed(string message);

    /**
     * @dev 环境检查
     * @notice 检查部署环境是否满足要求
     */
    function _checkEnvironment() internal view {
        // 检查链ID
        uint256 chainId = block.chainid;
        require(chainId != 0, "Invalid chain ID");
        
        // 检查部署者地址
        address deployer = msg.sender;
        require(deployer != address(0), "Invalid deployer address");
        
        // 检查手续费接收地址
        require(feeCollector != address(0), "Invalid fee collector address");
        
        console.log(unicode"=== 环境检查通过 ===");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", deployer);
        console.log("Fee Collector:", feeCollector);
    }

    /**
     * @dev 验证合约状态
     * @notice 验证所有合约是否正确部署和初始化
     */
    function validateDeployment() public view {
        // 验证 CarbonToken
        require(carbonTokenAddress != address(0), "Invalid CarbonToken address");
        CarbonToken carbonToken = CarbonToken(carbonTokenAddress);
        require(carbonToken.greenTrace() == greenTraceAddress, "Invalid CarbonToken GreenTrace address");

        // 验证 NFT
        require(nftAddress != address(0), "Invalid NFT address");
        GreenTalesNFT nft = GreenTalesNFT(nftAddress);
        require(nft.greenTrace() == greenTraceAddress, "Invalid NFT GreenTrace address");

        // 验证 GreenTrace
        require(greenTraceAddress != address(0), "Invalid GreenTrace address");
        GreenTrace greenTrace = GreenTrace(greenTraceAddress);
        require(greenTrace.initialized(), "GreenTrace not initialized");
        require(address(greenTrace.greenTalesNFT()) == nftAddress, "Invalid GreenTrace NFT address");
        require(address(greenTrace.carbonToken()) == carbonTokenAddress, "Invalid GreenTrace CarbonToken address");

        // 验证 Market
        require(marketAddress != address(0), "Invalid Market address");
        GreenTalesMarket market = GreenTalesMarket(marketAddress);
        require(address(market.carbonToken()) == carbonTokenAddress, "Invalid Market CarbonToken address");
        require(address(market.nftContract()) == nftAddress, "Invalid Market NFT address");

        // 验证 Auction
        require(auctionAddress != address(0), "Invalid Auction address");
        GreenTalesAuction auction = GreenTalesAuction(auctionAddress);
        require(address(auction.carbonToken()) == carbonTokenAddress, "Invalid Auction CarbonToken address");
        require(address(auction.greenTalesNFT()) == nftAddress, "Invalid Auction NFT address");

        // 验证 Tender
        require(tenderAddress != address(0), "Invalid Tender address");
        GreenTalesTender tender = GreenTalesTender(tenderAddress);
        require(address(tender.carbonToken()) == carbonTokenAddress, "Invalid Tender CarbonToken address");
        require(address(tender.greenTalesNFT()) == nftAddress, "Invalid Tender NFT address");

        console.log(unicode"=== 合约状态验证通过 ===");
    }

    function setUp() public {
        // 设置手续费接收地址为部署者
        feeCollector = msg.sender;
        
        // 打印当前部署状态
        console.log(unicode"=== 当前部署状态 ===");
        console.log(unicode"CarbonToken:", carbonTokenDeployed ? unicode"已部署" : unicode"未部署");
        console.log(unicode"NFT:", nftDeployed ? unicode"已部署" : unicode"未部署");
        console.log(unicode"GreenTrace:", greenTraceDeployed ? unicode"已部署" : unicode"未部署");
        console.log(unicode"Market:", marketDeployed ? unicode"已部署" : unicode"未部署");
        console.log(unicode"Auction:", auctionDeployed ? unicode"已部署" : unicode"未部署");
        console.log(unicode"Tender:", tenderDeployed ? unicode"已部署" : unicode"未部署");
        console.log(unicode"==================");
    }

    function run() external {
        // 环境检查
        _checkEnvironment();

        // 部署 CarbonToken
        vm.startBroadcast();
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(feeCollector, INITIAL_SUPPLY);
        CarbonToken carbonToken = new CarbonToken(initialBalances);
        carbonTokenAddress = address(carbonToken);
        carbonTokenDeployed = true;
        vm.stopBroadcast();
        console.log(unicode"CarbonToken 部署成功！地址:", carbonTokenAddress);

        // 部署 GreenTrace
        vm.startBroadcast();
        GreenTrace greenTrace = new GreenTrace(carbonTokenAddress, address(0));
        greenTraceAddress = address(greenTrace);
        greenTraceDeployed = true;
        vm.stopBroadcast();
        console.log(unicode"GreenTrace 部署成功！地址:", greenTraceAddress);

        // 部署 NFT
        vm.startBroadcast();
        GreenTalesNFT nft = new GreenTalesNFT(greenTraceAddress);
        nftAddress = address(nft);
        nftDeployed = true;
        vm.stopBroadcast();
        console.log(unicode"GreenTalesNFT 部署成功！地址:", nftAddress);

        // 初始化合约
        vm.startBroadcast();
        
        // 设置 NFT 的 GreenTrace 地址
        GreenTalesNFT(nftAddress).setGreenTrace(greenTraceAddress);
        
        // 设置 CarbonToken 的 GreenTrace 地址
        CarbonToken(carbonTokenAddress).setGreenTrace(greenTraceAddress);
        
        // 设置 GreenTrace 的 NFT 地址
        GreenTrace(greenTraceAddress).setNFTContract(nftAddress);
        
        // 初始化 GreenTrace
        GreenTrace(greenTraceAddress).initialize();
        
        // 部署并初始化 Market
        GreenTalesMarket market = new GreenTalesMarket(
            nftAddress,
            carbonTokenAddress,
            PLATFORM_FEE_RATE,
            feeCollector,
            greenTraceAddress
        );
        marketAddress = address(market);
        marketDeployed = true;
        
        // 部署并初始化 Auction
        GreenTalesAuction auction = new GreenTalesAuction(
            carbonTokenAddress,
            nftAddress,
            greenTraceAddress,
            feeCollector
        );
        auctionAddress = address(auction);
        auctionDeployed = true;
        
        // 部署并初始化 Tender
        GreenTalesTender tender = new GreenTalesTender(
            carbonTokenAddress,
            nftAddress,
            greenTraceAddress,
            feeCollector
        );
        tenderAddress = address(tender);
        tenderDeployed = true;
        
        // 添加业务合约到白名单
        GreenTrace(greenTraceAddress).addBusinessContract(marketAddress);
        GreenTrace(greenTraceAddress).addBusinessContract(auctionAddress);
        GreenTrace(greenTraceAddress).addBusinessContract(tenderAddress);
        
        vm.stopBroadcast();
        console.log(unicode"合约初始化成功");
        console.log(unicode"Market 地址:", marketAddress);
        console.log(unicode"Auction 地址:", auctionAddress);
        console.log(unicode"Tender 地址:", tenderAddress);

        // 验证部署结果
        require(carbonTokenAddress != address(0), "Invalid CarbonToken address");
        require(carbonToken.greenTrace() == greenTraceAddress, "Invalid CarbonToken GreenTrace address");
        require(nftAddress != address(0), "Invalid NFT address");
        require(nft.greenTrace() == greenTraceAddress, "Invalid NFT GreenTrace address");
        require(greenTraceAddress != address(0), "Invalid GreenTrace address");
        require(greenTrace.initialized(), "GreenTrace not initialized");
        require(address(greenTrace.greenTalesNFT()) == nftAddress, "Invalid GreenTrace NFT address");
        require(address(greenTrace.carbonToken()) == carbonTokenAddress, "Invalid GreenTrace CarbonToken address");
        require(marketAddress != address(0), "Invalid Market address");
        require(address(market.carbonToken()) == carbonTokenAddress, "Invalid Market CarbonToken address");
        require(address(market.nftContract()) == nftAddress, "Invalid Market NFT address");
        require(auctionAddress != address(0), "Invalid Auction address");
        require(address(auction.carbonToken()) == carbonTokenAddress, "Invalid Auction CarbonToken address");
        require(address(auction.greenTalesNFT()) == nftAddress, "Invalid Auction NFT address");
        require(tenderAddress != address(0), "Invalid Tender address");
        require(address(tender.carbonToken()) == carbonTokenAddress, "Invalid Tender CarbonToken address");
        require(address(tender.greenTalesNFT()) == nftAddress, "Invalid Tender NFT address");
        console.log(unicode"=== 合约状态验证通过 ===");

        // 打印最终状态
        console.log(unicode"=== 最终部署状态 ===");
        console.log("CarbonToken:", carbonTokenAddress);
        console.log("NFT:", nftAddress);
        console.log("GreenTrace:", greenTraceAddress);
        console.log("Market:", marketAddress);
        console.log("Auction:", auctionAddress);
        console.log("Tender:", tenderAddress);
    }
} 