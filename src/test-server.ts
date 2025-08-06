import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/health', (req: express.Request, res: express.Response) => {
    res.json({
        status: 'healthy',
        message: 'Backend server is running!',
        env: {
            PORT: process.env.PORT,
            NODE_ENV: process.env.NODE_ENV,
            hasSlackClientId: !!process.env.SLACK_CLIENT_ID
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
