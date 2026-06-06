import { END, START, StateGraph } from "@langchain/langgraph";
import { executeViemTrade } from "./viemExecutor.js";

// 1. Define the internal state of our LangGraph
interface AgentState {
    ticker: string;
    scrapedData: string;
    sentimentScore: number;
    decision: "BUY" | "HOLD";
    txHash?: string;
}

// 2. Node: Scrape social & on-chain data
async function scrapeDataNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(`🔍 Scraping data for ${state.ticker}...`);
    // Mocking API requests to Twitter and DexScreener
    const mockedText = `CT is going crazy over ${state.ticker}. Volume up 300% on DexScreener. Huge alpha.`;
    return { scrapedData: mockedText };
}

// 3. Node: LocalOllama Sentiment Analysis
async function analyzeSentimentNode(state: AgentState): Promise<Partial<AgentState>> {
    console.log(`🧠 Analyzing sentiment using gemma4:e4b...`);
    const OLLAM_URL = process.env.OLLAMA_URL || "http://localhost:11434";

    const response = await fetch(`${OLLAM_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gemma4:e4b",
            prompt: `Evaluate the hype and sentiment of this text: "${state.scrapedData}". Return ONLY a JSON object with 'score' (0-100 integer) and 'decision' (BUY or HOLD).`,
            stream: false,
            format: "json"
        })
    });

    const result = await response.json();
    const parsed = JSON.parse(result.response);
    return { sentimentScore: parsed.score, decision: parsed.score > 70 ? "BUY" : "HOLD" };
}

// 4. Node: Execute via Viem and AlphaAegisVault
async function executeTradeNode(state: AgentState): Promise<Partial<AgentState>> {
    if (state.decision === "BUY") {
        console.log("⚡ Alpha detected! Executing transaction...");
        const txHash = await executeViemTrade(state.ticker);
        return { txHash };
    }
    console.log("⏸️ Holding position. Sentiment not high enough.");
    return {};
}

// 5. Build and compile the Graph
const workflow = new StateGraph<AgentState>({
    channels: {
        ticker: { value: (x, y) => y ?? x, default: () => "" },
        scrapedData: { value: (x, y) => y ?? x, default: () => "" },
        sentimentScore: { value: (x, y) => y ?? x, default: () => 0 },
        decision: { value: (x, y) => y ?? x, default: () => "HOLD" as const },
        txHash: { value: (x, y) => y ?? x, default: () => "" }
    }
})
    .addNode("scrape", scrapeDataNode)
    .addNode("analyze", analyzeSentimentNode)
    .addNode("execute", executeTradeNode)
    .addEdge(START, "scrape")
    .addEdge("scrape", "analyze")
    .addEdge("analyze", "execute")
    .addEdge("execute", END);

export const quantApp = workflow.compile();