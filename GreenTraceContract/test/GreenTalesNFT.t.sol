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
 */
contract GreenTalesNFTTest is Test {
    GreenTalesNFT public nft;      // NFT合约实例
    address public owner;          // 合约所有者
    address public minter;         // 授权铸造者
    address public user1;          // 测试用户1
    address public user2;          // 测试用户2

    /**
     * @dev 测试环境设置
     * @notice 在每个测试用例执行前运行
     */
    function setUp() public {
        owner = address(this);
        minter = makeAddr("minter");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        nft = new GreenTalesNFT();
        nft.setMinter(minter);
    }

    /**
     * @dev 测试初始状态
     * @notice 验证合约部署后的初始状态是否正确
     */
    function test_InitialState() public view {
        assertEq(nft.owner(), owner);
        assertEq(nft.minter(), minter);
        assertEq(nft.nextTokenId(), 0);
    }

    /**
     * @dev 测试NFT铸造
     * @notice 验证授权铸造者是否可以正确铸造NFT
     */
    function test_Mint() public {
        string memory title = "Green Story";
        string memory detail = "A story about carbon reduction";
        uint256 carbonReduction = 1000;
        string memory tokenURI = "ipfs://Qm...";

        vm.prank(minter);
        uint256 tokenId = nft.mint(user1, title, detail, carbonReduction, tokenURI);

        assertEq(tokenId, 0);
        assertEq(nft.ownerOf(tokenId), user1);
        assertEq(nft.nextTokenId(), 1);

        GreenTalesNFT.StoryMeta memory meta = nft.getStoryMeta(tokenId);
        assertEq(meta.storyTitle, title);
        assertEq(meta.storyDetail, detail);
        assertEq(meta.carbonReduction, carbonReduction);
    }

    /**
     * @dev 测试NFT销毁
     * @notice 验证NFT所有者是否可以正确销毁NFT
     */
    function test_Burn() public {
        vm.prank(minter);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, "ipfs://Qm...");

        vm.prank(user1);
        nft.burn(tokenId);

        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(tokenId);
    }

    /**
     * @dev 测试非铸造者铸造失败
     * @notice 验证非授权铸造者无法铸造NFT
     */
    function test_RevertWhen_MintNotMinter() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized");
        nft.mint(user2, "Title", "Detail", 1000, "ipfs://Qm...");
    }

    /**
     * @dev 测试非所有者销毁失败
     * @notice 验证非NFT所有者无法销毁NFT
     */
    function test_RevertWhen_BurnNotOwner() public {
        vm.prank(minter);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, "ipfs://Qm...");

        vm.prank(user2);
        vm.expectRevert("Not owner nor approved"); 
        // 这里必须与合约 revert 信息完全一致
        nft.burn(tokenId);
    }

    /**
     * @dev 测试设置铸造者
     * @notice 验证合约所有者是否可以更改授权铸造者
     */
    function test_SetMinter() public {
        address newMinter = makeAddr("newMinter");
        nft.setMinter(newMinter);
        assertEq(nft.minter(), newMinter);
    }

    /**
     * @dev 测试非所有者设置铸造者失败
     * @notice 验证非合约所有者无法更改授权铸造者
     */
    function test_RevertWhen_SetMinterNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        nft.setMinter(user2);
    }
} 