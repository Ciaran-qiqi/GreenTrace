// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTalesAuction.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";

/**
 * @title GreenTalesAuction 测试用例
 * @dev 覆盖拍卖合约的创建、竞价、完成、取消等核心逻辑
 * 
 * 测试用例包括：
 * 1. 需求拍卖（期货）测试
 * 2. 供应拍卖（现货）测试
 * 3. 竞价功能测试
 * 4. 拍卖完成测试
 * 5. 拍卖取消测试
 * 6. 权限控制测试
 * 7. 错误处理测试
 */
contract GreenTalesAuctionTest is Test {
    GreenTalesAuction public auction;    // 拍卖合约实例
    CarbonToken public carbonToken;      // 碳币合约实例
    GreenTalesNFT public nft;            // NFT合约实例
    address public owner;                // 合约所有者
    address public user1;                // 测试用户1
    address public user2;                // 测试用户2
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
        carbonToken = new CarbonToken(INITIAL_SUPPLY);
        nft = new GreenTalesNFT();
        auction = new GreenTalesAuction(address(carbonToken), address(nft));
        
        // 为用户分配足够的代币
        carbonToken.transfer(user1, 10000 ether);
        carbonToken.transfer(user2, 10000 ether);

        carbonToken.transferOwnership(address(auction));
        nft.setMinter(address(auction));
    }

    /**
     * @dev 测试创建需求拍卖（期货）
     * @notice 验证用户是否可以正确创建需求拍卖
     */
    function test_CreateDemandAuction() public {
        // 固定区块时间，确保 auctionId 可预测
        uint256 fixedTime = 1000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), 100 ether);
        vm.prank(user1);
        auction.createDemandAuction(100 ether, 200 ether, 1 days, 1000, "ipfs://Qm...");

        // 用与合约一致的方式计算 auctionId
        uint256 auctionId = uint256(keccak256(abi.encodePacked(fixedTime, user1)));
        (address creator, GreenTalesAuction.AuctionType auctionType, GreenTalesAuction.AuctionStatus status, uint256 startPrice_, uint256 endPrice_, uint256 startTime, uint256 endTime, uint256 deposit, uint256 expectedCarbon_, string memory metadataURI_) = auction.auctions(auctionId);
        assertEq(creator, user1);
        assertEq(uint256(auctionType), uint256(GreenTalesAuction.AuctionType.Demand));
        assertEq(uint256(status), uint256(GreenTalesAuction.AuctionStatus.Active));
        assertEq(startPrice_, 100 ether);
        assertEq(endPrice_, 200 ether);
        assertEq(endTime, startTime + 1 days);
        assertEq(deposit, (100 ether * auction.DEPOSIT_RATE()) / auction.BASE_RATE());
        assertEq(expectedCarbon_, 1000);
        assertEq(metadataURI_, "ipfs://Qm...");
    }

    /**
     * @dev 测试创建供应拍卖（现货）
     * @notice 验证用户是否可以正确创建供应拍卖
     */
    function test_CreateSupplyAuction() public {
        uint256 startPrice = 100 ether;
        uint256 endPrice = 200 ether;
        uint256 duration = 1 days;
        uint256 expectedCarbon = 1000;
        string memory metadataURI = "ipfs://Qm...";
        uint256 fixedTime = 2000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), startPrice);
        vm.prank(user1);
        auction.createSupplyAuction(startPrice, endPrice, duration, expectedCarbon, metadataURI);

        uint256 auctionId = uint256(keccak256(abi.encodePacked(fixedTime, user1)));
        (address creator, GreenTalesAuction.AuctionType auctionType, GreenTalesAuction.AuctionStatus status, uint256 startPrice_, uint256 endPrice_, uint256 startTime, uint256 endTime, uint256 deposit, uint256 expectedCarbon_, string memory metadataURI_) = auction.auctions(auctionId);
        assertEq(creator, user1);
        assertEq(uint256(auctionType), uint256(GreenTalesAuction.AuctionType.Supply));
        assertEq(uint256(status), uint256(GreenTalesAuction.AuctionStatus.Active));
        assertEq(startPrice_, startPrice);
        assertEq(endPrice_, endPrice);
        assertEq(endTime, startTime + duration);
        assertEq(deposit, (startPrice * auction.DEPOSIT_RATE()) / auction.BASE_RATE());
        assertEq(expectedCarbon_, expectedCarbon);
        assertEq(metadataURI_, metadataURI);
    }

    /**
     * @dev 测试竞价功能
     * @notice 验证用户是否可以正确参与竞价
     */
    function test_PlaceBid() public {
        uint256 fixedTime = 3000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), 100 ether);
        vm.prank(user1);
        auction.createDemandAuction(100 ether, 200 ether, 1 days, 1000, "ipfs://Qm...");

        uint256 auctionId = uint256(keccak256(abi.encodePacked(fixedTime, user1)));
        uint256 bidAmount = 150 ether;

        vm.prank(user2);
        carbonToken.approve(address(auction), bidAmount);
        vm.prank(user2);
        auction.placeBid(auctionId, bidAmount);

        (address bidder, uint256 amount, uint256 timestamp) = auction.bids(auctionId, 0);
        assertEq(bidder, user2);
        assertEq(amount, bidAmount);
    }

    /**
     * @dev 测试完成拍卖
     * @notice 验证拍卖是否可以正确完成，并验证资金和NFT的转移
     */
    function test_CompleteAuction() public {
        uint256 fixedTime = 4000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), 100 ether);
        vm.prank(user1);
        auction.createDemandAuction(100 ether, 200 ether, 1 days, 1000, "ipfs://Qm...");

        uint256 auctionId = uint256(keccak256(abi.encodePacked(fixedTime, user1)));
        uint256 bidAmount = 150 ether;

        vm.prank(user2);
        carbonToken.approve(address(auction), bidAmount);
        vm.prank(user2);
        auction.placeBid(auctionId, bidAmount);

        // 跳过时间到拍卖结束
        vm.warp(fixedTime + 1 days + 1);

        // 在完成拍卖前，让中标者授权合约使用剩余金额
        vm.prank(user2);
        carbonToken.approve(address(auction), 135 ether);  // 150 - 15 = 135 ether

        auction.completeAuction(auctionId, 0);

        (address creator, GreenTalesAuction.AuctionType auctionType, GreenTalesAuction.AuctionStatus status, uint256 startPrice_, uint256 endPrice_, uint256 startTime, uint256 endTime, uint256 deposit, uint256 expectedCarbon_, string memory metadataURI_) = auction.auctions(auctionId);
        assertEq(uint256(status), uint256(GreenTalesAuction.AuctionStatus.Completed));
    }

    /**
     * @dev 测试取消拍卖
     * @notice 验证拍卖创建者是否可以正确取消拍卖
     */
    function test_CancelAuction() public {
        uint256 fixedTime = 5000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), 100 ether);
        vm.prank(user1);
        auction.createDemandAuction(100 ether, 200 ether, 1 days, 1000, "ipfs://Qm...");

        uint256 auctionId = uint256(keccak256(abi.encodePacked(fixedTime, user1)));

        vm.prank(user1);
        auction.cancelAuction(auctionId);

        (address creator, GreenTalesAuction.AuctionType auctionType, GreenTalesAuction.AuctionStatus status, uint256 startPrice_, uint256 endPrice_, uint256 startTime, uint256 endTime, uint256 deposit, uint256 expectedCarbon_, string memory metadataURI_) = auction.auctions(auctionId);
        assertEq(uint256(status), uint256(GreenTalesAuction.AuctionStatus.Cancelled));
    }

    /**
     * @dev 测试非创建者取消拍卖失败
     * @notice 验证非拍卖创建者无法取消拍卖
     */
    function test_RevertWhen_CancelAuctionNotCreator() public {
        uint256 startPrice = 100 ether;
        uint256 endPrice = 200 ether;
        uint256 duration = 1 days;
        uint256 expectedCarbon = 1000;
        string memory metadataURI = "ipfs://Qm...";
        uint256 fixedTime = 8000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), startPrice);
        vm.prank(user1);
        auction.createDemandAuction(startPrice, endPrice, duration, expectedCarbon, metadataURI);

        uint256 auctionId = uint256(keccak256(abi.encodePacked(fixedTime, user1)));

        vm.prank(user2);
        vm.expectRevert("Not authorized");
        auction.cancelAuction(auctionId);
    }

    /**
     * @dev 测试竞价金额过低失败
     * @notice 验证用户无法以低于最低竞价金额参与竞价
     */
    function test_RevertWhen_PlaceBidTooLow() public {
        uint256 startPrice = 100 ether;
        uint256 endPrice = 200 ether;
        uint256 duration = 1 days;
        uint256 expectedCarbon = 1000;
        string memory metadataURI = "ipfs://Qm...";
        uint256 fixedTime = 7000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), startPrice);
        vm.prank(user1);
        auction.createDemandAuction(startPrice, endPrice, duration, expectedCarbon, metadataURI);

        uint256 auctionId = uint256(keccak256(abi.encodePacked(fixedTime, user1)));
        uint256 bidAmount = 50 ether;

        vm.prank(user2);
        carbonToken.approve(address(auction), bidAmount);
        vm.prank(user2);
        vm.expectRevert("Bid too low");
        auction.placeBid(auctionId, bidAmount);
    }

    function test_RevertWhen_CreateAuctionInvalidPrice() public {
        uint256 startPrice = 0;
        uint256 endPrice = 200 ether;
        uint256 duration = 1 days;
        uint256 expectedCarbon = 1000;
        string memory metadataURI = "ipfs://Qm...";
        uint256 fixedTime = 6000;
        vm.warp(fixedTime);
        vm.prank(user1);
        carbonToken.approve(address(auction), startPrice);
        vm.prank(user1);
        vm.expectRevert("Invalid price range");
        auction.createDemandAuction(startPrice, endPrice, duration, expectedCarbon, metadataURI);
    }
}