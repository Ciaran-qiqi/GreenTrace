// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTrace.sol";
import "../src/GreenTalesMarket.sol";
import "../src/GreenTalesLiquidityPool.sol";
import "../src/CarbonPriceOracle.sol";

/**
 * @title DeployScript
 * @dev 完整的GreenTrace生态系统部署脚本
 * @notice 部署所有合约：NFT、碳币、市场、流动性池、预言机等
 */
contract DeployScript is Script {
    // Sepolia测试网合约地址
    address constant SEPOLIA_USDT = 0xdCdC73413C6136c9ABcC3E8d250af42947aC2Fc7;          // USDT（Testnet USDT）18位精度 主网6位
    address constant SEPOLIA_EUR_USD_FEED = 0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910; // Chainlink Sepolia EUR/USD预言机地址
    address constant SEPOLIA_CHAINLINK_TOKEN = 0x779877A7B0D9E8603169DdbD7836e478b4624789; // Sepolia Chainlink Token
    address constant SEPOLIA_FUNCTIONS_ROUTER = 0xb83E47C2bC239B3bf370bc41e1459A34b41238D0; // Sepolia Functions Router
    bytes32 constant SEPOLIA_DON_ID = 0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000; // Sepolia DON ID
    
    // 部署参数
    uint256 public constant INITIAL_CARBON_SUPPLY = 1_000_000 * 1e18;  // 100万碳币
    uint256 public constant INITIAL_USDT_AMOUNT = 88_000_000 * 1e18;   // 8800万USDT（使用18位精度）
    uint256 public constant INITIAL_PRICE = 88 * 1e18;                 // 88 USDT/碳币（使用18位精度）
    uint256 public constant PLATFORM_FEE_RATE = 100;                   // 1%手续费率
    uint256 public constant POOL_FEE_RATE = 30;                        // 0.3%手续费率
    
    // 合约地址
    address public carbonTokenAddress;
    address public nftAddress;
    address public greenTraceAddress;
    address public marketAddress;
    address public liquidityPoolAddress;
    address public carbonPriceOracleAddress;
    
    // 部署者地址
    address public deployer;
    
    function setUp() public {
        // 获取部署者私钥和地址
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        
        console.log(unicode"=== GreenTrace 生态系统部署脚本 ===");
        console.log(unicode"部署者地址:", deployer);
        console.log(unicode"链ID:", block.chainid);
        console.log(unicode"Sepolia USDT地址:", SEPOLIA_USDT);
        console.log(unicode"Sepolia EUR/USD预言机地址:", SEPOLIA_EUR_USD_FEED);
        console.log(unicode"Sepolia Chainlink Token地址:", SEPOLIA_CHAINLINK_TOKEN);
        console.log(unicode"Sepolia Functions Router地址:", SEPOLIA_FUNCTIONS_ROUTER);
        console.log(unicode"Sepolia DON ID:", vm.toString(SEPOLIA_DON_ID));
        console.log("");
    }

    function run() external {
        console.log(unicode"开始部署合约...");
        
        // 开始广播交易
        vm.startBroadcast();

        // 1. 部署CarbonToken合约
        console.log(unicode"1. 部署 CarbonToken...");
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance({
            to: deployer,
            amount: INITIAL_CARBON_SUPPLY
        });
        CarbonToken carbonToken = new CarbonToken(initialBalances);
        carbonTokenAddress = address(carbonToken);
        console.log(unicode"CarbonToken 部署成功！地址:", carbonTokenAddress);

        // 2. 部署GreenTrace合约
        console.log(unicode"2. 部署 GreenTrace...");
        GreenTrace greenTrace = new GreenTrace(carbonTokenAddress, address(0));
        greenTraceAddress = address(greenTrace);
        console.log(unicode"GreenTrace 部署成功！地址:", greenTraceAddress);

        // 3. 部署GreenTalesNFT合约
        console.log(unicode"3. 部署 GreenTalesNFT...");
        GreenTalesNFT nft = new GreenTalesNFT(greenTraceAddress);
        nftAddress = address(nft);
        console.log(unicode"GreenTalesNFT 部署成功！地址:", nftAddress);

        // 4. 部署CarbonPriceOracle合约
        console.log(unicode"4. 部署 CarbonPriceOracle...");
        CarbonPriceOracle oracle = new CarbonPriceOracle(
            SEPOLIA_FUNCTIONS_ROUTER,
            SEPOLIA_DON_ID,
            SEPOLIA_EUR_USD_FEED,
            SEPOLIA_CHAINLINK_TOKEN
        );
        carbonPriceOracleAddress = address(oracle);
        console.log(unicode"CarbonPriceOracle 部署成功！地址:", carbonPriceOracleAddress);

        // 5. 部署GreenTalesLiquidityPool合约
        console.log(unicode"5. 部署 GreenTalesLiquidityPool...");
        GreenTalesLiquidityPool pool = new GreenTalesLiquidityPool(
            address(carbonToken),
            SEPOLIA_USDT,
            address(0)  // 移除USDT/USD价格预言机
        );
        liquidityPoolAddress = address(pool);
        console.log(unicode"GreenTalesLiquidityPool 部署成功！地址:", liquidityPoolAddress);

        // 6. 部署GreenTalesMarket合约
        console.log(unicode"6. 部署 GreenTalesMarket...");
        GreenTalesMarket market = new GreenTalesMarket(
            nftAddress,           // NFT合约地址
            address(carbonToken), // 碳币合约地址
            PLATFORM_FEE_RATE,    // 平台手续费率
            deployer,             // 手续费接收地址
            greenTraceAddress     // GreenTrace合约地址
        );
        marketAddress = address(market);
        console.log(unicode"GreenTalesMarket 部署成功！地址:", marketAddress);

        // 停止广播
        vm.stopBroadcast();

        // 7. 初始化合约关系
        console.log(unicode"7. 初始化合约关系...");
        vm.startBroadcast();
        
        // 设置NFT的GreenTrace地址
        GreenTalesNFT(nftAddress).setGreenTrace(greenTraceAddress);
        
        // 设置CarbonToken的GreenTrace地址
        CarbonToken(carbonTokenAddress).setGreenTrace(greenTraceAddress);
        
        // 设置GreenTrace的NFT地址
        GreenTrace(greenTraceAddress).setNFTContract(nftAddress);
        
        // 初始化GreenTrace
        GreenTrace(greenTraceAddress).initialize();
        
        // 添加市场合约到白名单
        GreenTrace(greenTraceAddress).addBusinessContract(marketAddress);
        
        // 设置流动性池的碳价预言机
        GreenTalesLiquidityPool(liquidityPoolAddress).setCarbonPriceOracle(carbonPriceOracleAddress);
        GreenTalesLiquidityPool(liquidityPoolAddress).setPriceDeviationThreshold(10); // 设置10%的偏离阈值
        
        vm.stopBroadcast();

        // 8. 初始化流动性池
        console.log(unicode"8. 初始化流动性池...");
        vm.startBroadcast();
        
        // 授权市场合约使用碳币
        CarbonToken(carbonTokenAddress).approve(marketAddress, INITIAL_CARBON_SUPPLY);
        CarbonToken(carbonTokenAddress).approve(liquidityPoolAddress, INITIAL_CARBON_SUPPLY);

        // 注意：初始卖单需要先有NFT，这里暂时跳过
        // 用户需要先铸造NFT，然后通过listNFT函数挂单
        console.log(unicode"注意：初始卖单需要先有NFT，用户需要先铸造NFT后挂单");

        // 添加初始流动性
        GreenTalesLiquidityPool(liquidityPoolAddress).addLiquidity(INITIAL_CARBON_SUPPLY / 2, INITIAL_USDT_AMOUNT / 2);
        console.log(unicode"添加初始流动性到池子");
        
        vm.stopBroadcast();

        // 9. 验证部署结果
        console.log(unicode"9. 验证部署结果...");
        _validateDeployment();

        // 10. 输出部署信息
        console.log(unicode"\n=== 部署完成！===");
        console.log(unicode"CarbonToken地址:", carbonTokenAddress);
        console.log(unicode"GreenTalesNFT地址:", nftAddress);
        console.log(unicode"GreenTrace地址:", greenTraceAddress);
        console.log(unicode"GreenTalesMarket地址:", marketAddress);
        console.log(unicode"GreenTalesLiquidityPool地址:", liquidityPoolAddress);
        console.log(unicode"CarbonPriceOracle地址:", carbonPriceOracleAddress);
        console.log(unicode"Sepolia USDT地址:", SEPOLIA_USDT);
        console.log(unicode"Sepolia EUR/USD价格预言机地址:", SEPOLIA_EUR_USD_FEED);
        console.log(unicode"Sepolia Chainlink Token地址:", SEPOLIA_CHAINLINK_TOKEN);
        console.log(unicode"\n初始配置：");
        console.log(unicode"- 初始碳币数量:", INITIAL_CARBON_SUPPLY / 1e18);
        console.log(unicode"- 初始USDT数量:", INITIAL_USDT_AMOUNT / 1e18);
        console.log(unicode"- 初始价格:", INITIAL_PRICE / 1e18, "USDT");
        console.log(unicode"- 市场手续费率:", PLATFORM_FEE_RATE / 100, "%");
        console.log(unicode"- 流动性池手续费率:", POOL_FEE_RATE / 100, "%");
        console.log(unicode"- 价格偏离阈值:", 10, "%");
        console.log(unicode"\n部署者地址:", deployer);
        
        // 输出配置命令
        console.log(unicode"\n=== 下一步：配置预言机 ===");
        console.log(unicode"1. 在 .env 文件中设置以下环境变量：");
        console.log(unicode"   CARBON_PRICE_ORACLE_ADDRESS=", carbonPriceOracleAddress);
        console.log(unicode"   CHAINLINK_FUNCTIONS_SUBSCRIPTION_ID=5045");
        console.log(unicode"");
        console.log(unicode"2. 运行配置脚本：");
        console.log(unicode"   forge script script/ConfigureOracle.s.sol --rpc-url https://sepolia.infura.io/v3/YOUR_API_KEY --broadcast");
        console.log(unicode"==================");
    }

    /**
     * @dev 验证部署结果
     */
    function _validateDeployment() internal view {
        // 验证CarbonToken
        require(carbonTokenAddress != address(0), "Invalid CarbonToken address");
        CarbonToken carbonToken = CarbonToken(carbonTokenAddress);
        require(carbonToken.greenTrace() == greenTraceAddress, "Invalid CarbonToken GreenTrace address");

        // 验证NFT
        require(nftAddress != address(0), "Invalid NFT address");
        GreenTalesNFT nft = GreenTalesNFT(nftAddress);
        require(nft.greenTrace() == greenTraceAddress, "Invalid NFT GreenTrace address");

        // 验证GreenTrace
        require(greenTraceAddress != address(0), "Invalid GreenTrace address");
        GreenTrace greenTrace = GreenTrace(greenTraceAddress);
        require(greenTrace.initialized(), "GreenTrace not initialized");
        require(address(greenTrace.greenTalesNFT()) == nftAddress, "Invalid GreenTrace NFT address");
        require(address(greenTrace.carbonToken()) == carbonTokenAddress, "Invalid GreenTrace CarbonToken address");

        // 验证Market
        require(marketAddress != address(0), "Invalid Market address");
        GreenTalesMarket market = GreenTalesMarket(marketAddress);
        require(address(market.carbonToken()) == carbonTokenAddress, "Invalid Market CarbonToken address");

        // 验证LiquidityPool
        require(liquidityPoolAddress != address(0), "Invalid LiquidityPool address");
        GreenTalesLiquidityPool pool = GreenTalesLiquidityPool(liquidityPoolAddress);
        require(address(pool.carbonToken()) == carbonTokenAddress, "Invalid LiquidityPool CarbonToken address");

        // 验证CarbonPriceOracle
        require(carbonPriceOracleAddress != address(0), "Invalid CarbonPriceOracle address");
        CarbonPriceOracle oracle = CarbonPriceOracle(carbonPriceOracleAddress);
        require(address(oracle.eurUsdPriceFeed()) == SEPOLIA_EUR_USD_FEED, "Invalid CarbonPriceOracle EUR/USD feed");

        console.log(unicode"所有合约验证通过！");
    }
} 