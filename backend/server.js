const express = require("express");
const dotenv = require("dotenv");
const { HfInference } = require("@huggingface/inference");
const { HttpsProxyAgent } = require('https-proxy-agent');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
app.use(express.json());

// 允许前端跨域访问
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:3005");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


const apiToken = process.env.HF_TOKEN

const proxy = 'http://127.0.0.1:33210';
const agent = new HttpsProxyAgent(proxy);

// 初始化 Hugging Face Inference
const hf = new HfInference(process.env.HF_TOKEN, {
    fetch: (url, options) => {
        return fetch(url, { ...options, agent });
    },
});

app.get("/test", async (req, res) => {
    try {
        const response = await fetch('https://api-inference.huggingface.co/models/facebook/bart-large-mnli', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            agent,
            body: JSON.stringify({
                inputs: "I love playing football!",
                parameters: {
                    candidate_labels: ["sports", "politics", "economy"]
                }
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 处理笔记整理和标题生成的 API
app.post("/api/huggingface", async (req, res) => {
    const { prompt, model, maxLength } = req.body;
    try {
        // const response = await hf.textGeneration({
        //     model: model || "facebook/bart-large",
        //     inputs: prompt,
        //     parameters: {
        //         max_length: maxLength || 500,
        //         temperature: 0.7,
        //     },
        // });
        // console.log(response)
        // res.json(response); // 保持与前端期望的格式一致
        const response = await hf.request({
            model: model,
            inputs: prompt,
            parameters: {
                max_length: maxLength || 500,
                temperature: 0.7,
            },
        });
        // Hugging Face 返回格式可能是数组或对象，灵活处理
        // let generatedText = "";
        // if (Array.isArray(response)) {
        //     generatedText = response[0]?.generated_text || response[0]?.output || "";
        // } else {
        //     generatedText = response.generated_text || response.output || "";
        // }

        // res.json([{ generated_text: generatedText.trim() }]);
        res.json(response);
    } catch (error) {
        console.error("Hugging Face API error:", error.message);
        res.status(500).json({ error: "Failed to process request" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});