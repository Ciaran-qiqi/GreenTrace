// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "./CarbonToken.sol";
import "./GreenTalesNFT.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";

/**
 * @title GreenTrace
 * @dev 绿迹项目主合约，管理NFT和代币的铸造、销毁和分发
 * @notice 负责碳减排项目的审计、NFT兑换和费用分配
 * 
 * 主要功能：
 * 1. 审计管理：添加/移除审计人员，提交和完成审计
 * 2. NFT兑换：将审核通过的NFT兑换为碳币，并分配相关费用
 * 3. 费用计算：计算系统手续费和审计费用
 * 4. 权限控制：管理审计人员白名单
 * 5. 业务合约管理：管理授权的业务合约（如交易市场）
 * 
 * ID系统设计：
 * 1. 铸造申请ID系统：用于铸造申请和审计流程跟踪（nextRequestId自增）
 * 2. 兑换申请ID系统：用于兑换申请和审计流程跟踪（nextCashId自增）
 * 3. NFT ID系统：真实的ERC721 tokenId（只有铸造成功时才分配）
 */
contract GreenTrace is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for CarbonToken;
    
    // 合约状态变量
    CarbonToken public carbonToken;    // 碳币合约
    GreenTalesNFT public greenTalesNFT;  // NFT合约
    bool public initialized;           // 初始化状态
    bool public isTestEnvironment;     // 是否为测试环境
    
    // 申请ID系统（独立于NFT ID）
    uint256 public nextRequestId;      // 下一个铸造申请ID（自增，不销毁）
    uint256 public nextCashId;         // 下一个兑换申请ID（自增，不销毁）
    
    // 费用比例常量
    uint256 public constant SYSTEM_FEE_RATE = 100;  // 1%
    uint256 public constant AUDIT_FEE_RATE = 400;   // 4%
    uint256 public constant BASE_RATE = 10000;      // 100%
    
    // 审计状态枚举
    enum AuditStatus { Pending, Approved, Rejected }  // 待审核、已批准、已拒绝
    
    // 审计类型枚举
    enum AuditType { Mint, Exchange }  // 铸造审计、兑现审计
    
    /**
     * @dev 申请/审计结构体
     * @param requester 申请人地址
     * @param auditor 审计人员地址
     * @param requestId 申请ID（独立的ID系统）
     * @param nftTokenId NFT ID（只有铸造成功后才有值，失败时为0）
     * @param carbonValue 碳价值
     * @param status 审计状态
     * @param auditType 审计类型
     * @param requestTimestamp 申请时间
     * @param auditTimestamp 审计时间
     * @param auditComment 审计意见/备注
     * @param requestData 申请相关数据
     */
    struct Audit {
        address requester;         // 申请人地址
        address auditor;           // 审计人员地址
        uint256 requestId;         // 申请ID（独立的ID系统）
        uint256 nftTokenId;        // NFT ID（只有铸造成功后才有值）
        uint256 carbonValue;       // 碳价值
        AuditStatus status;        // 审计状态
        AuditType auditType;       // 审计类型
        uint256 requestTimestamp;  // 申请时间
        uint256 auditTimestamp;    // 审计时间
        string auditComment;       // 审计意见/备注
        RequestData requestData;   // 申请相关数据
    }
    
    /**
     * @dev 申请数据结构体
     * @param title 故事标题
     * @param storyDetails 故事详情
     * @param carbonReduction 碳减排量
     * @param tokenURI NFT元数据URI
     * @param requestFee 申请手续费
     */
    struct RequestData {
        string title;
        string storyDetails;
        uint256 carbonReduction;
        string tokenURI;
        uint256 requestFee;
    }
    
    // 映射关系
    mapping(uint256 => Audit) public audits;  // 铸造申请ID => 审计信息
    mapping(uint256 => Audit) public cashAudits;  // 兑换申请ID => 审计信息
    mapping(address => bool) public auditors; // 审计人员白名单
    mapping(address => bool) public businessContracts; // 业务合约白名单
    
    // 事件定义
    event AuditSubmitted(uint256 indexed requestId, address indexed auditor, uint256 carbonValue, AuditType auditType);
    event AuditCompleted(uint256 indexed requestId, AuditStatus status, AuditType auditType);
    event NFTExchanged(uint256 indexed tokenId, address indexed owner, uint256 carbonAmount);
    event AuditorAdded(address indexed auditor);
    event AuditorRemoved(address indexed auditor);
    event BusinessContractAdded(address indexed contractAddress);
    event BusinessContractRemoved(address indexed contractAddress);
    event NFTMintedByBusiness(uint256 indexed tokenId, address indexed recipient, string title, uint256 carbonReduction);
    event NFTPriceUpdatedByBusiness(uint256 indexed tokenId, uint256 newPrice);
    event ContractInitialized(
        address indexed carbonToken,
        address indexed greenTalesNFT,
        uint256 timestamp
    );
    event FeeDistribution(
        uint256 indexed requestId,
        uint256 totalAmount,
        uint256 systemFee,
        uint256 auditFee,
        uint256 returnAmount,
        uint256 timestamp
    );
    event NFTMintedAfterAudit(uint256 indexed requestId, uint256 indexed nftTokenId, address indexed recipient, string title, uint256 carbonReduction);
    event MintRequested(
        uint256 indexed requestId,
        address indexed requester,
        string title,
        string details,
        uint256 carbonReduction,
        string tokenURI,
        uint256 totalFee
    );
    event ExchangeRequested(
        uint256 indexed cashId,
        address indexed requester,
        uint256 nftTokenId,
        uint256 basePrice,
        uint256 totalFee
    );
    event AuditRejected(uint256 indexed requestId, address indexed auditor, string reason);
    
    /**
     * @dev 构造函数
     * @param _carbonToken 碳币合约地址
     * @param _greenTalesNFT NFT合约地址（可以为0地址，后续设置）
     */
    constructor(address _carbonToken, address _greenTalesNFT) Ownable() {
        carbonToken = CarbonToken(_carbonToken);
        if (_greenTalesNFT != address(0)) {
            greenTalesNFT = GreenTalesNFT(_greenTalesNFT);
        }
        // 根据链 ID 判断是否为测试环境
        // 1: Ethereum Mainnet, 5: Goerli, 11155111: Sepolia, 31337: Hardhat/Foundry
        uint256 chainId = block.chainid;
        isTestEnvironment = (chainId == 5 || chainId == 11155111 || chainId == 31337);
        nextRequestId = 1; // 铸造申请ID从1开始
        nextCashId = 1;    // 兑换申请ID从1开始
    }

    /**
     * @dev 设置NFT合约地址
     * @param _greenTalesNFT NFT合约地址
     * @notice 只有合约所有者可以调用此函数
     */
    function setNFTContract(address _greenTalesNFT) external onlyOwner {
        require(_greenTalesNFT != address(0), "Invalid NFT contract address");
        greenTalesNFT = GreenTalesNFT(_greenTalesNFT);
    }

    /**
     * @dev 初始化函数
     * @notice 必须在部署后调用此函数完成初始化
     * @notice 只有合约所有者可以调用此函数
     */
    function initialize() external onlyOwner {
        require(!initialized, "Already initialized");
        require(address(carbonToken) != address(0), "CarbonToken not set");
        require(address(greenTalesNFT) != address(0), "GreenTalesNFT not set");
        
        initialized = true;
        emit ContractInitialized(address(carbonToken), address(greenTalesNFT), block.timestamp);
    }

    /**
     * @dev 初始化检查修饰器
     * @notice 确保合约已经完成初始化
     */
    modifier whenInitialized() {
        require(initialized, "Not initialized");
        _;
    }
    
    /**
     * @dev 添加审计人员
     * @param _auditor 审计人员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function addAuditor(address _auditor) external onlyOwner whenInitialized {
        auditors[_auditor] = true;
        emit AuditorAdded(_auditor);
    }
    
    /**
     * @dev 移除审计人员
     * @param _auditor 审计人员地址
     * @notice 只有合约所有者可以调用此函数
     */
    function removeAuditor(address _auditor) external onlyOwner whenInitialized {
        auditors[_auditor] = false;
        emit AuditorRemoved(_auditor);
    }
    
    /**
     * @dev 计算申请铸造的手续费
     * @param _carbonReduction 碳减排量
     * @return 手续费金额（取碳减排量1%和1个碳币中的较大值）
     */
    function calculateRequestFee(uint256 _carbonReduction) public pure returns (uint256) {
        uint256 percentageFee = _carbonReduction / 100;  // 碳减排量的1%
        uint256 minFee = 1 * 10**18;  // 1个碳币（假设18位小数）
        return percentageFee > minFee ? percentageFee : minFee;
    }

    /**
     * @dev 申请铸造NFT
     * @param _title 故事标题
     * @param _storyDetails 故事详情
     * @param _carbonReduction 碳减排量
     * @param _tokenURI NFT元数据URI
     * @return requestId 申请ID（注意：不是NFT ID）
     * @notice 需要支付申请手续费（碳减排量1%或1个碳币中的较大值）
     * @notice 返回的是申请ID，NFT只有在审计通过并支付费用后才会铸造
     */
    function requestMintNFT(
        string memory _title,
        string memory _storyDetails,
        uint256 _carbonReduction,
        string memory _tokenURI
    ) external whenInitialized returns (uint256) {
        // 计算申请手续费
        uint256 requestFee = calculateRequestFee(_carbonReduction);

        // 检查用户余额
        require(carbonToken.balanceOf(msg.sender) >= requestFee, "Insufficient balance for request fee");
        
        // 转移手续费
        carbonToken.safeTransferFrom(msg.sender, address(this), requestFee);
        
        // 分配手续费给合约所有者
        carbonToken.safeTransfer(owner(), requestFee);
        
        // 使用独立的申请ID系统
        uint256 requestId = nextRequestId++;
        
        // 创建铸造审计记录
        audits[requestId] = Audit({
            requester: msg.sender,
            auditor: address(0),
            requestId: requestId,
            nftTokenId: 0,  // 申请阶段NFT ID为0，只有铸造成功后才设置
            carbonValue: 0,
            status: AuditStatus.Pending,
            auditType: AuditType.Mint,
            requestTimestamp: block.timestamp,
            auditTimestamp: 0,
            auditComment: "",
            requestData: RequestData({
                title: _title,
                storyDetails: _storyDetails,
                carbonReduction: _carbonReduction,
                tokenURI: _tokenURI,
                requestFee: requestFee
            })
        });

        // 记录铸造请求事件
        emit MintRequested(
            requestId,  // 使用申请ID而不是NFT ID
            msg.sender,
            _title,
            _storyDetails,
            _carbonReduction,
            _tokenURI,
            requestFee
        );
        
        return requestId;  // 返回申请ID
    }

    /**
     * @dev 提交铸造审计结果
     * @param _requestId 申请ID（不是NFT ID）
     * @param _carbonValue 碳价值（0表示拒绝）
     * @param _comment 审计意见/备注（拒绝时必填，通过时可选）
     * @notice 只有授权的审计人员可以调用此函数
     * @notice 如果碳价值为0，表示拒绝该申请，此时必须提供拒绝原因
     */
    function submitMintAudit(
        uint256 _requestId,
        uint256 _carbonValue,
        string memory _comment
    ) external whenInitialized {
        require(auditors[msg.sender], "Not authorized auditor");
        require(audits[_requestId].status == AuditStatus.Pending, "Audit already completed");
        require(audits[_requestId].auditType == AuditType.Mint, "Not a mint audit");
        require(audits[_requestId].requestId != 0, "Request does not exist");
        
        // 如果是拒绝申请，必须提供拒绝原因
        if (_carbonValue == 0) {
            require(bytes(_comment).length > 0, "Rejection reason is required");
        }
        
        audits[_requestId].auditor = msg.sender;
        audits[_requestId].carbonValue = _carbonValue;
        audits[_requestId].auditTimestamp = block.timestamp;
        audits[_requestId].auditComment = _comment;  // 存储审计意见（拒绝时为必填，通过时可选）

        if (_carbonValue == 0) {
            // 拒绝申请
            audits[_requestId].status = AuditStatus.Rejected;
            emit AuditRejected(_requestId, msg.sender, _comment);
        } else {
            // 通过申请
            audits[_requestId].status = AuditStatus.Approved;
            emit AuditSubmitted(_requestId, msg.sender, _carbonValue, AuditType.Mint);
        }
        
        emit AuditCompleted(_requestId, audits[_requestId].status, AuditType.Mint);
    }

    /**
     * @dev 支付铸造费用并铸造NFT
     * @param _requestId 申请ID（审计通过的申请）
     * @return nftTokenId 真实的NFT ID
     * @notice 只有铸造审计通过后才能调用此函数
     * @notice 支付费用后，会铸造真实的NFT并返回NFT ID
     */
    function payAndMintNFT(
        uint256 _requestId
    ) external whenInitialized returns (uint256) {
        require(audits[_requestId].status == AuditStatus.Approved, "Mint audit not approved");
        require(audits[_requestId].auditType == AuditType.Mint, "Not a mint audit");
        require(audits[_requestId].carbonValue > 0, "Carbon value not set");
        require(audits[_requestId].requester == msg.sender, "Not the requester");
        
        // 计算手续费
        uint256 systemFee = calculateSystemFee(audits[_requestId].carbonValue);
        uint256 auditFee = calculateAuditFee(audits[_requestId].carbonValue);
        uint256 totalFee = systemFee + auditFee;

        // 检查用户余额
        require(carbonToken.balanceOf(msg.sender) >= totalFee, "Insufficient balance for fees");
        
        // 转移费用
        carbonToken.safeTransferFrom(msg.sender, address(this), totalFee);
        
        // 分配费用
        carbonToken.safeTransfer(owner(), systemFee);  // 系统手续费给合约所有者
        carbonToken.safeTransfer(audits[_requestId].auditor, auditFee);  // 审计费用给审计员
        
        // 铸造NFT（现在才真正铸造NFT）
        uint256 nftTokenId = greenTalesNFT.mint(
            audits[_requestId].requester,
            audits[_requestId].requestData.title,
            audits[_requestId].requestData.storyDetails,
            audits[_requestId].requestData.carbonReduction,
            audits[_requestId].carbonValue,  // 使用审计后的碳价值作为初始价格
            audits[_requestId].requestData.tokenURI
        );
        
        // 更新审计记录中的NFT ID
        audits[_requestId].nftTokenId = nftTokenId;
        
        // 发出费用分配事件
        emit FeeDistribution(
            _requestId,
            audits[_requestId].carbonValue,
            systemFee,
            auditFee,
            audits[_requestId].carbonValue - totalFee,
            block.timestamp
        );
        
        emit NFTMintedAfterAudit(_requestId, nftTokenId, audits[_requestId].requester, audits[_requestId].requestData.title, audits[_requestId].carbonValue);
        
        return nftTokenId;  // 返回真实的NFT ID
    }

    /**
     * @dev 申请兑换NFT
     * @param _nftTokenId NFT ID（真实的NFT ID）
     * @return requestId 兑换申请ID
     * @notice NFT持有者申请将NFT兑换为碳币
     */
    function requestExchangeNFT(uint256 _nftTokenId) external whenInitialized returns (uint256) {
        // 检查调用者是否为NFT持有者
        require(greenTalesNFT.ownerOf(_nftTokenId) == msg.sender, "Not NFT owner");
        
        // 获取NFT的价格信息
        GreenTalesNFT.StoryMeta memory storyMeta = greenTalesNFT.getStoryMeta(_nftTokenId);
        uint256 basePrice = storyMeta.lastPrice > 0 ? storyMeta.lastPrice : storyMeta.initialPrice;
        
        // 计算申请手续费
        uint256 requestFee = calculateRequestFee(basePrice);
        
        // 检查用户余额
        require(carbonToken.balanceOf(msg.sender) >= requestFee, "Insufficient balance for request fee");
        
        // 转移手续费
        carbonToken.safeTransferFrom(msg.sender, address(this), requestFee);
        carbonToken.safeTransfer(owner(), requestFee);
        
        // 创建兑换申请ID（使用独立的兑换ID系统）
        uint256 cashId = nextCashId++;
        
        // 创建兑换审计记录
        cashAudits[cashId] = Audit({
            requester: msg.sender,
            auditor: address(0),
            requestId: cashId,        // 在兑换审计中，requestId字段存储cashId
            nftTokenId: _nftTokenId,  // 这次直接使用真实的NFT ID
            carbonValue: 0,
            status: AuditStatus.Pending,
            auditType: AuditType.Exchange,
            requestTimestamp: block.timestamp,
            auditTimestamp: 0,
            auditComment: "",
            requestData: RequestData({
                title: "",
                storyDetails: "",
                carbonReduction: 0,
                tokenURI: "",
                requestFee: requestFee
            })
        });
        
        emit ExchangeRequested(cashId, msg.sender, _nftTokenId, basePrice, requestFee);
        
        return cashId;
    }

    /**
     * @dev 提交兑换审计结果
     * @param _cashId 兑换申请ID
     * @param _carbonValue 碳价值（兑换可得的碳币数量）
     * @param _comment 审计意见/备注（拒绝时必填，通过时可选）
     */
    function submitExchangeAudit(
        uint256 _cashId,
        uint256 _carbonValue,
        string memory _comment
    ) external whenInitialized {
        require(auditors[msg.sender], "Not authorized auditor");
        require(cashAudits[_cashId].status == AuditStatus.Pending, "Audit already completed");
        require(cashAudits[_cashId].auditType == AuditType.Exchange, "Not an exchange audit");
        require(cashAudits[_cashId].requestId != 0, "Request does not exist");
        
        // 如果是拒绝申请，必须提供拒绝原因
        if (_carbonValue == 0) {
            require(bytes(_comment).length > 0, "Rejection reason is required");
        }
        
        cashAudits[_cashId].auditor = msg.sender;
        cashAudits[_cashId].carbonValue = _carbonValue;
        cashAudits[_cashId].auditTimestamp = block.timestamp;
        cashAudits[_cashId].auditComment = _comment;  // 存储审计意见（拒绝时为必填，通过时可选）

        if (_carbonValue == 0) {
            // 拒绝申请
            cashAudits[_cashId].status = AuditStatus.Rejected;
            emit AuditRejected(_cashId, msg.sender, _comment);
        } else {
            // 通过申请
            cashAudits[_cashId].status = AuditStatus.Approved;
            emit AuditSubmitted(_cashId, msg.sender, _carbonValue, AuditType.Exchange);
        }
        
        emit AuditCompleted(_cashId, cashAudits[_cashId].status, AuditType.Exchange);
    }

    /**
     * @dev 兑现NFT（通过审计后）
     * @param _cashId 兑换申请ID
     * @notice 兑换申请审计通过后，销毁NFT并铸造对应数量的碳币
     */
    function exchangeNFT(uint256 _cashId) external nonReentrant whenInitialized {
        require(cashAudits[_cashId].status == AuditStatus.Approved, "Exchange audit not approved");
        require(cashAudits[_cashId].auditType == AuditType.Exchange, "Not an exchange audit");
        require(cashAudits[_cashId].requester == msg.sender, "Not the requester");
        require(cashAudits[_cashId].carbonValue > 0, "Carbon value not set");
        
        uint256 nftTokenId = cashAudits[_cashId].nftTokenId;
        
        // 检查调用者是否为NFT持有者
        require(greenTalesNFT.ownerOf(nftTokenId) == msg.sender, "Not NFT owner");
        
        // 检查合约是否已被授权操作该NFT
        require(greenTalesNFT.getApproved(nftTokenId) == address(this) || 
                greenTalesNFT.isApprovedForAll(msg.sender, address(this)), 
                "Contract not approved");

        // 获取NFT的价格信息
        GreenTalesNFT.StoryMeta memory storyMeta = greenTalesNFT.getStoryMeta(nftTokenId);
        uint256 carbonValue = cashAudits[_cashId].carbonValue;
        
        // 检查审计结果的碳币价格是否合法
        require(carbonValue <= storyMeta.initialPrice && carbonValue <= storyMeta.lastPrice, 
                "Carbon value exceeds NFT prices");

        // 合约主动转移NFT到自己名下，确保后续销毁安全
        greenTalesNFT.safeTransferFrom(msg.sender, address(this), nftTokenId);

        // 再次检查NFT所有权
        require(greenTalesNFT.ownerOf(nftTokenId) == address(this), "NFT transfer failed");

        // 销毁NFT
        greenTalesNFT.burn(nftTokenId);

        // 计算实际返还金额（扣除已收取的费用）
        uint256 returnAmount = calculateReturnAmount(carbonValue);

        // 铸造碳币给NFT持有者（扣除已收取的费用）
        carbonToken.mint(msg.sender, returnAmount);

        emit NFTExchanged(nftTokenId, msg.sender, returnAmount);
    }

    /**
     * @dev 实现 IERC721Receiver 接口，允许本合约安全接收 NFT
     * @notice 这样 NFT safeTransferFrom 到本合约不会 revert
     * @return 返回 IERC721Receiver 接口的 selector，表示接收成功
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        // 返回 IERC721Receiver 接口的 selector，表示接收成功
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev 添加业务合约
     * @param _contract 业务合约地址
     * @notice 只有合约所有者可以调用此函数
     */
    function addBusinessContract(address _contract) external onlyOwner whenInitialized {
        require(_contract != address(0), "Invalid contract address");
        businessContracts[_contract] = true;
        emit BusinessContractAdded(_contract);
    }

    /**
     * @dev 移除业务合约
     * @param _contract 业务合约地址
     * @notice 只有合约所有者可以调用此函数
     */
    function removeBusinessContract(address _contract) external onlyOwner whenInitialized {
        businessContracts[_contract] = false;
        emit BusinessContractRemoved(_contract);
    }

    /**
     * @dev 业务合约铸造 NFT（仅测试环境建议使用）
     * @param _recipient NFT 接收者地址
     * @param _title 故事标题
     * @param _storyDetails 故事详情
     * @param _carbonReduction 碳减排量
     * @param _initialPrice 初始价格
     * @param _tokenURI NFT 元数据 URI
     * @return tokenId 新铸造的NFT ID
     *
     * @notice ⚠️ 本函数主要用于测试环境（如Foundry/Hardhat链）快速铸造NFT，便于测试用例编写。
     * @notice 生产环境下，业务合约不应调用此函数，实际业务流程应通过"申请-审计-支付"完整流程铸造NFT。
     * @notice 只有在测试环境（isTestEnvironment为true）或白名单业务合约（暂无）才可调用。
     */
    function mintNFTByBusiness(
        address _recipient,
        string memory _title,
        string memory _storyDetails,
        uint256 _carbonReduction,
        uint256 _initialPrice,
        string memory _tokenURI
    ) external whenInitialized returns (uint256) {
        uint256 tokenId;
        // 测试环境下允许直接铸造NFT，便于测试
        if (isTestEnvironment) {
            tokenId = greenTalesNFT.mint(_recipient, _title, _storyDetails, _carbonReduction, _initialPrice, _tokenURI);
            emit NFTMintedByBusiness(tokenId, _recipient, _title, _carbonReduction);
            return tokenId;
        }
        // 生产环境下，仅白名单业务合约可调用，目前没有该业务需求
        require(businessContracts[msg.sender], "Not authorized business contract");
        tokenId = greenTalesNFT.mint(_recipient, _title, _storyDetails, _carbonReduction, _initialPrice, _tokenURI);
        emit NFTMintedByBusiness(tokenId, _recipient, _title, _carbonReduction);
        return tokenId;
    }

    /**
     * @dev 业务合约更新 NFT 价格
     * @param _tokenId NFT ID
     * @param _newPrice 新价格
     * @notice 只有授权的业务合约可以调用此函数
     * @notice 在测试环境中，允许测试合约直接调用
     */
    function updateNFTPriceByBusiness(uint256 _tokenId, uint256 _newPrice) external whenInitialized {
        // 在测试环境中，允许测试合约直接调用
        if (isTestEnvironment) {
            greenTalesNFT.updateLastPrice(_tokenId, _newPrice);
            emit NFTPriceUpdatedByBusiness(_tokenId, _newPrice);
            return;
        }
        
        // 生产环境中，只允许白名单中的业务合约调用
        require(businessContracts[msg.sender], "Not authorized business contract");
        greenTalesNFT.updateLastPrice(_tokenId, _newPrice);
        emit NFTPriceUpdatedByBusiness(_tokenId, _newPrice);
    }

    /**
     * @dev 计算系统手续费
     * @param amount 总金额
     * @return 手续费金额
     * @notice 系统手续费为总金额的1%
     */
    function calculateSystemFee(uint256 amount) public pure returns (uint256) {
        return (amount * SYSTEM_FEE_RATE) / BASE_RATE;
    }

    /**
     * @dev 计算审计费用
     * @param amount 总金额
     * @return 审计费用金额
     * @notice 审计费用为总金额的4%
     */
    function calculateAuditFee(uint256 amount) public pure returns (uint256) {
        return (amount * AUDIT_FEE_RATE) / BASE_RATE;
    }

    /**
     * @dev 计算实际返还金额
     * @param amount 总金额
     * @return 实际返还金额
     * @notice 实际返还金额 = 总金额 - 系统手续费 - 审计费用
     */
    function calculateReturnAmount(uint256 amount) public pure returns (uint256) {
        return amount - calculateSystemFee(amount) - calculateAuditFee(amount);
    }

    /**
     * @dev 根据铸造申请ID查询申请详情
     * @param _requestId 铸造申请ID
     * @return audit 完整的审计记录
     */
    function getRequestById(uint256 _requestId) external view returns (Audit memory) {
        return audits[_requestId];
    }

    /**
     * @dev 根据兑换申请ID查询申请详情
     * @param _cashId 兑换申请ID
     * @return audit 完整的审计记录
     */
    function getCashById(uint256 _cashId) external view returns (Audit memory) {
        return cashAudits[_cashId];
    }

    /**
     * @dev 获取申请的审计意见
     * @param _requestId 铸造申请ID
     * @return comment 审计意见/备注
     * @notice 获取审计员对特定铸造申请的审计意见
     */
    function getMintAuditComment(uint256 _requestId) external view returns (string memory) {
        require(audits[_requestId].requestId != 0, "Request does not exist");
        return audits[_requestId].auditComment;
    }

    /**
     * @dev 获取兑换申请的审计意见
     * @param _cashId 兑换申请ID
     * @return comment 审计意见/备注
     * @notice 获取审计员对特定兑换申请的审计意见
     */
    function getCashAuditComment(uint256 _cashId) external view returns (string memory) {
        require(cashAudits[_cashId].requestId != 0, "Request does not exist");
        return cashAudits[_cashId].auditComment;
    }

    /**
     * @dev 根据NFT ID查询关联的铸造申请记录
     * @param _nftTokenId NFT ID
     * @return requestIds 关联的铸造申请ID数组
     */
    function getRequestsByNFTId(uint256 _nftTokenId) external view returns (uint256[] memory requestIds) {
        // 遍历所有铸造申请，找到关联此NFT的记录
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].nftTokenId == _nftTokenId && audits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        // 创建正确大小的数组
        requestIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            requestIds[i] = tempIds[i];
        }
        
        return requestIds;
    }

    /**
     * @dev 根据NFT ID查询关联的兑换申请记录
     * @param _nftTokenId NFT ID
     * @return cashIds 关联的兑换申请ID数组
     */
    function getCashByNFTId(uint256 _nftTokenId) external view returns (uint256[] memory cashIds) {
        // 遍历所有兑换申请，找到关联此NFT的记录
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].nftTokenId == _nftTokenId && cashAudits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        // 创建正确大小的数组
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 获取用户的所有铸造申请记录
     * @param _user 用户地址
     * @return requestIds 用户的铸造申请ID数组
     * @notice 用于前端用户申请记录页面
     */
    function getUserMintRequests(address _user) external view returns (uint256[] memory requestIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].requester == _user && audits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        requestIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            requestIds[i] = tempIds[i];
        }
        
        return requestIds;
    }

    /**
     * @dev 获取用户的所有兑换申请记录
     * @param _user 用户地址
     * @return cashIds 用户的兑换申请ID数组
     * @notice 用于前端用户申请记录页面
     */
    function getUserCashRequests(address _user) external view returns (uint256[] memory cashIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].requester == _user && cashAudits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 获取所有待审计的铸造申请
     * @return requestIds 待审计的铸造申请ID数组
     * @notice 用于审计中心页面显示待处理申请
     */
    function getPendingMintAudits() external view returns (uint256[] memory requestIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].status == AuditStatus.Pending && audits[i].auditType == AuditType.Mint && audits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        requestIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            requestIds[i] = tempIds[i];
        }
        
        return requestIds;
    }

    /**
     * @dev 获取所有待审计的兑换申请
     * @return cashIds 待审计的兑换申请ID数组
     * @notice 用于审计中心页面显示待处理申请
     */
    function getPendingCashAudits() external view returns (uint256[] memory cashIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].status == AuditStatus.Pending && cashAudits[i].auditType == AuditType.Exchange && cashAudits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 获取特定审计员处理的申请记录
     * @param _auditor 审计员地址
     * @return requestIds 该审计员处理的铸造申请ID数组
     * @return cashIds 该审计员处理的兑换申请ID数组
     * @notice 用于审计中心显示审计员的工作记录
     */
    function getAuditorHistory(address _auditor) external view returns (uint256[] memory requestIds, uint256[] memory cashIds) {
        // 统计铸造申请
        uint256 mintCount = 0;
        uint256[] memory tempMintIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].auditor == _auditor && audits[i].requestId != 0) {
                tempMintIds[mintCount] = i;
                mintCount++;
            }
        }
        
        requestIds = new uint256[](mintCount);
        for (uint256 i = 0; i < mintCount; i++) {
            requestIds[i] = tempMintIds[i];
        }
        
        // 统计兑换申请
        uint256 cashCount = 0;
        uint256[] memory tempCashIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].auditor == _auditor && cashAudits[i].requestId != 0) {
                tempCashIds[cashCount] = i;
                cashCount++;
            }
        }
        
        cashIds = new uint256[](cashCount);
        for (uint256 i = 0; i < cashCount; i++) {
            cashIds[i] = tempCashIds[i];
        }
        
        return (requestIds, cashIds);
    }

    /**
     * @dev 获取用户的所有已审计铸造申请记录（已完成审计，无论通过或拒绝）
     * @param _user 用户地址
     * @return requestIds 用户的已审计铸造申请ID数组
     * @notice 用于查看用户的铸造申请历史记录
     */
    function getUserAuditedMintRequests(address _user) external view returns (uint256[] memory requestIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].requester == _user && 
                audits[i].requestId != 0 && 
                (audits[i].status == AuditStatus.Approved || audits[i].status == AuditStatus.Rejected)) {
                tempIds[count] = i;
                count++;
            }
        }
        
        requestIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            requestIds[i] = tempIds[i];
        }
        
        return requestIds;
    }

    /**
     * @dev 获取所有用户的已审计铸造申请记录
     * @return requestIds 所有已审计的铸造申请ID数组
     * @notice 用于审计中心查看所有铸造申请的历史记录
     */
    function getAllAuditedMintRequests() external view returns (uint256[] memory requestIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].requestId != 0 && 
                (audits[i].status == AuditStatus.Approved || audits[i].status == AuditStatus.Rejected)) {
                tempIds[count] = i;
                count++;
            }
        }
        
        requestIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            requestIds[i] = tempIds[i];
        }
        
        return requestIds;
    }

    /**
     * @dev 获取用户的所有兑换申请历史记录（包括待审计、已审计、已兑换）
     * @param _user 用户地址
     * @return cashIds 用户的所有兑换申请ID数组
     * @notice 用于查看用户的完整兑换历史
     */
    function getUserCashHistory(address _user) external view returns (uint256[] memory cashIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].requester == _user && cashAudits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 获取所有用户的兑换申请历史记录
     * @return cashIds 所有兑换申请ID数组
     * @notice 用于审计中心查看所有兑换申请的历史记录
     */
    function getAllCashHistory() external view returns (uint256[] memory cashIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 获取用户的已审计兑换申请记录（已完成审计，无论通过或拒绝）
     * @param _user 用户地址
     * @return cashIds 用户的已审计兑换申请ID数组
     * @notice 用于查看用户的兑换审计历史
     */
    function getUserAuditedCashRequests(address _user) external view returns (uint256[] memory cashIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].requester == _user && 
                cashAudits[i].requestId != 0 && 
                (cashAudits[i].status == AuditStatus.Approved || cashAudits[i].status == AuditStatus.Rejected)) {
                tempIds[count] = i;
                count++;
            }
        }
        
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 获取所有用户的已审计兑换申请记录
     * @return cashIds 所有已审计的兑换申请ID数组
     * @notice 用于审计中心查看所有兑换申请的审计历史
     */
    function getAllAuditedCashRequests() external view returns (uint256[] memory cashIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].requestId != 0 && 
                (cashAudits[i].status == AuditStatus.Approved || cashAudits[i].status == AuditStatus.Rejected)) {
                tempIds[count] = i;
                count++;
            }
        }
        
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 按状态获取铸造申请记录
     * @param _status 申请状态 (0:待审核, 1:已批准, 2:已拒绝)
     * @return requestIds 指定状态的铸造申请ID数组
     * @notice 用于按状态筛选申请记录
     */
    function getMintRequestsByStatus(AuditStatus _status) external view returns (uint256[] memory requestIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].requestId != 0 && audits[i].status == _status && audits[i].auditType == AuditType.Mint) {
                tempIds[count] = i;
                count++;
            }
        }
        
        requestIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            requestIds[i] = tempIds[i];
        }
        
        return requestIds;
    }

    /**
     * @dev 按状态获取兑换申请记录
     * @param _status 申请状态 (0:待审核, 1:已批准, 2:已拒绝)
     * @return cashIds 指定状态的兑换申请ID数组
     * @notice 用于按状态筛选申请记录
     */
    function getCashRequestsByStatus(AuditStatus _status) external view returns (uint256[] memory cashIds) {
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].requestId != 0 && cashAudits[i].status == _status && cashAudits[i].auditType == AuditType.Exchange) {
                tempIds[count] = i;
                count++;
            }
        }
        
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev 获取系统统计信息
     * @return totalMintRequests 总铸造申请数
     * @return totalCashRequests 总兑换申请数
     * @return pendingMintRequests 待审计铸造申请数
     * @return pendingCashRequests 待审计兑换申请数
     * @return approvedMintRequests 已批准铸造申请数
     * @return approvedCashRequests 已批准兑换申请数
     * @notice 用于仪表板显示系统概览
     */
    function getSystemStats() external view returns (
        uint256 totalMintRequests,
        uint256 totalCashRequests,
        uint256 pendingMintRequests,
        uint256 pendingCashRequests,
        uint256 approvedMintRequests,
        uint256 approvedCashRequests
    ) {
        totalMintRequests = nextRequestId - 1; // 减去初始值1
        totalCashRequests = nextCashId - 1;    // 减去初始值1
        
        // 统计各状态申请数量
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].requestId != 0 && audits[i].auditType == AuditType.Mint) {
                if (audits[i].status == AuditStatus.Pending) {
                    pendingMintRequests++;
                } else if (audits[i].status == AuditStatus.Approved) {
                    approvedMintRequests++;
                }
            }
        }
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].requestId != 0 && cashAudits[i].auditType == AuditType.Exchange) {
                if (cashAudits[i].status == AuditStatus.Pending) {
                    pendingCashRequests++;
                } else if (cashAudits[i].status == AuditStatus.Approved) {
                    approvedCashRequests++;
                }
            }
        }
        
        return (
            totalMintRequests,
            totalCashRequests,
            pendingMintRequests,
            pendingCashRequests,
            approvedMintRequests,
            approvedCashRequests
        );
    }
} 