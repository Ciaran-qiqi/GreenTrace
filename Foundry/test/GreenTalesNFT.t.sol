// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesNFT.sol";

/**
 * @title GreenTalesNFT Test Cases
 * @dev Covers core logic of NFT minting, burning, permissions, etc.
 * 
 * Test cases include:
 * 1. Initial state tests
 * 2. NFT minting tests
 * 3. NFT burning tests
 * 4. Permission control tests
 * 5. Metadata management tests
 * 6. Error handling tests
 * 7. Price update tests
 * 8. Test environment detection tests
 */
contract GreenTalesNFTTest is Test {
    GreenTalesNFT public nft;      // NFT contract instance
    address public owner;          // Contract owner
    address public user1;          // Test user 1
    address public user2;          // Test user 2
    address public greenTrace;     // GreenTrace contract address

    /**
     * @dev Test environment setup
     * @notice Runs before each test case
     */
    function setUp() public {
        owner = address(this);
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        greenTrace = makeAddr("greenTrace");
        nft = new GreenTalesNFT(greenTrace);  // Use mock GreenTrace address
    }

    /**
     * @dev Test initial state
     * @notice Verify initial state after contract deployment
     */
    function test_InitialState() public view {
        assertEq(nft.owner(), owner);
        assertEq(nft.nextTokenId(), 0);
        assertEq(nft.greenTrace(), greenTrace);
        assertTrue(nft.isTestEnvironment());  // Should be true in test network
    }

    /**
     * @dev Test NFT minting
     * @notice Verify authorized minter can mint NFTs correctly
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
     * @dev Test NFT burning
     * @notice Verify NFT owner can burn NFTs correctly
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
     * @dev Test price update
     * @notice Verify GreenTrace contract can update NFT prices correctly
     */
    function test_UpdatePrice() public {
        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        uint256 newPrice = 150 ether;
        vm.prank(greenTrace);
        nft.updateLastPrice(tokenId, newPrice);

        GreenTalesNFT.StoryMeta memory meta = nft.getStoryMeta(tokenId);
        assertEq(meta.lastPrice, newPrice);
        assertEq(meta.initialPrice, 100 ether);  // Initial price should not change
    }

    /**
     * @dev Test setting GreenTrace address
     * @notice Verify contract owner can update GreenTrace address correctly
     */
    function test_SetGreenTrace() public {
        address newGreenTrace = makeAddr("newGreenTrace");
        nft.setGreenTrace(newGreenTrace);
        assertEq(nft.greenTrace(), newGreenTrace);
    }

    /**
     * @dev Test unauthorized minting fails
     * @notice Verify unauthorized minter cannot mint NFTs
     */
    function test_RevertWhen_MintNotAuthorized() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized: Only GreenTrace or test owner");
        nft.mint(user2, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");
    }

    /**
     * @dev Test non-owner burning fails
     * @notice Verify non-NFT owner cannot burn NFTs
     */
    function test_RevertWhen_BurnNotOwner() public {
        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(user2);
        vm.expectRevert("Not owner nor approved"); 
        nft.burn(tokenId);
    }

    /**
     * @dev Test non-GreenTrace price update fails
     * @notice Verify non-GreenTrace contract cannot update NFT prices
     */
    function test_RevertWhen_UpdatePriceNotGreenTrace() public {
        vm.prank(greenTrace);
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(user1);
        vm.expectRevert("Not authorized: Only GreenTrace or test owner");
        nft.updateLastPrice(tokenId, 150 ether);
    }

    /**
     * @dev Test non-owner setting GreenTrace fails
     * @notice Verify non-contract owner cannot update GreenTrace address
     */
    function test_RevertWhen_SetGreenTraceNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        nft.setGreenTrace(makeAddr("newGreenTrace"));
    }

    /**
     * @dev Test getting non-existent NFT metadata fails
     * @notice Verify getting non-existent NFT metadata throws exception
     */
    function test_RevertWhen_GetStoryMetaNotExist() public {
        vm.expectRevert("Token does not exist");
        nft.getStoryMeta(999);
    }
} 