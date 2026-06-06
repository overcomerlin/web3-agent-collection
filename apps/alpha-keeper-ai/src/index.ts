import express, { type Request, type Response } from 'express';
import { quantApp } from "./workflow/graph.js";
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/v1/trigger-cycle", async (req: Request, res: Response) => {
    const { targetTicker } = req.body;

    if (!targetTicker) {
        return res.status(400).json({ error: "Missing targetTicker" });
    }

    try {
        console.log(`\n🚀 Starting Quant Cycle for ${targetTicker}`);

        // Invoke the LangGraph workflow
        const finalState = await quantApp.invoke({
            ticker: targetTicker,
            scrapedData: "",
            sentimentScore: 0,
            decision: "HOLD"
        });

        res.status(200).json({
            status: "success",
            sentimentScore: finalState.sentimentScore,
            decision: finalState.decision,
            executionTx: finalState.txHash || null
        });

    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: "Workflow execution failed" });
    }

});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`📈 AlphaKeeper Quant Engine running on port ${PORT}`);
});