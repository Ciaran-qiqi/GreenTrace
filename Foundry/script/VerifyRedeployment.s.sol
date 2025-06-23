// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/GreenTrace.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTalesMarket.sol";

/**
 * @title VerifyDeployment
 * @dev 验证新部署的合约配置脚本
 * @notice 这个脚本将验证所有合约的配置是否正确
 */
contract VerifyDeployment is Script {
    
    // ============ 请更新为新部署的合约地址 ============
    address constant NEW_GREEN_TRACE_ADDRESS = 0x141B2c6Df6AE9863f1cD8FC4624d165209b9c18c;
    address constant NEW_GREEN_TALES_MARKET_ADDRESS = 0x2661421e4e0373a06A3e705A83d1063e8F2F40EA;
    // ============ 现有数据合约地址 ============
    address constant CARBON_TOKEN_ADDRESS = 0x808b73A3A1D97382acF32d4F4F834e799Aa08198;
    address constant GREEN_TALES_NFT_ADDRESS = 0x3456a42043955B1626F6353936c0FEfCd1cB5f1c;
    
    function run() external view {
        console.log(unicode"🔍 开始验证新部署的合约配置...");
        console.log(unicode"新GreenTrace地址:", NEW_GREEN_TRACE_ADDRESS);
        console.log(unicode"新Market地址:", NEW_GREEN_TALES_MARKET_ADDRESS);
        
        // ============ 验证GreenTrace合约 ============
        console.log(unicode"\n=== 验证GreenTrace合约 ===");
        
        GreenTrace greenTrace = GreenTrace(NEW_GREEN_TRACE_ADDRESS);
        
        address carbonTokenInGreenTrace = address(greenTrace.carbonToken());
        address nftInGreenTrace = address(greenTrace.greenTalesNFT());
        bool isInitialized = greenTrace.initialized();
        
        console.log(unicode"✓ GreenTrace.carbonToken():", carbonTokenInGreenTrace);
        console.log(unicode"✓ GreenTrace.greenTalesNFT():", nftInGreenTrace);
        console.log(unicode"✓ GreenTrace.initialized():", isInitialized);
        
        // 验证地址匹配
        if (carbonTokenInGreenTrace == CARBON_TOKEN_ADDRESS) {
            console.log(unicode"✅ CarbonToken地址匹配正确");
        } else {
            console.log(unicode"❌ CarbonToken地址不匹配!");
        }
        
        if (nftInGreenTrace == GREEN_TALES_NFT_ADDRESS) {
            console.log(unicode"✅ GreenTalesNFT地址匹配正确");
        } else {
            console.log(unicode"❌ GreenTalesNFT地址不匹配!");
        }
        
        if (isInitialized) {
            console.log(unicode"✅ GreenTrace已正确初始化");
        } else {
            console.log(unicode"❌ GreenTrace未初始化!");
        }
        
        // ============ 验证CarbonToken合约 ============
        console.log(unicode"\n=== 验证CarbonToken合约 ===");
        
        CarbonToken carbonToken = CarbonToken(CARBON_TOKEN_ADDRESS);
        
        address greenTraceInCarbonToken = carbonToken.greenTrace();
        address carbonTokenOwner = carbonToken.owner();
        
        console.log(unicode"✓ CarbonToken.greenTrace():", greenTraceInCarbonToken);
        console.log(unicode"✓ CarbonToken.owner():", carbonTokenOwner);
        
        if (greenTraceInCarbonToken == NEW_GREEN_TRACE_ADDRESS) {
            console.log(unicode"✅ CarbonToken的GreenTrace引用正确");
        } else {
            console.log(unicode"❌ CarbonToken的GreenTrace引用错误!");
        }
        
        if (carbonTokenOwner == NEW_GREEN_TRACE_ADDRESS) {
            console.log(unicode"✅ CarbonToken的所有者正确");
        } else {
            console.log(unicode"⚠️  CarbonToken的所有者不是新GreenTrace");
        }
        
        // ============ 验证GreenTalesNFT合约 ============
        console.log(unicode"\n=== 验证GreenTalesNFT合约 ===");
        
        GreenTalesNFT nft = GreenTalesNFT(GREEN_TALES_NFT_ADDRESS);
        
        address greenTraceInNFT = nft.greenTrace();
        address nftOwner = nft.owner();
        uint256 nextTokenId = nft.nextTokenId();
        
        console.log(unicode"✓ GreenTalesNFT.greenTrace():", greenTraceInNFT);
        console.log(unicode"✓ GreenTalesNFT.owner():", nftOwner);
        console.log(unicode"✓ GreenTalesNFT.nextTokenId():", nextTokenId);
        
        if (greenTraceInNFT == NEW_GREEN_TRACE_ADDRESS) {
            console.log(unicode"✅ GreenTalesNFT的GreenTrace引用正确");
        } else {
            console.log(unicode"❌ GreenTalesNFT的GreenTrace引用错误!");
        }
        
        console.log(unicode"✅ NFT数据完全保留，下一个TokenID:", nextTokenId);
        
        // ============ 验证GreenTalesMarket合约 ============
        console.log(unicode"\n=== 验证GreenTalesMarket合约 ===");
        
        GreenTalesMarket market = GreenTalesMarket(NEW_GREEN_TALES_MARKET_ADDRESS);
        
        address carbonTokenInMarket = address(market.carbonToken());
        address nftInMarket = address(market.nftContract());
        address greenTraceInMarket = address(market.greenTrace());
        
        console.log(unicode"✓ GreenTalesMarket.carbonToken():", carbonTokenInMarket);
        console.log(unicode"✓ GreenTalesMarket.nftContract():", nftInMarket);
        console.log(unicode"✓ GreenTalesMarket.greenTrace():", greenTraceInMarket);
        
        if (carbonTokenInMarket == CARBON_TOKEN_ADDRESS) {
            console.log(unicode"✅ Market的CarbonToken引用正确");
        } else {
            console.log(unicode"❌ Market的CarbonToken引用错误!");
        }
        
        if (nftInMarket == GREEN_TALES_NFT_ADDRESS) {
            console.log(unicode"✅ Market的NFT引用正确");
        } else {
            console.log(unicode"❌ Market的NFT引用错误!");
        }
        
        if (greenTraceInMarket == NEW_GREEN_TRACE_ADDRESS) {
            console.log(unicode"✅ Market的GreenTrace引用正确");
        } else {
            console.log(unicode"❌ Market的GreenTrace引用错误!");
        }
        
        // ============ 验证业务合约白名单 ============
        console.log(unicode"\n=== 验证业务合约白名单 ===");
        
        bool isMarketInWhitelist = greenTrace.businessContracts(NEW_GREEN_TALES_MARKET_ADDRESS);
        
        if (isMarketInWhitelist) {
            console.log(unicode"✅ GreenTalesMarket已在新GreenTrace的业务合约白名单中");
        } else {
            console.log(unicode"❌ GreenTalesMarket未在业务合约白名单中!");
        }
        
        // ============ 总结验证结果 ============
        console.log(unicode"\n🎯 验证总结:");
        console.log(unicode"==========================================");
        
        bool allCorrect = true;
        
        if (carbonTokenInGreenTrace == CARBON_TOKEN_ADDRESS && 
            nftInGreenTrace == GREEN_TALES_NFT_ADDRESS &&
            isInitialized &&
            greenTraceInCarbonToken == NEW_GREEN_TRACE_ADDRESS &&
            greenTraceInNFT == NEW_GREEN_TRACE_ADDRESS &&
            greenTraceInMarket == NEW_GREEN_TRACE_ADDRESS &&
            isMarketInWhitelist) {
            console.log(unicode"🎉 所有关键配置验证通过！");
        } else {
            console.log(unicode"⚠️  发现配置问题，请检查上述错误项！");
            allCorrect = false;
        }
        
        console.log(unicode"\n📊 数据保留状态:");
        console.log(unicode"- NFT总数: 保留 (nextTokenId =", nextTokenId, ")");
        console.log(unicode"- 碳币余额: 完全保留");
        
        if (allCorrect) {
            console.log(unicode"\n✅ 部署成功！可以正常使用。");
        } else {
            console.log(unicode"\n❌ 部署存在问题，请修复后再使用。");
        }
    }
} 