import express, { type Request, type Response } from "express";
import { parseIntent } from "./agent-brain/intentParser.js";
import cors from "cors";
import { executeDeFiAction } from "./execution-layer/router.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/v1/intent", async (req: Request, res: Response): Promise<any> => {
    const { intent } = req.body;
    if (!intent) return res.status(400).json({ error: "Tntent prompt is required!" });

    try {
        console.log(`Processing intent analysis: ${intent}`);
        // Send intent to Ollama Agent
        const parsedAction = await parseIntent(intent);
        console.log(`Parsed Intent JSON: ${JSON.stringify(parsedAction)}`);

        // Send to Viem Execution Layer & AegisVault
        const txResults = await executeDeFiAction(parsedAction);

        return res.status(200).json({
            status: "success",
            parsedAction,
            vaultApprovalTxHash: txResults.vaultTxHash,
            executionTxHash: txResults.executionTxHash
        });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
