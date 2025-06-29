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
 * @dev Main contract for the GreenTrace project, managing minting, burning, and distribution of NFTs and tokens
 * @notice Responsible for audit of carbon reduction projects, NFT redemption, and fee distribution
 * 
 * Main functions:
 * 1. Audit management: add/remove auditors, submit and complete audits
 * 2. NFT redemption: redeem approved NFTs for carbon tokens and distribute related fees
 * 3. Fee calculation: calculate system and audit fees
 * 4. Permission control: manage auditor whitelist
 * 5. Business contract management: manage authorized business contracts (e.g., trading market)
 * 
 * ID System Design:
 * 1. Mint request ID system: for tracking mint requests and audit process (auto-increment nextRequestId)
 * 2. Exchange request ID system: for tracking exchange requests and audit process (auto-increment nextCashId)
 * 3. NFT ID system: real ERC721 tokenId (assigned only after successful mint)
 */
contract GreenTrace is Ownable, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for CarbonToken;
    
    // Contract state variables
    CarbonToken public carbonToken;    // Carbon token contract
    GreenTalesNFT public greenTalesNFT;  // NFT contract
    bool public initialized;           // Initialization state
    bool public isTestEnvironment;     // Whether it is a test environment
    
    // Request ID system (independent of NFT ID)
    uint256 public nextRequestId;      // Next mint request ID (auto-increment, never destroyed)
    uint256 public nextCashId;         // Next exchange request ID (auto-increment, never destroyed)
    
    // Fee rate constants
    uint256 public constant SYSTEM_FEE_RATE = 100;  // 1%
    uint256 public constant AUDIT_FEE_RATE = 400;   // 4%
    uint256 public constant BASE_RATE = 10000;      // 100%
    
    // Audit status enum
    enum AuditStatus { Pending, Approved, Rejected }  // Pending, Approved, Rejected
    
    // Audit type enum
    enum AuditType { Mint, Exchange }  // Mint audit, Exchange audit
    
    /**
     * @dev Request/Audit struct
     * @param requester Requester address
     * @param auditor Auditor address
     * @param requestId Request ID (independent ID system)
     * @param nftTokenId NFT ID (only set after successful mint, 0 if failed)
     * @param carbonValue Carbon value
     * @param status Audit status
     * @param auditType Audit type
     * @param requestTimestamp Request timestamp
     * @param auditTimestamp Audit timestamp
     * @param auditComment Audit comment/remark
     * @param requestData Request related data
     */
    struct Audit {
        address requester;         // Requester address
        address auditor;           // Auditor address
        uint256 requestId;         // Request ID (independent ID system)
        uint256 nftTokenId;        // NFT ID (only set after successful mint)
        uint256 carbonValue;       // Carbon value
        AuditStatus status;        // Audit status
        AuditType auditType;       // Audit type
        uint256 requestTimestamp;  // Request timestamp
        uint256 auditTimestamp;    // Audit timestamp
        string auditComment;       // Audit comment/remark
        RequestData requestData;   // Request related data
    }
    
    /**
     * @dev Request data struct
     * @param title Story title
     * @param storyDetails Story details
     * @param carbonReduction Carbon reduction amount
     * @param tokenURI NFT metadata URI
     * @param requestFee Request fee
     */
    struct RequestData {
        string title;
        string storyDetails;
        uint256 carbonReduction;
        string tokenURI;
        uint256 requestFee;
    }
    
    // Mappings
    mapping(uint256 => Audit) public audits;  // Mint request ID => Audit info
    mapping(uint256 => Audit) public cashAudits;  // Exchange request ID => Audit info
    mapping(address => bool) public auditors; // Auditor whitelist
    mapping(address => bool) public businessContracts; // Business contract whitelist
    
    // Event definitions
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
     * @dev Constructor
     * @param _carbonToken Carbon token contract address
     * @param _greenTalesNFT NFT contract address (can be zero address, set later)
     */
    constructor(address _carbonToken, address _greenTalesNFT) Ownable() {
        carbonToken = CarbonToken(_carbonToken);
        if (_greenTalesNFT != address(0)) {
            greenTalesNFT = GreenTalesNFT(_greenTalesNFT);
        }
        // Determine if test environment by chain ID
        // 1: Ethereum Mainnet, 5: Goerli, 11155111: Sepolia, 31337: Hardhat/Foundry
        uint256 chainId = block.chainid;
        isTestEnvironment = (chainId == 5 || chainId == 11155111 || chainId == 31337);
        nextRequestId = 1; // Mint request ID starts from 1
        nextCashId = 1;    // Exchange request ID starts from 1
    }

    /**
     * @dev Set NFT contract address
     * @param _greenTalesNFT NFT contract address
     * @notice Only contract owner can call this function
     */
    function setNFTContract(address _greenTalesNFT) external onlyOwner {
        require(_greenTalesNFT != address(0), "Invalid NFT contract address");
        greenTalesNFT = GreenTalesNFT(_greenTalesNFT);
    }

    /**
     * @dev Initialization function
     * @notice Must be called after deployment to complete initialization
     * @notice Only contract owner can call this function
     */
    function initialize() external onlyOwner {
        require(!initialized, "Already initialized");
        require(address(carbonToken) != address(0), "CarbonToken not set");
        require(address(greenTalesNFT) != address(0), "GreenTalesNFT not set");
        
        initialized = true;
        emit ContractInitialized(address(carbonToken), address(greenTalesNFT), block.timestamp);
    }

    /**
     * @dev Initialization check modifier
     * @notice Ensure contract is initialized
     */
    modifier whenInitialized() {
        require(initialized, "Not initialized");
        _;
    }
    
    /**
     * @dev Add auditor
     * @param _auditor Auditor address
     * @notice Only contract owner can call this function
     */
    function addAuditor(address _auditor) external onlyOwner whenInitialized {
        auditors[_auditor] = true;
        emit AuditorAdded(_auditor);
    }
    
    /**
     * @dev Remove auditor
     * @param _auditor Auditor address
     * @notice Only contract owner can call this function
     */
    function removeAuditor(address _auditor) external onlyOwner whenInitialized {
        auditors[_auditor] = false;
        emit AuditorRemoved(_auditor);
    }
    
    /**
     * @dev Calculate request fee for minting
     * @param _carbonReduction Carbon reduction amount
     * @return Fee amount (larger of 1% of carbon reduction or 1 carbon token)
     */
    function calculateRequestFee(uint256 _carbonReduction) public pure returns (uint256) {
        uint256 percentageFee = _carbonReduction / 100;  // 1% of carbon reduction
        uint256 minFee = 1 * 10**18;  // 1 carbon token (assuming 18 decimal places)
        return percentageFee > minFee ? percentageFee : minFee;
    }

    /**
     * @dev Request minting NFT
     * @param _title Story title
     * @param _storyDetails Story details
     * @param _carbonReduction Carbon reduction amount
     * @param _tokenURI NFT metadata URI
     * @return requestId Request ID (note: not NFT ID)
     * @notice Requires payment of request fee (larger of 1% of carbon reduction or 1 carbon token)
     * @notice Returns request ID, NFT will only be minted after audit and fee payment
     */
    function requestMintNFT(
        string memory _title,
        string memory _storyDetails,
        uint256 _carbonReduction,
        string memory _tokenURI
    ) external whenInitialized returns (uint256) {
        // Calculate request fee
        uint256 requestFee = calculateRequestFee(_carbonReduction);

        // Check user balance
        require(carbonToken.balanceOf(msg.sender) >= requestFee, "Insufficient balance for request fee");
        
        // Transfer fee
        carbonToken.safeTransferFrom(msg.sender, address(this), requestFee);
        
        // Allocate fee to contract owner
        carbonToken.safeTransfer(owner(), requestFee);
        
        // Use independent request ID system
        uint256 requestId = nextRequestId++;
        
        // Create mint audit record
        audits[requestId] = Audit({
            requester: msg.sender,
            auditor: address(0),
            requestId: requestId,
            nftTokenId: 0,  // Request stage NFT ID is 0, only set after successful mint
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

        // Record mint request event
        emit MintRequested(
            requestId,  // Use request ID instead of NFT ID
            msg.sender,
            _title,
            _storyDetails,
            _carbonReduction,
            _tokenURI,
            requestFee
        );
        
        return requestId;  // Return request ID
    }

    /**
     * @dev Submit mint audit result
     * @param _requestId Request ID (not NFT ID)
     * @param _carbonValue Carbon value (0 indicates rejection)
     * @param _comment Audit comment/remark (required if rejected, optional if approved)
     * @notice Only authorized auditors can call this function
     * @notice If carbon value is 0, it indicates rejection of the request, and a rejection reason must be provided
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
        
        // If rejecting the request, a rejection reason must be provided
        if (_carbonValue == 0) {
            require(bytes(_comment).length > 0, "Rejection reason is required");
        }
        
        audits[_requestId].auditor = msg.sender;
        audits[_requestId].carbonValue = _carbonValue;
        audits[_requestId].auditTimestamp = block.timestamp;
        audits[_requestId].auditComment = _comment;  // Store audit comment (required if rejected, optional if approved)

        if (_carbonValue == 0) {
            // Reject request
            audits[_requestId].status = AuditStatus.Rejected;
            emit AuditRejected(_requestId, msg.sender, _comment);
        } else {
            // Approve request
            audits[_requestId].status = AuditStatus.Approved;
            emit AuditSubmitted(_requestId, msg.sender, _carbonValue, AuditType.Mint);
        }
        
        emit AuditCompleted(_requestId, audits[_requestId].status, AuditType.Mint);
    }

    /**
     * @dev Pay mint fee and mint NFT
     * @param _requestId Request ID (approved mint request)
     * @return nftTokenId Real NFT ID
     * @notice Only call this function after mint audit is approved
     * @notice After paying fees, real NFT will be minted and NFT ID returned
     */
    function payAndMintNFT(
        uint256 _requestId
    ) external whenInitialized returns (uint256) {
        require(audits[_requestId].status == AuditStatus.Approved, "Mint audit not approved");
        require(audits[_requestId].auditType == AuditType.Mint, "Not a mint audit");
        require(audits[_requestId].carbonValue > 0, "Carbon value not set");
        require(audits[_requestId].requester == msg.sender, "Not the requester");
        
        // Calculate fees
        uint256 systemFee = calculateSystemFee(audits[_requestId].carbonValue);
        uint256 auditFee = calculateAuditFee(audits[_requestId].carbonValue);
        uint256 totalFee = systemFee + auditFee;

        // Check user balance
        require(carbonToken.balanceOf(msg.sender) >= totalFee, "Insufficient balance for fees");
        
        // Transfer fees
        carbonToken.safeTransferFrom(msg.sender, address(this), totalFee);
        
        // Allocate fees
        carbonToken.safeTransfer(owner(), systemFee);  // System fee to contract owner
        carbonToken.safeTransfer(audits[_requestId].auditor, auditFee);  // Audit fee to auditor
        
        // Mint NFT (now actually mint NFT)
        uint256 nftTokenId = greenTalesNFT.mint(
            audits[_requestId].requester,
            audits[_requestId].requestData.title,
            audits[_requestId].requestData.storyDetails,
            audits[_requestId].requestData.carbonReduction,
            audits[_requestId].carbonValue,  // Use audit-adjusted carbon value as initial price
            audits[_requestId].requestData.tokenURI
        );
        
        // Update NFT ID in audit record
        audits[_requestId].nftTokenId = nftTokenId;
        
        // Emit fee distribution event
        emit FeeDistribution(
            _requestId,
            audits[_requestId].carbonValue,
            systemFee,
            auditFee,
            audits[_requestId].carbonValue - totalFee,
            block.timestamp
        );
        
        emit NFTMintedAfterAudit(_requestId, nftTokenId, audits[_requestId].requester, audits[_requestId].requestData.title, audits[_requestId].carbonValue);
        
        return nftTokenId;  // Return real NFT ID
    }

    /**
     * @dev Request exchange NFT
     * @param _nftTokenId NFT ID (real NFT ID)
     * @return requestId Exchange request ID
     * @notice NFT holder requests to exchange NFT for carbon tokens
     */
    function requestExchangeNFT(uint256 _nftTokenId) external whenInitialized returns (uint256) {
        // Check if caller is NFT holder
        require(greenTalesNFT.ownerOf(_nftTokenId) == msg.sender, "Not NFT owner");
        
        // Get NFT price information
        GreenTalesNFT.StoryMeta memory storyMeta = greenTalesNFT.getStoryMeta(_nftTokenId);
        uint256 basePrice = storyMeta.lastPrice > 0 ? storyMeta.lastPrice : storyMeta.initialPrice;
        
        // Calculate request fee
        uint256 requestFee = calculateRequestFee(basePrice);
        
        // Check user balance
        require(carbonToken.balanceOf(msg.sender) >= requestFee, "Insufficient balance for request fee");
        
        // Transfer fee
        carbonToken.safeTransferFrom(msg.sender, address(this), requestFee);
        carbonToken.safeTransfer(owner(), requestFee);
        
        // Create exchange request ID (use independent exchange ID system)
        uint256 cashId = nextCashId++;
        
        // Create exchange audit record
        cashAudits[cashId] = Audit({
            requester: msg.sender,
            auditor: address(0),
            requestId: cashId,        // In exchange audit, requestId field stores cashId
            nftTokenId: _nftTokenId,  // This directly uses real NFT ID
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
     * @dev Submit exchange audit result
     * @param _cashId Exchange request ID
     * @param _carbonValue Carbon value (carbon tokens to be obtained)
     * @param _comment Audit comment/remark (required if rejected, optional if approved)
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
        
        // If rejecting the request, a rejection reason must be provided
        if (_carbonValue == 0) {
            require(bytes(_comment).length > 0, "Rejection reason is required");
        }
        
        cashAudits[_cashId].auditor = msg.sender;
        cashAudits[_cashId].carbonValue = _carbonValue;
        cashAudits[_cashId].auditTimestamp = block.timestamp;
        cashAudits[_cashId].auditComment = _comment;  // Store audit comment (required if rejected, optional if approved)

        if (_carbonValue == 0) {
            // Reject request
            cashAudits[_cashId].status = AuditStatus.Rejected;
            emit AuditRejected(_cashId, msg.sender, _comment);
        } else {
            // Approve request
            cashAudits[_cashId].status = AuditStatus.Approved;
            emit AuditSubmitted(_cashId, msg.sender, _carbonValue, AuditType.Exchange);
        }
        
        emit AuditCompleted(_cashId, cashAudits[_cashId].status, AuditType.Exchange);
    }

    /**
     * @dev Redeem NFT (after audit)
     * @param _cashId Exchange request ID
     * @notice After exchange audit is approved, burn NFT and mint corresponding amount of carbon tokens
     */
    function exchangeNFT(uint256 _cashId) external nonReentrant whenInitialized {
        require(cashAudits[_cashId].status == AuditStatus.Approved, "Exchange audit not approved");
        require(cashAudits[_cashId].auditType == AuditType.Exchange, "Not an exchange audit");
        require(cashAudits[_cashId].requester == msg.sender, "Not the requester");
        require(cashAudits[_cashId].carbonValue > 0, "Carbon value not set");
        
        uint256 nftTokenId = cashAudits[_cashId].nftTokenId;
        
        // Check if caller is NFT holder
        require(greenTalesNFT.ownerOf(nftTokenId) == msg.sender, "Not NFT owner");
        
        // Check if contract is authorized to operate this NFT
        require(greenTalesNFT.getApproved(nftTokenId) == address(this) || 
                greenTalesNFT.isApprovedForAll(msg.sender, address(this)), 
                "Contract not approved");

        // Get NFT price information
        GreenTalesNFT.StoryMeta memory storyMeta = greenTalesNFT.getStoryMeta(nftTokenId);
        uint256 carbonValue = cashAudits[_cashId].carbonValue;
        
        // Check if audit-adjusted carbon value is legal
        require(carbonValue <= storyMeta.initialPrice && carbonValue <= storyMeta.lastPrice, 
                "Carbon value exceeds NFT prices");

        // Contract actively transfers NFT to itself, ensuring subsequent burn safety
        greenTalesNFT.safeTransferFrom(msg.sender, address(this), nftTokenId);

        // Check NFT ownership again
        require(greenTalesNFT.ownerOf(nftTokenId) == address(this), "NFT transfer failed");

        // Burn NFT
        greenTalesNFT.burn(nftTokenId);

        // Calculate actual return amount (deducting already collected fees)
        uint256 returnAmount = calculateReturnAmount(carbonValue);

        // Mint carbon tokens to NFT holder (deducting already collected fees)
        carbonToken.mint(msg.sender, returnAmount);

        emit NFTExchanged(nftTokenId, msg.sender, returnAmount);
    }

    /**
     * @dev Implement IERC721Receiver interface, allowing this contract to safely receive NFTs
     * @notice This way, NFT safeTransferFrom to this contract will not revert
     * @return Returns IERC721Receiver interface selector, indicating successful reception
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        // Return IERC721Receiver interface selector, indicating successful reception
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @dev Add business contract
     * @param _contract Business contract address
     * @notice Only contract owner can call this function
     */
    function addBusinessContract(address _contract) external onlyOwner whenInitialized {
        require(_contract != address(0), "Invalid contract address");
        businessContracts[_contract] = true;
        emit BusinessContractAdded(_contract);
    }

    /**
     * @dev Remove business contract
     * @param _contract Business contract address
     * @notice Only contract owner can call this function
     */
    function removeBusinessContract(address _contract) external onlyOwner whenInitialized {
        businessContracts[_contract] = false;
        emit BusinessContractRemoved(_contract);
    }

    /**
     * @dev Business contract mint NFT (only recommended for test environment)
     * @param _recipient NFT receiver address
     * @param _title Story title
     * @param _storyDetails Story details
     * @param _carbonReduction Carbon reduction amount
     * @param _initialPrice Initial price
     * @param _tokenURI NFT metadata URI
     * @return tokenId New minted NFT ID
     *
     * @notice ⚠️ This function is primarily for test environment (e.g., Foundry/Hardhat chain) quick minting NFTs, for easy test case writing.
     * @notice In production environment, business contracts should not call this function, actual business process should mint NFT through "request-audit-pay" complete process.
     * @notice This function can only be called in test environment (isTestEnvironment is true) or white list business contracts (currently no).
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
        // Test environment allows direct minting of NFTs, for easy testing
        if (isTestEnvironment) {
            tokenId = greenTalesNFT.mint(_recipient, _title, _storyDetails, _carbonReduction, _initialPrice, _tokenURI);
            emit NFTMintedByBusiness(tokenId, _recipient, _title, _carbonReduction);
            return tokenId;
        }
        // In production environment, only white list business contracts can call, currently no such business demand
        require(businessContracts[msg.sender], "Not authorized business contract");
        tokenId = greenTalesNFT.mint(_recipient, _title, _storyDetails, _carbonReduction, _initialPrice, _tokenURI);
        emit NFTMintedByBusiness(tokenId, _recipient, _title, _carbonReduction);
        return tokenId;
    }

    /**
     * @dev Business contract update NFT price
     * @param _tokenId NFT ID
     * @param _newPrice New price
     * @notice Only authorized business contracts can call this function
     * @notice In test environment, allowed test contract to directly call
     */
    function updateNFTPriceByBusiness(uint256 _tokenId, uint256 _newPrice) external whenInitialized {
        // In test environment, allowed test contract to directly call
        if (isTestEnvironment) {
            greenTalesNFT.updateLastPrice(_tokenId, _newPrice);
            emit NFTPriceUpdatedByBusiness(_tokenId, _newPrice);
            return;
        }
        
        // In production environment, only allowed white list business contracts to call
        require(businessContracts[msg.sender], "Not authorized business contract");
        greenTalesNFT.updateLastPrice(_tokenId, _newPrice);
        emit NFTPriceUpdatedByBusiness(_tokenId, _newPrice);
    }

    /**
     * @dev Calculate system fee
     * @param amount Total amount
     * @return Fee amount
     * @notice System fee is 1% of total amount
     */
    function calculateSystemFee(uint256 amount) public pure returns (uint256) {
        return (amount * SYSTEM_FEE_RATE) / BASE_RATE;
    }

    /**
     * @dev Calculate audit fee
     * @param amount Total amount
     * @return Audit fee amount
     * @notice Audit fee is 4% of total amount
     */
    function calculateAuditFee(uint256 amount) public pure returns (uint256) {
        return (amount * AUDIT_FEE_RATE) / BASE_RATE;
    }

    /**
     * @dev Calculate actual return amount
     * @param amount Total amount
     * @return Actual return amount
     * @notice Actual return amount = Total amount - System fee - Audit fee
     */
    function calculateReturnAmount(uint256 amount) public pure returns (uint256) {
        return amount - calculateSystemFee(amount) - calculateAuditFee(amount);
    }

    /**
     * @dev Query request details by mint request ID
     * @param _requestId Mint request ID
     * @return audit Complete audit record
     */
    function getRequestById(uint256 _requestId) external view returns (Audit memory) {
        return audits[_requestId];
    }

    /**
     * @dev Query request details by exchange request ID
     * @param _cashId Exchange request ID
     * @return audit Complete audit record
     */
    function getCashById(uint256 _cashId) external view returns (Audit memory) {
        return cashAudits[_cashId];
    }

    /**
     * @dev Get audit comment for mint request
     * @param _requestId Mint request ID
     * @return comment Audit comment/remark
     * @notice Get audit comment for specific mint request
     */
    function getMintAuditComment(uint256 _requestId) external view returns (string memory) {
        require(audits[_requestId].requestId != 0, "Request does not exist");
        return audits[_requestId].auditComment;
    }

    /**
     * @dev Get audit comment for exchange request
     * @param _cashId Exchange request ID
     * @return comment Audit comment/remark
     * @notice Get audit comment for specific exchange request
     */
    function getCashAuditComment(uint256 _cashId) external view returns (string memory) {
        require(cashAudits[_cashId].requestId != 0, "Request does not exist");
        return cashAudits[_cashId].auditComment;
    }

    /**
     * @dev Query related mint request records by NFT ID
     * @param _nftTokenId NFT ID
     * @return requestIds Related mint request ID array
     */
    function getRequestsByNFTId(uint256 _nftTokenId) external view returns (uint256[] memory requestIds) {
        // Traverse all mint requests to find related records for this NFT
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextRequestId);
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (audits[i].nftTokenId == _nftTokenId && audits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        // Create correct size array
        requestIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            requestIds[i] = tempIds[i];
        }
        
        return requestIds;
    }

    /**
     * @dev Query related exchange request records by NFT ID
     * @param _nftTokenId NFT ID
     * @return cashIds Related exchange request ID array
     */
    function getCashByNFTId(uint256 _nftTokenId) external view returns (uint256[] memory cashIds) {
        // Traverse all exchange requests to find related records for this NFT
        uint256 count = 0;
        uint256[] memory tempIds = new uint256[](nextCashId);
        
        for (uint256 i = 1; i < nextCashId; i++) {
            if (cashAudits[i].nftTokenId == _nftTokenId && cashAudits[i].requestId != 0) {
                tempIds[count] = i;
                count++;
            }
        }
        
        // Create correct size array
        cashIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            cashIds[i] = tempIds[i];
        }
        
        return cashIds;
    }

    /**
     * @dev Get all mint request records for a user
     * @param _user User address
     * @return requestIds User's mint request ID array
     * @notice Used for front-end user request record page
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
     * @dev Get all exchange request records for a user
     * @param _user User address
     * @return cashIds User's exchange request ID array
     * @notice Used for front-end user request record page
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
     * @dev Get all pending mint request records
     * @return requestIds Pending mint request ID array
     * @notice Used for audit center page to display pending processing requests
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
     * @dev Get all pending exchange request records
     * @return cashIds Pending exchange request ID array
     * @notice Used for audit center page to display pending processing requests
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
     * @dev Get specific auditor's processing request records
     * @param _auditor Auditor address
     * @return requestIds Auditor's mint request ID array
     * @return cashIds Auditor's exchange request ID array
     * @notice Used for audit center to display auditor's work records
     */
    function getAuditorHistory(address _auditor) external view returns (uint256[] memory requestIds, uint256[] memory cashIds) {
        // Count mint requests
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
        
        // Count exchange requests
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
     * @dev Get all mint request records for a user that have been audited (completed audit, regardless of approval)
     * @param _user User address
     * @return requestIds User's audited mint request ID array
     * @notice Used to view user's mint request history
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
     * @dev Get all audited mint request records for all users
     * @return requestIds All audited mint request ID array
     * @notice Used for audit center to view all mint request history
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
     * @dev Get all exchange request history records for a user (including pending audit, audited, and exchanged)
     * @param _user User address
     * @return cashIds User's all exchange request ID array
     * @notice Used to view user's complete exchange history
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
     * @dev Get all exchange request history records for all users
     * @return cashIds All exchange request ID array
     * @notice Used for audit center to view all exchange request history
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
     * @dev Get audited exchange request records for a user that have been audited (completed audit, regardless of approval)
     * @param _user User address
     * @return cashIds User's audited exchange request ID array
     * @notice Used to view user's exchange audit history
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
     * @dev Get all audited exchange request records for all users
     * @return cashIds All audited exchange request ID array
     * @notice Used for audit center to view all exchange request audit history
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
     * @dev Get mint request records by status
     * @param _status Request status (0: pending, 1: approved, 2: rejected)
     * @return requestIds Mint request ID array for specified status
     * @notice Used for filtering request records by status
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
     * @dev Get exchange request records by status
     * @param _status Request status (0: pending, 1: approved, 2: rejected)
     * @return cashIds Exchange request ID array for specified status
     * @notice Used for filtering request records by status
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
     * @dev Get system statistics
     * @return totalMintRequests Total mint request count
     * @return totalCashRequests Total exchange request count
     * @return pendingMintRequests Pending mint request count
     * @return pendingCashRequests Pending exchange request count
     * @return approvedMintRequests Approved mint request count
     * @return approvedCashRequests Approved exchange request count
     * @notice Used for dashboard to display system overview
     */
    function getSystemStats() external view returns (
        uint256 totalMintRequests,
        uint256 totalCashRequests,
        uint256 pendingMintRequests,
        uint256 pendingCashRequests,
        uint256 approvedMintRequests,
        uint256 approvedCashRequests
    ) {
        totalMintRequests = nextRequestId - 1; // Subtract initial value 1
        totalCashRequests = nextCashId - 1;    // Subtract initial value 1
        
        // Count requests by status
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