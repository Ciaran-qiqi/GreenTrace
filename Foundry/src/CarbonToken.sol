// SPDX-License-Identifier: MIT
// wake-disable unsafe-erc20-call 

pragma solidity ^0.8.19;

import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title CarbonToken
 * @dev Carbon token contract, implements ERC20 standard
 * @notice Carbon credit token for environmental projects, represents audited carbon reduction
 * 
 * Main features:
 * 1. Initial minting: Mint initial supply at deployment for system operation
 * 2. Token generation: Generate through NFT exchange, amount determined by audit results
 * 3. Token distribution: Automatically distribute system fees, audit fees and exchange amounts when generated
 * 4. Token transfer: Support standard ERC20 transfer functions
 * 
 * Carbon token generation logic:
 * 1. NFT holder applies for audit
 * 2. Auditor submits audit results
 * 3. System confirms audit results
 * 4. Burn NFT and generate corresponding amount of carbon tokens
 * 5. Automatic distribution:
 *    - System fee (1%) to system wallet
 *    - Audit fee (4%) to auditor
 *    - Remaining amount (95%) to NFT holder
 */
contract CarbonToken is ERC20, Ownable {
    // GreenTrace contract address
    address public greenTrace;

    // Events
    event GreenTraceUpdated(address indexed oldAddress, address indexed newAddress);
    event TokensMinted(address indexed to, uint256 amount, uint256 timestamp);

    // Initial allocation struct
    struct InitialBalance {
        address to;
        uint256 amount;
    }

    /**
     * @dev Constructor
     * @param initialBalances Initial allocation array, mint to multiple addresses at deployment
     * @notice At deployment, all initial tokens will be minted to specified accounts for system operation and testing
     */
    constructor(InitialBalance[] memory initialBalances) ERC20("Carbon Token", "CARB") {
        for (uint i = 0; i < initialBalances.length; i++) {
            _mint(initialBalances[i].to, initialBalances[i].amount);
            emit TokensMinted(initialBalances[i].to, initialBalances[i].amount, block.timestamp);
        }
    }

    /**
     * @dev Set GreenTrace contract address
     * @param _greenTrace GreenTrace contract address
     * @notice Only contract owner can call this function (so in many cases the address must be set first before calling)
     */
    function setGreenTrace(address _greenTrace) external onlyOwner {
        address oldAddress = greenTrace;
        greenTrace = _greenTrace;
        emit GreenTraceUpdated(oldAddress, _greenTrace);
    }

    /**
     * @dev Mint carbon tokens
     * @param to Recipient address
     * @param amount Mint amount
     * @notice Only GreenTrace contract can call this function
     * @notice Used to mint new carbon tokens when exchanging NFTs
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == greenTrace, "Only GreenTrace can mint");
        _mint(to, amount);
        emit TokensMinted(to, amount, block.timestamp);
    }
} 