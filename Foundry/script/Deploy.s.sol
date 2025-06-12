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

    // 部署文档路径
    string constant DEPLOY_DOC_PATH = "deployment.md";

    // 错误信息
    error DeploymentFailed(string message);
    error InitializationFailed(string message);
    error ValidationFailed(string message);

    /**
     * @dev 环境检查
     * @notice 检查部署环境是否满足要求
     */
    function checkEnvironment() internal view {
        // 检查链ID
        uint256 chainId = block.chainid;
        require(chainId != 0, "Invalid chain ID");
        
        // 检查部署者地址
        require(msg.sender != address(0), "Invalid deployer address");
        
        // 检查手续费接收地址
        require(feeCollector != address(0), "Invalid fee collector address");
        
        console.log(unicode"=== 环境检查通过 ===");
        console.log("Chain ID:", chainId);
        console.log("Deployer:", msg.sender);
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
        // 设置手续费接收地址
        feeCollector = msg.sender;
        
        // 打印当前部署状态
        console.log(unicode"=== 当前部署状态 ===");
        console.log("CarbonToken:", carbonTokenDeployed ? unicode"已部署" : unicode"未部署");
        console.log("NFT:", nftDeployed ? unicode"已部署" : unicode"未部署");
        console.log("GreenTrace:", greenTraceDeployed ? unicode"已部署" : unicode"未部署");
        console.log("Market:", marketDeployed ? unicode"已部署" : unicode"未部署");
        console.log("Auction:", auctionDeployed ? unicode"已部署" : unicode"未部署");
        console.log("Tender:", tenderDeployed ? unicode"已部署" : unicode"未部署");
        console.log(unicode"==================");
    }

    /**
     * @dev 记录部署信息到文档
     * @param content 要记录的内容
     */
    function logToDeployDoc(string memory content) internal {
        string memory deployDoc = vm.readFile(DEPLOY_DOC_PATH);
        vm.writeFile(DEPLOY_DOC_PATH, string.concat(deployDoc, content, "\n"));
    }

    /**
     * @dev 记录部署错误到文档
     * @param contractName 合约名称
     * @param error 错误信息
     */
    function logDeployError(string memory contractName, string memory error) internal {
        string memory content = string.concat(
            unicode"### 部署错误\n",
            unicode"- 合约: ", contractName, "\n",
            unicode"- 时间: ", vm.toString(block.timestamp), "\n",
            unicode"- 错误: ", error, "\n",
            "---\n"
        );
        logToDeployDoc(content);
    }

    /**
     * @dev 记录合约部署信息到文档
     * @param contractName 合约名称
     * @param contractAddress 合约地址
     */
    function logDeploySuccess(string memory contractName, address contractAddress) internal {
        string memory content = string.concat(
            unicode"### 部署成功\n",
            unicode"- 合约: ", contractName, "\n",
            unicode"- 地址: ", vm.toString(contractAddress), "\n",
            unicode"- 时间: ", vm.toString(block.timestamp), "\n",
            "---\n"
        );
        logToDeployDoc(content);
    }

    function run() external {
        // 创建部署文档
        string memory header = string.concat(
            unicode"# 部署文档\n\n",
            unicode"## 部署信息\n",
            unicode"- 网络: ", vm.toString(block.chainid), "\n",
            unicode"- 部署时间: ", vm.toString(block.timestamp), "\n",
            unicode"- 部署者: ", vm.toString(msg.sender), "\n",
            "---\n\n"
        );
        vm.writeFile(DEPLOY_DOC_PATH, header);

        // 环境检查
        checkEnvironment();

        // 部署 CarbonToken
        try this.deployCarbonToken() {
            console.log(unicode"CarbonToken 部署成功！地址:", carbonTokenAddress);
            logDeploySuccess("CarbonToken", carbonTokenAddress);
        } catch Error(string memory reason) {
            logDeployError("CarbonToken", reason);
            revert DeploymentFailed(reason);
        }

        // 部署 GreenTrace
        try this.deployGreenTrace() {
            console.log(unicode"GreenTrace 部署成功！地址:", greenTraceAddress);
            logDeploySuccess("GreenTrace", greenTraceAddress);
        } catch Error(string memory reason) {
            logDeployError("GreenTrace", reason);
            revert DeploymentFailed(reason);
        }

        // 部署 NFT
        try this.deployNFT() {
            console.log(unicode"GreenTalesNFT 部署成功！地址:", nftAddress);
            logDeploySuccess("GreenTalesNFT", nftAddress);
        } catch Error(string memory reason) {
            logDeployError("GreenTalesNFT", reason);
            revert DeploymentFailed(reason);
        }

        // 初始化合约
        try this.initializeContracts() {
            console.log(unicode"合约初始化成功");
            logDeploySuccess("Market", marketAddress);
            logDeploySuccess("Auction", auctionAddress);
            logDeploySuccess("Tender", tenderAddress);
        } catch Error(string memory reason) {
            logDeployError("Contract Initialization", reason);
            revert InitializationFailed(reason);
        }

        // 验证部署结果
        try this.validateDeployment() {
            console.log(unicode"=== 合约状态验证通过 ===");
            logToDeployDoc(unicode"## 部署验证\n- 状态: 验证通过\n");
        } catch Error(string memory reason) {
            logToDeployDoc(string.concat(unicode"## 部署验证\n- 状态: 验证失败\n- 原因: ", reason, "\n"));
            revert ValidationFailed(reason);
        }

        // 记录最终状态
        string memory finalState = string.concat(
            unicode"## 最终部署状态\n",
            unicode"- CarbonToken: ", vm.toString(carbonTokenAddress), "\n",
            unicode"- NFT: ", vm.toString(nftAddress), "\n",
            unicode"- GreenTrace: ", vm.toString(greenTraceAddress), "\n",
            unicode"- Market: ", vm.toString(marketAddress), "\n",
            unicode"- Auction: ", vm.toString(auctionAddress), "\n",
            unicode"- Tender: ", vm.toString(tenderAddress), "\n"
        );
        logToDeployDoc(finalState);
    }

    /**
     * @dev 部署 CarbonToken 合约
     */
    function deployCarbonToken() external {
        vm.startBroadcast();
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(feeCollector, INITIAL_SUPPLY);
        CarbonToken carbonToken = new CarbonToken(initialBalances);
        carbonTokenAddress = address(carbonToken);
        carbonTokenDeployed = true;
        vm.stopBroadcast();
    }

    /**
     * @dev 部署 GreenTrace 合约
     */
    function deployGreenTrace() external {
        vm.startBroadcast();
        GreenTrace greenTrace = new GreenTrace(carbonTokenAddress, address(0));
        greenTraceAddress = address(greenTrace);
        greenTraceDeployed = true;
        vm.stopBroadcast();
    }

    /**
     * @dev 部署 NFT 合约
     */
    function deployNFT() external {
        vm.startBroadcast();
        GreenTalesNFT nft = new GreenTalesNFT(greenTraceAddress);
        nftAddress = address(nft);
        nftDeployed = true;
        vm.stopBroadcast();
    }

    /**
     * @dev 初始化所有合约
     */
    function initializeContracts() external {
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
    }
} 