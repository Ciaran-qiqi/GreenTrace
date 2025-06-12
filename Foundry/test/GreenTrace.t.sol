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
     * @notice 确保 CarbonToken 的 owner 是当前测试合约，先 setGreenTrace 再 transferOwnership
     */
    function setUp() public {
        owner = address(this);
        auditor = makeAddr("auditor");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // 先部署 CarbonToken，此时 owner 是当前测试合约
        carbonToken = new CarbonToken(INITIAL_SUPPLY);
        
        // 部署 GreenTrace 合约，先不设置 NFT 地址
        greenTrace = new GreenTrace(address(carbonToken), address(0));
        
        // 部署 NFT 合约，设置 GreenTrace 为调用者
        nft = new GreenTalesNFT(address(greenTrace));
        
        // 设置 GreenTrace 的 NFT 地址
        greenTrace.setNFTContract(address(nft));

        // 设置 CarbonToken 的权限
        carbonToken.setGreenTrace(address(greenTrace));
        carbonToken.transferOwnership(address(greenTrace));
        
        // 初始化 GreenTrace
        greenTrace.initialize();
        
        greenTrace.addAuditor(auditor);
    }

    /**
     * @dev 测试初始状态
     * @notice 验证合约部署后的初始状态是否正确
     */
    function test_InitialState() public {
        assertEq(greenTrace.owner(), owner);
        assertEq(address(greenTrace.carbonToken()), address(carbonToken));
        assertEq(address(greenTrace.greenTalesNFT()), address(nft));
        assertTrue(greenTrace.auditors(auditor));
    }

    /**
     * @dev 测试添加和移除审计人员
     * @notice 验证合约所有者是否可以正确管理审计人员
     */
    function test_AddRemoveAuditor() public {
        address newAuditor = makeAddr("newAuditor");
        greenTrace.addAuditor(newAuditor);
        assertTrue(greenTrace.auditors(newAuditor));

        greenTrace.removeAuditor(newAuditor);
        assertFalse(greenTrace.auditors(newAuditor));
    }

    /**
     * @dev 测试提交审计
     * @notice 验证审计者是否可以正确提交审计结果
     */
    function test_SubmitAudit() public {
        vm.prank(address(greenTrace));
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(auditor);
        greenTrace.submitAudit(tokenId, 800);

        (address auditorAddr, uint256 nftId, uint256 carbonValue, GreenTrace.AuditStatus status, uint256 timestamp) = greenTrace.audits(tokenId);
        assertEq(auditorAddr, auditor);
        assertEq(nftId, tokenId);
        assertEq(carbonValue, 800);
        assertEq(uint256(status), 0);
    }

    /**
     * @dev 测试完成审计
     * @notice 验证合约所有者是否可以正确完成审计
     */
    function test_CompleteAudit() public {
        vm.prank(address(greenTrace));
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(auditor);
        greenTrace.submitAudit(tokenId, 800);

        greenTrace.completeAudit(tokenId, GreenTrace.AuditStatus.Approved);
        (address auditorAddr, uint256 nftId, uint256 carbonValue, GreenTrace.AuditStatus status, uint256 timestamp) = greenTrace.audits(tokenId);
        assertEq(uint256(status), uint256(GreenTrace.AuditStatus.Approved));
    }

    /**
     * @dev 测试NFT兑换
     * @notice 验证用户是否可以正确将NFT兑换为碳币
     */
    function test_ExchangeNFT() public {
        // 由 GreenTrace 合约铸造 NFT 给 user1
        vm.prank(address(greenTrace));
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        // 由 auditor 提交审计结果
        vm.prank(auditor);
        greenTrace.submitAudit(tokenId, 800);

        // 由 owner 完成审计，状态为 Approved
        greenTrace.completeAudit(tokenId, GreenTrace.AuditStatus.Approved);

        // 记录 user1 的初始余额
        uint256 initialBalance = carbonToken.balanceOf(user1);

        // 由 user1 授权 GreenTrace 合约销毁 NFT
        vm.prank(user1);
        nft.approve(address(greenTrace), tokenId);

        // 由 user1 调用 exchangeNFT，将 NFT 兑换为碳币（合约内部会自动转移和销毁NFT）
        vm.prank(user1);
        greenTrace.exchangeNFT(tokenId);

        // 计算系统手续费、审计费用和实际返还金额
        uint256 systemFee = greenTrace.calculateSystemFee(800);
        uint256 auditFee = greenTrace.calculateAuditFee(800);
        uint256 returnAmount = greenTrace.calculateReturnAmount(800);

        // 验证 user1 的余额增加了实际返还金额
        assertEq(carbonToken.balanceOf(user1), initialBalance + returnAmount);
        // 验证 owner 的余额为初始供应加上系统手续费
        assertEq(carbonToken.balanceOf(owner), INITIAL_SUPPLY + systemFee);
        // 验证 auditor 的余额增加了审计费用
        assertEq(carbonToken.balanceOf(auditor), auditFee);
    }

    /**
     * @dev 测试非审计者提交审计失败
     * @notice 验证非审计者无法提交审计结果
     */
    function test_RevertWhen_SubmitAuditNotAuditor() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized auditor");
        greenTrace.submitAudit(0, 800);
    }

    /**
     * @dev 测试非所有者完成审计失败
     * @notice 验证非合约所有者无法完成审计
     */
    function test_RevertWhen_CompleteAuditNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        greenTrace.completeAudit(0, GreenTrace.AuditStatus.Approved);
    }

    /**
     * @dev 测试未批准审计兑换NFT失败
     * @notice 验证用户无法兑换未通过审计的NFT
     */
    function test_RevertWhen_ExchangeNFTNotApproved() public {
        vm.prank(address(greenTrace));
        uint256 tokenId = nft.mint(user1, "Title", "Detail", 1000, 100 ether, "ipfs://Qm...");

        vm.prank(user1);
        vm.expectRevert("Audit not approved");
        greenTrace.exchangeNFT(tokenId);
    }
} 