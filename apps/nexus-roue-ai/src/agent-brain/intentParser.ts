export async function parseIntent(intentStr: string): Promise<any> {
    const OLLAM_URL = process.env.OLLAM_URL || "http://localhost:11434";

    const prompt = `
    You are an intent-based DeFi router. 
    Analyze the user's intent: "${intentStr}".
    Return a strict JSON object with these keys: 
    - "assetIn" (string, e.g., "USDC", "ETH")
    - "amount" (number)
    - "actionType" (string, e.g., "SWAP", "STAKE", "SWAP_AND_STAKE")
    - "targetProtocol" (string, e.g., "Aerodrome", "Uniswap")
    `;

    try {
        const response = await fetch(`${OLLAM_URL}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gemma4:e4b",
                prompt: prompt,
                stream: false,
                format: "json"
            })
        });
        const data = await response.json();
        return JSON.parse(data.response);
    } catch (error) {
        console.log("Agent Brain failed to parse intent: ", error);
        throw new Error("Intent parsing failed");
    }
}