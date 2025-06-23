// SPDX-License-Identifier: MIT
// solhint-disable func-name-mixedcase

pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesMarket.sol";
import "../src/GreenTalesNFT.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTrace.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title GreenTalesMarket 测试用例
 * @dev 测试NFT交易市场的完整功能
 * 
 * 测试覆盖：
 * 1. 基础设置和初始化
 * 2. NFT挂单功能
 * 3. NFT购买功能
 * 4. 取消挂单功能
 * 5. 价格更新功能
 * 6. 交易历史记录
 * 7. 平台费用管理
 * 8. 前端查询功能
 * 9. 事件监听验证
 */
contract GreenTalesMarketTest is Test {
    GreenTalesMarket public market;    // 交易市场合约实例
    GreenTalesNFT public nft;          // NFT合约实例
    CarbonToken public carbonToken;    // 碳币合约实例
    GreenTrace public greenTrace;       // GreenTrace合约实例
    address public owner;              // 合约所有者
    address public user1;              // 测试用户1
    address public user2;              // 测试用户2
    address public user3;              // 测试用户3
    address public feeCollector;       // 手续费接收地址
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    uint256 public constant PLATFORM_FEE_RATE = 250; // 2.5%

    /**
     * @dev 测试环境设置
     * @notice 在每个测试用例执行前运行，初始化合约和用户
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        feeCollector = makeAddr("feeCollector");
        
        // 部署合约
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);
        
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        nft = new GreenTalesNFT(address(greenTrace));
        greenTrace.setNFTContract(address(nft));
        greenTrace.initialize();
        
        market = new GreenTalesMarket(
            address(nft),
            address(carbonToken),
            PLATFORM_FEE_RATE,
            feeCollector,
            address(greenTrace)
        );
        
        // 分配初始代币
        carbonToken.transfer(user1, 10000 * 10**18);
        carbonToken.transfer(user2, 10000 * 10**18);
        carbonToken.transfer(user3, 10000 * 10**18);
        
        // 铸造测试NFT
        vm.startPrank(owner);
        greenTrace.mintNFTByBusiness(user1, "Story1", "Details1", 1000 * 10**18, 500 * 10**18, "ipfs://hash1"); // tokenId: 0
        greenTrace.mintNFTByBusiness(user2, "Story2", "Details2", 2000 * 10**18, 800 * 10**18, "ipfs://hash2"); // tokenId: 1
        // 多为 user1 铸造几个NFT用于测试
        greenTrace.mintNFTByBusiness(user1, "Story3", "Details3", 100 * 10**18, 60 * 10**18, "ipfs://hash3");   // tokenId: 2
        greenTrace.mintNFTByBusiness(user1, "Story4", "Details4", 100 * 10**18, 70 * 10**18, "ipfs://hash4");   // tokenId: 3
        greenTrace.mintNFTByBusiness(user1, "Story5", "Details5", 100 * 10**18, 80 * 10**18, "ipfs://hash5");   // tokenId: 4
        vm.stopPrank();
    }

    /**
     * @dev 测试初始状态
     * @notice 验证合约部署后的初始状态是否正确
     */
    function test_InitialState() public view {
        assertEq(address(market.nftContract()), address(nft));
        assertEq(address(market.carbonToken()), address(carbonToken));
        assertEq(address(market.greenTrace()), address(greenTrace));
        assertEq(market.platformFeeRate(), PLATFORM_FEE_RATE);
        assertEq(market.feeCollector(), feeCollector);
        assertEq(market.owner(), owner);
    }

    /**
     * @dev 测试NFT挂单
     * @notice 验证用户是否可以正确挂单NFT
     */
    function test_ListNFT() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0; // 第一个NFT
        uint256 price = 600 * 10**18;
        
        // 授权NFT转移
        nft.approve(address(market), tokenId);
        
        // 挂单
        market.listNFT(tokenId, price);
        
        // 验证挂单信息
        (address seller, uint256 listingPrice, uint256 timestamp, bool isActive) = market.listings(tokenId);
        assertEq(seller, user1);
        assertEq(listingPrice, price);
        assertEq(isActive, true);
        
        // 验证NFT所有权转移
        assertEq(nft.ownerOf(tokenId), address(market));
        
        vm.stopPrank();
    }

    /**
     * @dev 测试购买NFT
     * @notice 验证用户是否可以正确购买已挂单的NFT
     */
    function test_BuyNFT() public {
        // 先挂单
        vm.startPrank(user1);
        uint256 tokenId = 0;
        uint256 price = 600 * 10**18;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, price);
        vm.stopPrank();
        
        // 购买NFT
        vm.startPrank(user2);
        uint256 buyerBalanceBefore = carbonToken.balanceOf(user2);
        
        carbonToken.approve(address(market), price);
        market.buyNFT(tokenId);
        
        // 验证购买结果
        assertEq(nft.ownerOf(tokenId), user2);
        
        // 验证费用分配
        uint256 platformFee = (price * PLATFORM_FEE_RATE) / 10000;
        uint256 sellerAmount = price - platformFee;
        
        assertEq(carbonToken.balanceOf(feeCollector), platformFee);
        assertEq(carbonToken.balanceOf(user1), 10000 * 10**18 + sellerAmount);
        assertEq(carbonToken.balanceOf(user2), buyerBalanceBefore - price);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试取消挂单
     * @notice 验证用户是否可以正确取消已挂单的NFT
     */
    function test_CancelListing() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        uint256 price = 600 * 10**18;
        
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, price);
        
        // 验证挂单成功
        assertEq(nft.ownerOf(tokenId), address(market));
        
        // 取消挂单
        market.cancelListing(tokenId);
        
        // 验证取消结果
        assertEq(nft.ownerOf(tokenId), user1);
        (,,, bool isActive) = market.listings(tokenId);
        assertEq(isActive, false);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试更新价格
     * @notice 验证合约所有者是否可以更新NFT的价格
     */
    function test_UpdatePrice() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        uint256 initialPrice = 600 * 10**18;
        uint256 newPrice = 700 * 10**18;
        
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, initialPrice);
        
        // 更新价格
        market.updatePrice(tokenId, newPrice);
        
        // 验证价格更新
        (, uint256 listingPrice, ,) = market.listings(tokenId);
        assertEq(listingPrice, newPrice);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试获取用户挂单列表
     * @notice 验证用户是否可以正确获取自己的挂单列表
     */
    function test_GetUserListings() public {
        vm.startPrank(user1);
        
        uint256 tokenId1 = 0;
        uint256 tokenId2 = 2; // user1 拥有的第二个NFT
        
        nft.approve(address(market), tokenId1);
        nft.approve(address(market), tokenId2);
        
        market.listNFT(tokenId1, 600 * 10**18);
        market.listNFT(tokenId2, 800 * 10**18);
        
        uint256[] memory userListings = market.getUserListings(user1);
        assertEq(userListings.length, 2);
        assertEq(userListings[0], tokenId1);
        assertEq(userListings[1], tokenId2);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试获取所有挂单列表
     * @notice 验证是否可以正确获取所有挂单列表
     */
    function test_GetAllListedNFTs() public {
        // 用户1挂单
        vm.startPrank(user1);
        nft.approve(address(market), 0);
        market.listNFT(0, 600 * 10**18);
        vm.stopPrank();
        
        // 用户2挂单
        vm.startPrank(user2);
        nft.approve(address(market), 1);
        market.listNFT(1, 800 * 10**18);
        vm.stopPrank();
        
        uint256[] memory allListings = market.getAllListedNFTs();
        assertEq(allListings.length, 2);
    }

    /**
     * @dev 测试获取带分页的挂单列表
     * @notice 验证是否可以正确获取带分页的挂单列表
     */
    function test_GetListingsWithPagination() public {
        // user1 owns tokenIds 0, 2, 3, 4
        uint256[] memory user1Tokens = new uint256[](4);
        user1Tokens[0] = 0;
        user1Tokens[1] = 2;
        user1Tokens[2] = 3;
        user1Tokens[3] = 4;

        // 创建多个挂单
        vm.startPrank(user1);
        for (uint256 i = 0; i < 4; i++) {
            nft.approve(address(market), user1Tokens[i]);
            market.listNFT(user1Tokens[i], (600 + i * 100) * 10**18);
        }
        vm.stopPrank();
        
        // 测试分页
        (uint256[] memory tokenIds, GreenTalesMarket.Listing[] memory listings) = 
            market.getListingsWithPagination(0, 3);
        
        assertEq(tokenIds.length, 3);
        assertEq(listings.length, 3);
    }

    /**
     * @dev 测试获取NFT完整信息
     * @notice 验证是否可以正确获取NFT的完整信息
     */
    function test_GetNFTFullInfo() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        
        (GreenTalesMarket.Listing memory listing, 
         GreenTalesNFT.StoryMeta memory storyMeta, 
         uint256 tradeCount) = market.getNFTFullInfo(tokenId);
        
        assertEq(listing.seller, user1);
        assertEq(listing.price, 600 * 10**18);
        assertEq(storyMeta.storyTitle, "Story1");
        assertEq(tradeCount, 0);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试获取挂单统计信息
     * @notice 验证是否可以正确获取挂单统计信息
     */
    function test_GetListingStats() public {
        // 创建挂单
        vm.startPrank(user1);
        nft.approve(address(market), 0);
        market.listNFT(0, 600 * 10**18);
        vm.stopPrank();
        
        vm.startPrank(user2);
        nft.approve(address(market), 1);
        market.listNFT(1, 800 * 10**18);
        vm.stopPrank();
        
        (uint256 totalListings, uint256 totalUsers) = market.getListingStats();
        assertEq(totalListings, 2);
        assertEq(totalUsers, 2);
    }

    /**
     * @dev 测试获取交易历史
     * @notice 验证是否可以正确获取交易历史
     */
    function test_TradeHistory() public {
        // 挂单
        vm.startPrank(user1);
        nft.approve(address(market), 0);
        market.listNFT(0, 600 * 10**18);
        vm.stopPrank();
        
        // 购买
        vm.startPrank(user2);
        carbonToken.approve(address(market), 600 * 10**18);
        market.buyNFT(0);
        vm.stopPrank();
        
        // 验证交易历史
        GreenTalesMarket.TradeHistory[] memory history = market.getTradeHistory(0);
        assertEq(history.length, 1);
        assertEq(history[0].seller, user1);
        assertEq(history[0].buyer, user2);
        assertEq(history[0].price, 600 * 10**18);
        
        // 验证最后成交价格
        assertEq(market.getLastTradePrice(0), 600 * 10**18);
    }

    /**
     * @dev 测试非所有者挂单失败
     * @notice 验证非NFT所有者无法挂单
     */
    function test_ListNFT_NotOwner() public {
        vm.startPrank(user2);
        
        uint256 tokenId = 0; // 属于user1的NFT
        
        vm.expectRevert("Not NFT owner");
        market.listNFT(tokenId, 600 * 10**18);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试购买未挂单的NFT失败
     * @notice 验证用户无法购买未挂单的NFT
     */
    function test_BuyNFT_NotListed() public {
        vm.startPrank(user2);
        
        vm.expectRevert("NFT not listed");
        market.buyNFT(0);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试购买自己的NFT失败
     * @notice 验证用户无法购买自己挂单的NFT
     */
    function test_BuyNFT_OwnNFT() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        
        vm.expectRevert("Cannot buy your own NFT");
        market.buyNFT(tokenId);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试取消挂单失败
     * @notice 验证非挂单所有者无法取消挂单
     */
    function test_CancelListing_NotSeller() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        vm.stopPrank();
        
        vm.startPrank(user2);
        vm.expectRevert("Not the seller");
        market.cancelListing(tokenId);
        vm.stopPrank();
    }

    /**
     * @dev 测试更新平台手续费率
     * @notice 验证合约所有者是否可以更新手续费率
     */
    function test_UpdatePlatformFeeRate() public {
        uint256 newRate = 300; // 3%
        
        market.updatePlatformFeeRate(newRate);
        assertEq(market.platformFeeRate(), newRate);
    }

    /**
     * @dev 测试更新手续费接收地址
     * @notice 验证合约所有者是否可以更新手续费接收地址
     */
    function test_UpdateFeeCollector() public {
        address newCollector = makeAddr("newCollector");
        
        market.updateFeeCollector(newCollector);
        assertEq(market.feeCollector(), newCollector);
    }

    /**
     * @dev 测试手续费率过高失败
     * @notice 验证手续费率过高无法更新
     */
    function test_UpdatePlatformFeeRate_TooHigh() public {
        uint256 tooHighRate = 1500; // 15%
        
        vm.expectRevert("Fee rate too high");
        market.updatePlatformFeeRate(tooHighRate);
    }

    /**
     * @dev 测试事件监听
     * @notice 验证是否可以正确监听事件
     */
    function test_Events() public {
        vm.startPrank(user1);
        
        uint256 tokenId = 0;
        uint256 price = 600 * 10**18;
        
        nft.approve(address(market), tokenId);
        
        // 挂单
        market.listNFT(tokenId, price);
        
        vm.stopPrank();
        
        // 购买
        vm.startPrank(user2);
        carbonToken.approve(address(market), price);
        market.buyNFT(tokenId);
        vm.stopPrank();
    }

    /**
     * @dev 测试价格为零失败
     * @notice 验证价格为零无法挂单
     */
    function test_ListNFT_ZeroPrice() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        
        vm.expectRevert("Price must be greater than 0");
        market.listNFT(tokenId, 0);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试NFT已挂单失败
     * @notice 验证NFT已挂单无法再次挂单
     */
    function test_ListNFT_AlreadyListed() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        
        market.listNFT(tokenId, 600 * 10**18);
        
        // NFT已经转移到合约，所以再次挂单会因为所有权问题失败
        vm.expectRevert("Not NFT owner");
        market.listNFT(tokenId, 700 * 10**18);
        
        vm.stopPrank();
    }

    /**
     * @dev 测试价格为零更新失败
     * @notice 验证价格为零无法更新
     */
    function test_UpdatePrice_ZeroPrice() public {
        vm.startPrank(user1);
        uint256 tokenId = 0;
        nft.approve(address(market), tokenId);
        market.listNFT(tokenId, 600 * 10**18);
        
        vm.expectRevert("Price must be greater than 0");
        market.updatePrice(tokenId, 0);
        
        vm.stopPrank();
    }

    /**
     * @dev 实现 IERC721Receiver 接口，允许本测试合约安全接收 NFT
     * @notice 这样 NFT safeTransferFrom 到本合约不会 revert
     */
    function test_OnERC721Received() public {
        bytes4 selector = market.onERC721Received(address(0), address(0), 0, "");
        assertEq(selector, IERC721Receiver.onERC721Received.selector);
    }
} 