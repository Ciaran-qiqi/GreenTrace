// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesNFT.sol";

/**
 * @title GreenTalesNFT 测试用例
 * @dev 覆盖NFT的铸造、销毁、权限等核心逻辑
 * 
 * 测试用例包括：
 * 1. 初始状态测试
 * 2. NFT铸造测试
 * 3. NFT销毁测试
 * 4. 权限控制测试
 * 5. 元数据管理测试
 * 6. 错误处理测试
 * 7. 价格更新测试
 * 8. 测试环境检测测试
 */
contract GreenTalesNFTTest is Test {
    GreenTalesNFT public nft;      // NFT合约实例
    address public owner;          // 合约所有者
    address public user1;          // 测试用户1
    address public user2;          // 测试用户2
    address public greenTrace;     // GreenTrace合约地址

    /**
     * @dev 测试环境设置
     * @notice 在每个测试用例执行前运行
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        greenTrace = makeAddr("greenTrace");
        nft = new GreenTalesNFT(greenTrace);  // 使用模拟的 GreenTrace 地址
    }

    /**
     * @dev 测试初始状态
     * @notice 验证合约部署后的初始状态是否正确
     */
    function test_InitialState() public view {
        assertEq(nft.owner(), owner);
        assertEq(nft.nextTokenId(), 0);
        assertEq(nft.greenTrace(), greenTrace);
        assertTrue(nft.isTestEnvironment());  // 在测试网络中应该为 true
    }

    /**
     * @dev 测试NFT铸造
     * @notice 验证授权铸造者是否可以正确铸造NFT
     */
    function test_Mint() public {
        string memory title = "Green Story";
        string memory detail = "A story about carbon reduction";
        uint256 carbonReduction = 1000;
        uint256 initialPrice = 100 ether;
        string memory tokenURI = "ipfs://Qm...";

        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, title, detail, carbonReduction, initialPrice, tokenURI);

        assertEq(tokenId, 0);
        assertEq(nft.ownerOf(tokenId), user1);
        assertEq(nft.nextTokenId(), 1);

        GreenTalesNFT.StoryMeta memory meta = nft.getStoryMeta(tokenId);
        assertEq(meta.storyTitle, title);
        assertEq(meta.storyDetail, detail);
        assertEq(meta.carbonReduction, carbonReduction);
        assertEq(meta.initialPrice, initialPrice);
        assertEq(meta.lastPrice, initialPrice);
        assertTrue(meta.createTime > 0);
    }

    /**
     * @dev 测试NFT销毁
     * @notice 验证NFT所有者是否可以正确销毁NFT
     */
    function test_Burn() public {
        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(user1);
        nft.burn(tokenId);

        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(tokenId);
    }

    /**
     * @dev 测试价格更新
     * @notice 验证GreenTrace合约是否可以正确更新NFT价格
     */
    function test_UpdatePrice() public {
        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        uint256 newPrice = 150 ether;
        vm.prank(greenTrace);
        nft.updateLastPrice(tokenId, newPrice);

        GreenTalesNFT.StoryMeta memory meta = nft.getStoryMeta(tokenId);
        assertEq(meta.lastPrice, newPrice);
        assertEq(meta.initialPrice, 100 ether);  // 初始价格不应改变
    }

    /**
     * @dev 测试设置GreenTrace地址
     * @notice 验证合约所有者是否可以正确更新GreenTrace地址
     */
    function test_SetGreenTrace() public {
        address newGreenTrace = makeAddr("newGreenTrace");
        nft.setGreenTrace(newGreenTrace);
        assertEq(nft.greenTrace(), newGreenTrace);
    }

    /**
     * @dev 测试非铸造者铸造失败
     * @notice 验证非授权铸造者无法铸造NFT
     */
    function test_RevertWhen_MintNotAuthorized() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized: Only GreenTrace or test owner");
        nft.mint(user2, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");
    }

    /**
     * @dev 测试非所有者销毁失败
     * @notice 验证非NFT所有者无法销毁NFT
     */
    function test_RevertWhen_BurnNotOwner() public {
        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(user2);
        vm.expectRevert("Not owner nor approved"); 
        nft.burn(tokenId);
    }

    /**
     * @dev 测试非GreenTrace更新价格失败
     * @notice 验证非GreenTrace合约无法更新NFT价格
     */
    function test_RevertWhen_UpdatePriceNotGreenTrace() public {
        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(user1);
        vm.expectRevert("Not authorized: Only GreenTrace or test owner");
        nft.updateLastPrice(tokenId, 150 ether);
    }

    /**
     * @dev 测试非所有者设置GreenTrace失败
     * @notice 验证非合约所有者无法更新GreenTrace地址
     */
    function test_RevertWhen_SetGreenTraceNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        nft.setGreenTrace(makeAddr("newGreenTrace"));
    }

    /**
     * @dev 测试获取不存在的NFT元数据失败
     * @notice 验证获取不存在的NFT元数据会抛出异常
     */
    function test_RevertWhen_GetStoryMetaNotExist() public {
        vm.expectRevert("Token does not exist");
        nft.getStoryMeta(999);
    }
} 