import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

// 1. Environment Variable Setup & Validation
const RPC_URL = process.env.LOCAL_RPC_URL || "http://localhost:8545";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS as `0x${string}`;
const rawKey = process.env.AGENT_PRIVATE_KEY;

if (!rawKey || !VAULT_ADDRESS) throw new Error("Missing AGENT_PRIVATE_KEY or VAULT_ADDRESS in environment variables.");

// Ensure the private key has the proper 0x prefix for Viem
const formattedKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
const account = privateKeyToAccount(formattedKey as `0x${string}`);

// 2. Viem Client Initialization
const publicClient = createPublicClient({
    chain: foundry,
    transport: http(RPC_URL)
});

const walletClient = createWalletClient({
    chain: foundry,
    transport: http(RPC_URL),
    account
});

// 3. Smart Contract ABI Definition - only need the specific function the Agent is authorized to call
const ALPHA_VAULT_ABI = parseAbi(["function executeQuantTrade(address token, uint256 amount, address targetDex) external"]);

/**
 * Executes a high-frequency trade via the AlphaAegisVault.
 * @param   ticket The symbol of the token to trade (e.g., "$PEPE")
 * @return  The transaction hash of the executed trade
 */
export async function executeViemTrade(ticker: string): Promise<string> {
    console.log(`[Viem Executor] Preparing on-chain transaction for ${ticker}...`);

    try {
        // --- Mock Routing Data ---
        // In a production environment, you would dynamically fetch the contract address 
        // for the given ticker and the optimal DEX router (e.g., Uniswap V3 Router).
        const MOCK_TOKEN_ADDRESS = "0x1234567890123456789012345678901234567890" as `0x${string}`;
        const MOCK_DEX_ROUTER = "0x0000000000000000000000000000000000000000" as `0x${string}`;
        const TRADE_AMOUNT_WEI = BigInt(0.1 * 1e18); // Example: 0.1 ETH per quant trade

        console.log(`[Viem Executor] Requesting 0.1 ETH allocation from Vault to buy ${ticker}...`);

        // 4. Simulate the Contract Call (Gas Estimation & Revert Check)
        // This will fail *before* costing gas if the token is not whitelisted, 
        // if the cooldown is active, or if the daily limit is exceeded.
        const { request } = await publicClient.simulateContract({
            address: VAULT_ADDRESS,
            abi: ALPHA_VAULT_ABI,
            functionName: 'executeQuantTrade',
            args: [
                MOCK_TOKEN_ADDRESS,
                TRADE_AMOUNT_WEI,
                MOCK_DEX_ROUTER
            ],
            account
        });

        // 5. Broadcast the Transaction
        const txHash = await walletClient.writeContract(request);

        console.log(`[Viem Executor] 🟢 Trade successfully broadcasted! Tx Hash: ${txHash}`);

        // Wait for the transaction receipt to confirm it was mined
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`[Viem Executor] 🧱 Confirmed in block: ${receipt.blockNumber}`);

        return txHash;

    } catch (error: any) {
        console.error(`[Viem Executor] 🔴 Trade execution failed. Revert reason:`);

        // Clean up Viem's verbose error messages for the LangGraph logs
        if (error.message.includes('NotWhitelisted')) {
            console.error("-> Vault Error: Token is not on the approved whitelist.");
        } else if (error.message.includes('CooldownActive')) {
            console.error("-> Vault Error: Time-lock cooldown is currently active. Trade blocked.");
        } else if (error.message.includes('ExceedsLimit')) {
            console.error("-> Vault Error: Trading this amount exceeds the 24-hour vault limit.");
        } else {
            console.error(error.shortMessage || error.message);
        }

        // Return a failed hash or throw depending on how you want LangGraph to handle errors
        throw new Error("On-chain execution reverted");
    }
}