import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});

// Middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(morgan('combined'));
app.use(limiter);
app.use(cors({
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        const allowedOrigins = [
            'http://localhost:3000',
            'https://slackconnectfrontend.vercel.app',
            'http://127.0.0.1:3000',
            process.env.FRONTEND_URL
        ].filter(Boolean) as string[];

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root endpoint - API information
app.get('/', (req: express.Request, res: express.Response) => {
    res.status(200).json({
        name: 'Slack Connect API',
        version: '1.0.0',
        status: 'running',
        message: 'Welcome to Slack Connect Backend API',
        endpoints: {
            health: '/health',
            slackAuth: '/auth/slack',
            slackCallback: '/auth/slack/callback',
            frontendCallback: '/auth/callback',
            sendMessage: '/slack/send'
        },
        documentation: 'This is a backend API server for the Slack Connect application',
        frontend: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
});

// Slack OAuth endpoints (simplified for testing)
app.get('/auth/slack', (req: express.Request, res: express.Response) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    const state = Math.random().toString(36).substring(7);

    if (!clientId || !redirectUri) {
        return res.status(500).json({
            success: false,
            error: 'Slack OAuth not configured',
            data: null
        });
    }

    const scopes = [
        'channels:read',
        'chat:write',
        'users:read',
        'team:read'
    ].join(',');

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    res.json({
        success: true,
        message: 'Auth URL generated successfully',
        data: { authUrl, state }
    });
});

app.get('/auth/slack/callback', (req: express.Request, res: express.Response) => {
    const { code, state } = req.query;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code not provided' });
    }

    // In a real implementation, you would exchange the code for tokens
    // For now, just return a success message
    res.json({
        success: true,
        message: 'OAuth callback received',
        code: code as string
    });
});

// Handle frontend callback redirect
app.get('/auth/callback', (req: express.Request, res: express.Response) => {
    const { code, state, error } = req.query;

    if (error) {
        // Redirect to frontend with error
        return res.redirect(`http://localhost:3000/auth/error?error=${encodeURIComponent(error as string)}`);
    }

    if (!code) {
        return res.redirect(`http://localhost:3000/auth/error?error=${encodeURIComponent('Authorization code not provided')}`);
    }

    // In a real implementation, you would:
    // 1. Exchange the code for tokens
    // 2. Create a JWT token for the user
    // 3. Redirect with the JWT token

    // For now, simulate success
    const mockJwtToken = 'mock-jwt-token-' + Date.now();
    res.redirect(`http://localhost:3000/auth/success?token=${mockJwtToken}`);
});

// Test endpoint for sending messages
app.post('/slack/send', (req: express.Request, res: express.Response) => {
    const { channel, message } = req.body;

    if (!channel || !message) {
        return res.status(400).json({ error: 'Channel and message are required' });
    }

    // Simulate message sending
    res.json({
        success: true,
        message: 'Message sent successfully (simulated)',
        data: { channel, message }
    });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Slack Client ID: ${process.env.SLACK_CLIENT_ID ? 'Configured' : 'Not configured'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
    console.error('❌ Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
    console.error('❌ Uncaught Exception:', err);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received, shutting down gracefully');
    process.exit(0);
});
