// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {AegisVault} from "../src/AegisVault.sol";

/**
 * @title MockToken
 * @dev A minimal ECR20 implementation used to test token withdrawal logic.
 */
contract MockTocken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) public {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/**
 * @title AegisVaultTest
 * @dev Comprehensive unit and security test suite for AegisVault.
 */
contract AegisVaultTest is Test {
    AegisVault public vault;
    MockTocken public token;

    // Test Roles & Actors
    address public owner = address(0x1111);
    address public agent = address(0x2222);
    address public hacker = address(0xBAD);
    address payable public recipient = payable(address(0x3333));

    uint256 public constant INITIAL_LIMIT = 1 ether;

    /**
     * @dev Lifecycle method that runs before each individual test case to initialize state.
     */
    function setUp() public {
        // Deploy the vault while impersonating the Owner
        vm.prank(owner);
        vault = new AegisVault(agent, INITIAL_LIMIT);

        // Deploy the mock token and seed the vault with standard liquidity
        token = new MockTocken();
        token.mint(address(vault), 100 ether);

        //Fund the vault with native ETH using Foundry's "deal" cheatcode
        vm.deal(address(vault), 10 ether);
    }

    // --- 1. Success Path Tests ---

    function test_SuccessfulEthWithdrawal() public {
        uint256 amount = 0.5 ether;
        uint256 preBalance = recipient.balance;

        // Impersonate the Agent for the withdrawal execution
        vm.prank(agent);
        vault.executeWithdrawal(address(0), amount, recipient);

        assertEq(recipient.balance, preBalance + amount);
        assertEq(vault.spentToday(), amount);
    }

    function test_SuccessfulErc20Withdrawal() public {
        uint256 amount = 0.5 ether;

        // Impersonate the Agent for the token withdrawal execution
        vm.prank(agent);
        vault.executeWithdrawal(address(token), amount, recipient);

        assertEq(token.balanceOf(recipient), amount);
    }

    // --- 2. Risk Control & Security Defense Tests (Expected Reverts) ---

    function test_RevertIf_NonAgentCallsWithdrawal() public {
        // Hacker attempts to forge the Agent's identity and initiate a withdrawal
        vm.prank(hacker);

        // Verify that the custom error 'UnauthorizedCaller' is correctly thrown
        vm.expectRevert(AegisVault.UnauthorizedCaller.selector);
        vault.executeWithdrawal(address(0), 0.1 ether, recipient);
    }

    function test_RevertIf_ExceedsDailyLimit() public {
        vm.startPrank(agent);

        // Tx 1: Allocate 0.6 ETH (Success, within the 1 ETH limit)
        vault.executeWithdrawal(address(0), 0.6 ether, recipient);

        // Tx 2: Allocate an additional 0.5 ETH (Fails, cumulative 1.1 ETH exceeds daily restriction)
        vm.expectRevert(AegisVault.ExceedsDailyLimitRestriction.selector);
        vault.executeWithdrawal(address(0), 0.5 ether, recipient);

        vm.stopPrank();
    }

    function test_RevertIf_ContractIsPaused() public {
        // Owner detects anomalous behavior and activates the circuit breaker
        vm.prank(owner);
        vault.toggleEmergencyStop();

        // Agent attempts a legitimate withdrawal but must be structurally blocked
        vm.prank(agent);
        vm.expectRevert(AegisVault.ContractIsPaused.selector);
        vault.executeWithdrawal(address(0), 0.1 ether, recipient);
    }

    // --- 3. Time Invariance & Limit Reset Tests ---

    function test_DailyLimitResetsAfter24Hours() public {
        vm.startPrank(agent);

        // Deplete the total daily limit capacity for today (1 ETH)
        vault.executeWithdrawal(address(0), 1 ether, recipient);

        // Subsequent requests inside the same time window must fail
        vm.expectRevert(AegisVault.ExceedsDailyLimitRestriction.selector);
        vault.executeWithdrawal(address(0), 0.1 ether, recipient);

        // Warp the blockchain time forward by exactly 1 day and 1 second
        vm.warp(block.timestamp + 1 days + 1 seconds);

        // A new epoch opens; the Agent should be granted allocation rights again
        vault.executeWithdrawal(address(0), 0.5 ether, recipient);
        assertEq(vault.spentToday(), 0.5 ether);

        vm.stopPrank();
    }
}
