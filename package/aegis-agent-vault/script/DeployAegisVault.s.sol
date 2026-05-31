// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AegisVault} from "../src/AegisVault.sol";
import {console} from "forge-std/console.sol";

contract DeployAegisVault is Script {
    function run() external {
        // Read the deployer's private key from the environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Set your expected parameters (e.g., the Agent's wallet address, and a daily limit of 0.1 ETH)
        address mockAgent = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
        uint256 initialDailyLimit = 0.1 ether;

        // Start broadcasting the on-chain transaction
        vm.startBroadcast(deployerPrivateKey);

        AegisVault vault = new AegisVault(mockAgent, initialDailyLimit);

        vm.stopBroadcast();

        // Print the results to the console for easy copying of the address into TypeScript later
        console.log("AegisVault deployed successfully!");
        console.log("Vault Address:", address(vault));
        console.log("Vault Owner:", vm.addr(deployerPrivateKey));
    }
}
