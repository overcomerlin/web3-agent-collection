import { parseAbi } from "viem";

export const VAULT_ABI = parseAbi([
    'function isPaused() view returns (bool)',
    'function dailyLimit() view returns (uint256)',
    'function spentToday() view returns (uint256)',
    'function toggleEmergencyStop() external',
    'function executeWithdrawal(address token, uint256 amount, address payable recipient) external',
    'error UnauthorizedCaller()',
    'error ContractIsPaused()',
    'error ExceedsDailyLimitRestriction()'
]);