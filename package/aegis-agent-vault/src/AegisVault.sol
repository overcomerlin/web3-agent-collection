// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AegisVault
 * @author YourName
 * @notice A defensive, lightweight vault designed specifically for AI Agents,
 * featuring a daily spending limit and an emergency circuit breaker.
 */
contract AegisVault {
    // --- State Variables ---
    address public owner; // The human administrator with master controls
    address public agent; // The authorized AI Agent address executing operational tasks
    uint256 public dailyLimit; // Maximum allowance (in wei/tokens) the agent can withdraw per 24 hours
    uint256 public spentToday; // Total amount withdrawn within the current 24-hour window
    uint256 public lastResetTimestamp; // Epoch timestamp tracking when the current 24-hour window started
    bool public isPaused; // Emergency switch state; if true, all agent actions are frozen

    // Reentrancy Status (Lightweight alternative to OpenZeppelin's ReentrancyGuard to optimize Gas)
    // Using uint256 (1 and 2) instead of bool (false and true) avoids the gas penalty of resetting
    // a storage slot from a non-zero to a zero value (SSTORE gas optimization).
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    // --- Modern Production Standard: Custom Errors ---
    // Custom errors save massive amounts of deployment and execution gas compared to long require string messages.
    error UnauthorizedCaller(); // Thrown when an address lacks the required role (Owner or Agent)
    error ContractIsPaused(); // Thrown when the agent tries to withdraw during an emergency pause
    error ExceedsDailyLimitRestriction(); // Thrown when a withdrawal violates the 24-hour spending velocity limit
    error EthTransferFailed(); // Thrown if a native Ether transfer is rejected by the recipient
    error TokenTransferFailed(); // Thrown if a low-level ERC20 transfer fails or returns false
    error ReentrancyGuardTriggered(); // Thrown if a nested or recursive call attempt is detected

    // --- Event Declarations ---
    // Events allow external indexers (like subgraphs) to track vault activity seamlessly.
    event FundsWithdrawn(
        address indexed token,
        uint256 amount,
        address indexed to
    );
    event EmergencyStatusChanged(bool indexed isPaused);
    event DailyLimitUpdated(uint256 indexed newLimit);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    // --- Modifiers (Security Gates) ---

    /**
     * @dev Restricts execution to the contract owner (Human Admin).
     */
    modifier onlyOwner() {
        if (msg.sender != owner) revert UnauthorizedCaller();
        _;
    }

    /**
     * @dev Restricts execution to the authorized AI Agent.
     */
    modifier onlyAgent() {
        if (msg.sender != agent) revert UnauthorizedCaller();
        _;
    }

    /**
     * @dev Ensures the contract is not paused before executing operations.
     */
    modifier whenNotPaused() {
        if (isPaused) revert ContractIsPaused();
        _;
    }

    /**
     * @dev Prevents reentrancy attacks by locking the state during external interactions.
     * Follows the Checks-Effects-Interactions pattern structurally.
     */
    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrancyGuardTriggered();
        _status = _ENTERED; // Lock before execution
        _;
        _status = _NOT_ENTERED; // Unlock after execution
    }

    // --- Constructor ---

    /**
     * @param _agent The initial address assigned to the AI Agent.
     * @param _dailyLimit The initial 24-hour spending limit.
     */
    constructor(address _agent, uint256 _dailyLimit) {
        owner = msg.sender;
        agent = _agent;
        dailyLimit = _dailyLimit;
        lastResetTimestamp = block.timestamp; // Initializes the 24-hour cycle timer
        _status = _NOT_ENTERED; // Initializes the reentrancy guard to an unlocked state
    }

    /**
     * @notice Allows the authorized AI Agent to withdraw or transfer funds within the daily limit.
     * Supports both native Ether (ETH) and ERC20 tokens.
     * @param token Use address(0) for native ETH; use the contract address for ERC20 tokens.
     * @param amount The volume of funds to transfer (denominated in the asset's smallest unit/decimals).
     * @param to The recipient address.
     */
    function executeWithdrawal(
        address token,
        uint256 amount,
        address payable to
    ) external onlyAgent whenNotPaused nonReentrant {
        // --- 1. Rolling 24-Hour Reset Check ---
        // If 24 hours or more have elapsed since the last cycle refresh, wipe the spent record
        // and set the current block time as the new baseline timestamp.
        if (block.timestamp >= lastResetTimestamp + 1 days) {
            spentToday = 0;
            lastResetTimestamp = block.timestamp;
        }

        // --- 2. Risk Control & Velocity Verification ---
        // Validate that the request does not cross the threshold.
        // Update the state variable immediately (Effects) BEFORE moving funds (Interactions) to prevent race conditions.
        if (spentToday + amount > dailyLimit)
            revert ExceedsDailyLimitRestriction();
        spentToday += amount;

        // --- 3. Fund Disbursement Execution ---
        if (token == address(0)) {
            // Native ETH Transfer:
            // Using a low-level `.call` forwards all remaining gas, allowing target contracts
            // to execute fallback logic safely, unlike the outdated `.transfer()` or `.send()`.
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert EthTransferFailed();
        } else {
            // ERC20 Token Transfer:
            // Uses a low-level `.call` encoding the standard transfer signature.
            // This provides maximum compatibility with standard ERC20s and non-compliant tokens
            // (like older USDT implementations) that do not return a boolean value.
            (bool success, bytes memory data) = token.call(
                abi.encodeWithSignature("transfer(address,uint256)", to, amount)
            );

            // Validate success: The call must succeed, and IF data is returned, it must decode to 'true'.
            if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
                revert TokenTransferFailed();
            }
        }

        emit FundsWithdrawn(token, amount, to);
    }

    // --- Admin Controls (Owner Only) ---

    /**
     * @notice Toggles the emergency stop switch. Acts as a kill switch to freeze the AI Agent
     * if anomalies, hacks, or hallucinations are detected.
     */
    function toggleEmergencyStop() external onlyOwner {
        isPaused = !isPaused;
        emit EmergencyStatusChanged(isPaused);
    }

    /**
     * @notice Adjusts the 24-hour spending ceiling.
     * @param _newLimit The new absolute limit value.
     */
    function updateDailyLimit(uint256 _newLimit) external onlyOwner {
        dailyLimit = _newLimit;
        emit DailyLimitUpdated(_newLimit);
    }

    /**
     * @notice Dynamically rotates or updates the AI Agent's wallet identity.
     * @param _newAgent The new address authorized to act as the AI Agent.
     */
    function setAgent(address _newAgent) external onlyOwner {
        emit AgentUpdated(agent, _newAgent);
        agent = _newAgent;
    }

    /**
     * @notice Transmutes master vault authority to a new human administrator.
     * @param _newOwner The target address receiving control. Cannot be the zero address.
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert UnauthorizedCaller(); // Prevents accidental burning of ownership
        owner = _newOwner;
    }

    /**
     * @dev Explicitly allows the vault to natively accept raw ETH deposits from anyone.
     */
    receive() external payable {}
}
