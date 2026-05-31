import express, { type Request, type Response } from "express";
import cors from "cors";
import { analyzePromptRisk, triggerOnChainCircuitBreaker } from "./agent.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/audit", async (req: Request, res: Response) => {
    const { prompt } = req.body;
    if (!prompt) { return res.status(400).json({ error: "Input prompt evaluation vector missing." }); }

    console.log(`📥 Auditing Inbound Execution Intent: "${prompt}"`);

    const evaluation = await analyzePromptRisk(prompt);

    console.log("Raw evaluation: ", evaluation);

    if (!evaluation.safe || evaluation.riskScore > 75) {
        // Semantic guardrail alert triggered -> Deploy the immutable smart contract firewall
        const txHash = await triggerOnChainCircuitBreaker();
        return res.status(403).json({
            safe: false,
            riskScore: evaluation.riskScore,
            verdict: "PROMPT_INJECTION_OR_ANOMALY_DETECTED",
            action: "TRIGGER_ON_CHAIN_CIRCUIT_BREAKER",
            txHash
        });
    }
    return res.status(200).json({
        safe: true,
        riskScore: evaluation.riskScore,
        verdict: "PROMPT_CLEARED_FOR_EXECUTION"
    });
});

app.listen(3001, () => { console.log(`🛡️ SentryAegis AI Engine actively listening on port 3001`); });