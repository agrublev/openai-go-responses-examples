import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL_NAME = "claude-sonnet-4-20250514";

// getStockTool defines the Claude tool for getting a single Stock by ticker symbol
const getStockTool = {
    name: "get_stock_price",
    description:
        "The get_stock_price tool retrieves the current price of a single stock by its ticker symbol",
    input_schema: {
        type: "object",
        properties: {
            symbol: {
                type: "string",
                description: "The ticker symbol of the stock to retrieve",
            },
        },
        required: ["symbol"],
    },
};

// agentTools is the list of all tools available to the agent
const agentTools = [getStockTool];

// GetStockPrice is a mockup implementation of the get_stock_price function
async function getStockPrice(input) {
    const { symbol } = input;

    // Validate the stock symbol
    if (!symbol || symbol.trim() === "") {
        throw new Error("stock symbol is required");
    }

    // Return a static placeholder
    return "$198.53 USD";
}

// processToolCall handles a tool call from the Claude API
async function processToolCall(toolName, toolInput) {
    switch (toolName) {
        case "get_stock_price":
            return await getStockPrice(toolInput);
        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}

async function main() {
    try {
        const userMessage = "What's the current stock price for Apple?";

        let messages = [{ role: "user", content: userMessage }];

        let response = await client.messages.create({
            model: MODEL_NAME,
            max_tokens: 4096,
            tools: agentTools,
            messages: messages,
        });

        console.log("\nInitial Response:");
        console.log(`Stop Reason: ${response.stop_reason}`);
        console.log(`Content:`, JSON.stringify(response.content, null, 2));

        // Process tool calls in a loop
        while (response.stop_reason === "tool_use") {
            const toolUse = response.content.find((block) => block.type === "tool_use");
            const toolName = toolUse.name;
            const toolInput = toolUse.input;

            console.log(`\nTool Used: ${toolName}`);
            console.log("Tool Input:");
            console.log(JSON.stringify(toolInput, null, 2));

            let toolResult;
            let isError = false;

            try {
                toolResult = await processToolCall(toolName, toolInput);
            } catch (error) {
                toolResult = error.message;
                isError = true;
            }

            console.log("\nTool Result:");
            console.log(toolResult);

            // Build the next request with tool results
            messages = [
                { role: "user", content: userMessage },
                { role: "assistant", content: response.content },
                {
                    role: "user",
                    content: [
                        {
                            type: "tool_result",
                            tool_use_id: toolUse.id,
                            content: toolResult,
                            is_error: isError,
                        },
                    ],
                },
            ];

            // Make the next call without tools to get final response
            response = await client.messages.create({
                model: MODEL_NAME,
                max_tokens: 4096,
                messages: messages,
            });

            console.log("\nResponse:");
            console.log(`Stop Reason: ${response.stop_reason}`);
            console.log(`Content:`, JSON.stringify(response.content, null, 2));
        }

        // Extract final text response
        const finalResponse = response.content.find((block) => block.type === "text")?.text || null;

        console.log(`\n${"=".repeat(50)}`);
        console.log("Final Response:", finalResponse);
        console.log("=".repeat(50));
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

main();
