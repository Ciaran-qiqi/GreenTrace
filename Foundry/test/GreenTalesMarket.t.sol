// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesMarket.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";
import "../src/GreenTrace.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title GreenTalesMarket 测试用例
 * @dev 覆盖NFT交易市场的挂单、购买、取消等核心逻辑
 * 
 * 测试用例包括：
 * 1. 初始状态测试
 * 2. NFT挂单测试
 * 3. NFT购买测试
 * 4. 取消挂单测试
 * 5. 价格管理测试
 * 6. 手续费计算测试
 * 7. 错误处理测试
 */
contract GreenTalesMarketTest is Test, IERC721Receiver {
    GreenTalesMarket public market;    // 交易市场合约实例
    CarbonToken public carbonToken;    // 碳币合约实例
    GreenTalesNFT public nft;          // NFT合约实例
    GreenTrace public greenTrace;       // GreenTrace合约实例
    address public owner;              // 合约所有者
    address public user1;              // 测试用户1
    address public user2;              // 测试用户2
    uint256 public constant INITIAL_SUPPLY = 1000000 ether;

    /**
     * @dev 测试环境设置
     * @notice 在每个测试用例执行前运行，初始化合约和用户
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // 部署合约
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);
        
        // 部署 GreenTrace 合约，先不设置 NFT 地址
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        
        // 部署 NFT 合约，设置 GreenTrace 为调用者
        nft = new GreenTalesNFT(address(greenTrace));
        
        // 设置 GreenTrace 的 NFT 地址
        greenTrace.setNFTContract(address(nft));
        
        // 部署市场合约
        market = new GreenTalesMarket(
            address(nft),
            address(carbonToken),
            250,  // 平台手续费率 2.5%
            address(greenTrace),  // 手续费接收地址设置为GreenTrace合约
            address(greenTrace)   // 添加 GreenTrace 地址
        );
        
        // 为用户分配足够的代币
        carbonToken.transfer(user1, 10000 ether);
        carbonToken.transfer(user2, 10000 ether);

        // 设置 CarbonToken 的权限
        carbonToken.setGreenTrace(address(greenTrace));
        carbonToken.transferOwnership(address(greenTrace));
        
        // 初始化 GreenTrace
        greenTrace.initialize();
        
        // 添加市场合约到 GreenTrace 白名单
        greenTrace.addBusinessContract(address(market));
    }

    /**
     * @dev 测试初始状态
     * @notice 验证合约部署后的初始状态是否正确
     */
    function test_InitialState() public view {
        assertEq(market.owner(), owner);
        assertEq(address(market.nftContract()), address(nft));
        assertEq(address(market.carbonToken()), address(carbonToken));
        assertEq(market.platformFeeRate(), 250);
        assertEq(market.feeCollector(), address(greenTrace));
    }

    /**
     * @dev 测试NFT挂单
     * @notice 验证用户是否可以正确挂单NFT
     */
    function test_ListNFT() public {
        // 在测试环境中直接铸造 NFT
        vm.prank(address(market));
        uint256 tokenId = greenTrace.mintNFTByBusiness(
            user1,
            "Title",
            "Detail",
            1000,
            100 ether,
            "ipfs://Qm..."
        );
        
        // user1授权市场合约使用NFT
        vm.prank(user1);
        nft.approve(address(market), tokenId);
        
        // user1挂单NFT
        vm.prank(user1);
        market.listNFT(tokenId, 100 ether);
        
        // 验证挂单信息
        (address seller, uint256 price, uint256 timestamp, bool isActive) = market.listings(tokenId);
        assertEq(seller, user1);
        assertEq(price, 100 ether);
        assertTrue(isActive);
    }

    /**
     * @dev 测试购买NFT
     * @notice 验证用户是否可以正确购买已挂单的NFT
     */
    function test_BuyNFT() public {
        // 在测试环境中直接铸造 NFT
        vm.prank(address(market));
        uint256 tokenId = greenTrace.mintNFTByBusiness(
            user1,
            "Title",
            "Detail",
            1000,
            100 ether,
            "ipfs://Qm..."
        );
        
        // user1授权市场合约使用NFT
        vm.prank(user1);
        nft.approve(address(market), tokenId);
        
        // user1挂单NFT
        vm.prank(user1);
        market.listNFT(tokenId, 100 ether);
        
        // user2授权市场合约使用碳币
        vm.prank(user2);
        carbonToken.approve(address(market), 100 ether);
        
        // user2购买NFT
        vm.prank(user2);
        market.buyNFT(tokenId);
        
        // 验证NFT所有权转移
        assertEq(nft.ownerOf(tokenId), user2);
        
        // 验证价格记录
        assertEq(market.getLastTradePrice(tokenId), 100 ether);
    }

    /**
     * @dev 测试取消挂单
     * @notice 验证用户是否可以正确取消已挂单的NFT
     */
    function test_CancelListing() public {
        // 在测试环境中直接铸造 NFT
        vm.prank(address(market));
        uint256 tokenId = greenTrace.mintNFTByBusiness(
            user1,
            "Title",
            "Detail",
            1000,
            100 ether,
            "ipfs://Qm..."
        );
        
        // user1授权市场合约使用NFT
        vm.prank(user1);
        nft.approve(address(market), tokenId);
        
        // user1挂单NFT
        vm.prank(user1);
        market.listNFT(tokenId, 100 ether);
        
        // user1取消挂单
        vm.prank(user1);
        market.cancelListing(tokenId);
        
        // 验证NFT所有权
        assertEq(nft.ownerOf(tokenId), user1);
        
        // 验证挂单状态
        (address seller, uint256 price, uint256 timestamp, bool isActive) = market.listings(tokenId);
        assertFalse(isActive);
    }

    /**
     * @dev 测试非所有者挂单失败
     * @notice 验证非NFT所有者无法挂单
     */
    function test_RevertWhen_ListNFTNotOwner() public {
        // 在测试环境中直接铸造 NFT
        vm.prank(address(market));
        uint256 tokenId = greenTrace.mintNFTByBusiness(
            user1,
            "Title",
            "Detail",
            1000,
            100 ether,
            "ipfs://Qm..."
        );
        
        // user2尝试挂单
        vm.prank(user2);
        vm.expectRevert("Not NFT owner");
        market.listNFT(tokenId, 100 ether);
    }

    /**
     * @dev 测试购买自己的NFT失败
     * @notice 验证用户无法购买自己挂单的NFT
     */
    function test_RevertWhen_BuyOwnNFT() public {
        // 在测试环境中直接铸造 NFT
        vm.prank(address(market));
        uint256 tokenId = greenTrace.mintNFTByBusiness(
            user1,
            "Title",
            "Detail",
            1000,
            100 ether,
            "ipfs://Qm..."
        );
        
        // user1授权市场合约使用NFT
        vm.prank(user1);
        nft.approve(address(market), tokenId);
        
        // user1挂单NFT
        vm.prank(user1);
        market.listNFT(tokenId, 100 ether);
        
        // user1尝试购买自己的NFT
        vm.prank(user1);
        vm.expectRevert("Cannot buy your own NFT");
        market.buyNFT(tokenId);
    }

    /**
     * @dev 测试更新平台手续费率
     * @notice 验证合约所有者是否可以更新手续费率
     */
    function test_UpdatePlatformFeeRate() public {
        market.updatePlatformFeeRate(300);  // 更新为3%
        assertEq(market.platformFeeRate(), 300);
    }

    /**
     * @dev 测试非所有者更新手续费率失败
     * @notice 验证非合约所有者无法更新手续费率
     */
    function test_RevertWhen_UpdateFeeRateNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        market.updatePlatformFeeRate(300);
    }

    /**
     * @dev 实现 IERC721Receiver 接口，允许本测试合约安全接收 NFT
     * @notice 这样 NFT safeTransferFrom 到本合约不会 revert
     */
    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        // 返回 IERC721Receiver 接口的 selector，表示接收成功
        return this.onERC721Received.selector;
    }
} 