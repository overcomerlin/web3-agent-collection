import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const account = privateKeyToAccount(`${process.env.AGENT_PRIVATE_KEY}` as `0x{string}`);
const VAULT_ADDRESS = process.env.VAULT_ADDRESS as `0x{string}`;

const publicClient = createPublicClient({
    chain: foundry,
    transport: http(process.env.LOCAL_RPC_URL)
});

const walletClient = createWalletClient({
    account,
    chain: foundry,
    transport: http(process.env.LOCAL_RPC_URL)
});

const VAULT_ABI = parseAbi(["function executeWithdrawal(address token, uint256 amount, address payable recipient) external"]);

export async function executeDeFiAction(parsedData: any) {
    console.log("Execute Route: ", `${parsedData.actionType} via ${parsedData.targetProtocol}`);

    // Dry run before transaction
    // Step 1: Securely request funds from the AegisVault
    // If the anount exceeds the daily limit, the vault will revert the transaction here...
    const { request } = await publicClient.simulateContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "executeWithdrawal",
        args: [
            "0x0000000000000000000000000000000000000000", // ETH/Native token placeholder
            BigInt(parsedData.amount * 1e18),
            account.address
        ],
        account
    });

    const vaultTxHash = await walletClient.writeContract(request);
    console.log("Vault Tx Hash: ", vaultTxHash);

    // Step 2: (Mock) Execute the Smart Order Route to Aerodrome or Uniswap
    const executionTxHash = "0x09325349075904357098437509837509823";

    return { vaultTxHash, executionTxHash };
}