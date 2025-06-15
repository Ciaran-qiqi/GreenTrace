// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/GreenTrace.sol";
import "../src/CarbonToken.sol";
import "../src/GreenTalesNFT.sol";

/**
 * @title GreenTrace 测试用例
 * @dev 覆盖碳减排项目审计、NFT兑换、费用计算等核心逻辑
 * 
 * 测试用例包括：
 * 1. 初始状态测试
 * 2. 审计人员管理测试
 * 3. 审计流程测试
 * 4. NFT兑换测试
 * 5. 权限控制测试
 * 6. 错误处理测试
 */
contract GreenTraceTest is Test {
    GreenTrace public greenTrace;        // GreenTrace合约实例
    CarbonToken public carbonToken;      // 碳币合约实例
    GreenTalesNFT public nft;            // NFT合约实例
    address public owner;                // 合约所有者
    address public auditor;              // 审计者
    address public user1;                // 测试用户1
    address public user2;                // 测试用户2
    uint256 public constant INITIAL_SUPPLY = 1000000 ether;  // 初始供应量

    /**
     * @dev 测试环境设置
     * @notice 在每个测试用例执行前运行，初始化合约和用户
     */
    function setUp() public {
        owner = address(this);
        auditor = makeAddr("auditor");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // 部署 CarbonToken
        CarbonToken.InitialBalance[] memory initialBalances = new CarbonToken.InitialBalance[](1);
        initialBalances[0] = CarbonToken.InitialBalance(owner, INITIAL_SUPPLY);
        carbonToken = new CarbonToken(initialBalances);
        
        // 部署 GreenTrace 合约
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        
        // 部署 NFT 合约
        nft = new GreenTalesNFT(address(greenTrace));

        
        // 设置合约权限、地址和初始化
        carbonToken.setGreenTrace(address(greenTrace));
        carbonToken.transferOwnership(address(greenTrace));
        greenTrace.setNFTContract(address(nft));
        greenTrace.initialize();
        greenTrace.addAuditor(auditor);

        // 给测试用户分配碳币
        carbonToken.transfer(user1, 1000 ether);
        carbonToken.transfer(user2, 1000 ether);
    }

    /**
     * @dev 测试初始状态
     */
    function test_InitialState() public view {
        assertEq(address(greenTrace.carbonToken()), address(carbonToken));
        assertEq(address(greenTrace.greenTalesNFT()), address(nft));
        assertTrue(greenTrace.initialized());
        assertTrue(greenTrace.auditors(auditor));
    }

    /**
     * @dev 测试NFT铸造流程
     */
    function test_NFTMintFlow() public {
        // 申请铸造NFT
        vm.startPrank(user1);
        carbonToken.approve(address(greenTrace), 100 ether);
        uint256 tokenId = greenTrace.requestMintNFT(
            "Test Story",
            "This is a test story",
            1000,
            "ipfs://Qm..."
        );

        // 审计者提交审计
        vm.stopPrank();
        vm.prank(auditor);
        greenTrace.submitMintAudit(tokenId, 800, "");

        // 支付费用并铸造NFT
        vm.startPrank(user1);
        carbonToken.approve(address(greenTrace), 100 ether);
        uint256 mintedTokenId = greenTrace.payAndMintNFT(
            tokenId,
            user1,
            "Test Story",
            "This is a test story",
            1000,
            "ipfs://Qm..."
        );

        // 验证NFT所有权和元数据
        assertEq(nft.ownerOf(mintedTokenId), user1);
        GreenTalesNFT.StoryMeta memory meta = nft.getStoryMeta(mintedTokenId);
        assertEq(meta.storyTitle, "Test Story");
        assertEq(meta.storyDetail, "This is a test story");
        assertEq(meta.carbonReduction, 1000);
        assertEq(meta.initialPrice, 800);
        assertEq(meta.lastPrice, 800);
        vm.stopPrank();
    }

    /**
     * @dev 测试NFT兑换流程
     */
    function test_NFTExchangeFlow() public {
        // 先铸造一个NFT
        vm.startPrank(user1);
        carbonToken.approve(address(greenTrace), 100 ether);
        uint256 tokenId = greenTrace.requestMintNFT(
            "Test Story",
            "This is a test story",
            1000,
            "ipfs://Qm..."
        );

        vm.stopPrank();
        vm.prank(auditor);
        greenTrace.submitMintAudit(tokenId, 800, "");

        vm.startPrank(user1);
        carbonToken.approve(address(greenTrace), 100 ether);
        uint256 mintedTokenId = greenTrace.payAndMintNFT(
            tokenId,
            user1,
            "Test Story",
            "This is a test story",
            1000,
            "ipfs://Qm..."
        );

        // 申请兑换NFT前，先进行NFT授权
        nft.approve(address(greenTrace), mintedTokenId);
        
        // 申请兑换NFT
        carbonToken.approve(address(greenTrace), 100 ether);
        greenTrace.requestExchangeNFT(mintedTokenId);

        // 审计者提交兑换审计
        vm.stopPrank();
        vm.prank(auditor);
        greenTrace.submitExchangeAudit(mintedTokenId, 700);

        // 完成兑换审计
        greenTrace.completeExchangeAudit(mintedTokenId, GreenTrace.AuditStatus.Approved);

        // 记录初始余额
        uint256 initialBalance = carbonToken.balanceOf(user1);

        // 执行NFT兑换
        vm.startPrank(user1);
        // 由于之前已经授权，这里不需要再次授权
        greenTrace.exchangeNFT(mintedTokenId);

        // 验证NFT已被销毁
        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(mintedTokenId);

        // 验证碳币余额
        uint256 systemFee = greenTrace.calculateSystemFee(700);
        uint256 auditFee = greenTrace.calculateAuditFee(700);
        uint256 returnAmount = greenTrace.calculateReturnAmount(700);
        assertEq(carbonToken.balanceOf(user1), initialBalance + returnAmount);
        vm.stopPrank();
    }

    /**
     * @dev 测试审计拒绝流程
     */
    function test_AuditRejection() public {
        // 申请铸造NFT
        vm.startPrank(user1);
        carbonToken.approve(address(greenTrace), 100 ether);
        uint256 tokenId = greenTrace.requestMintNFT(
            "Test Story",
            "This is a test story",
            1000,
            "ipfs://Qm..."
        );

        // 审计者拒绝申请
        vm.stopPrank();
        vm.prank(auditor);
        greenTrace.submitMintAudit(tokenId, 0, "Invalid carbon reduction claim");

        // 验证无法支付费用并铸造NFT
        vm.startPrank(user1);
        carbonToken.approve(address(greenTrace), 100 ether);
        vm.expectRevert("Mint audit not approved");
        greenTrace.payAndMintNFT(
            tokenId,
            user1,
            "Test Story",
            "This is a test story",
            1000,
            "ipfs://Qm..."
        );
        vm.stopPrank();
    }

    /**
     * @dev 测试错误处理
     */
    function test_ErrorHandling() public {
        // 测试非审计者提交审计
        vm.prank(user1);
        vm.expectRevert("Not authorized auditor");
        greenTrace.submitMintAudit(0, 800, "");

        // 测试非所有者完成审计
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        greenTrace.completeExchangeAudit(0, GreenTrace.AuditStatus.Approved);

        // 测试未初始化合约
        GreenTrace newGreenTrace = new GreenTrace(address(carbonToken), address(0));
        vm.expectRevert("Not initialized");
        newGreenTrace.addAuditor(auditor);
    }

    /**
     * @dev 测试费用计算
     */
    function test_FeeCalculation() public {
        uint256 amount = 1000 ether;
        uint256 systemFee = greenTrace.calculateSystemFee(amount);
        uint256 auditFee = greenTrace.calculateAuditFee(amount);
        uint256 returnAmount = greenTrace.calculateReturnAmount(amount);

        // 验证费用计算
        assertEq(systemFee, 10 ether);  // 1%
        assertEq(auditFee, 40 ether);   // 4%
        assertEq(returnAmount, 950 ether); // 95%
        assertEq(systemFee + auditFee + returnAmount, amount);
    }
} 