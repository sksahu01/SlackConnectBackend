import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { connectDB } from './utils/database';
import { setupScheduler } from './services/scheduler';
import authRoutes from './routes/auth';
import slackRoutes from './routes/slack';
import messageRoutes from './routes/messages';
import { errorHandler } from './middleware/errorHandler';

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
app.use(helmet());
app.use(morgan('combined'));
app.use(limiter);
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// Routes
app.use('/auth', authRoutes);
app.use('/slack', slackRoutes);
app.use('/messages', messageRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
    });
});

// Start server
async function startServer() {
    try {
        // Connect to MongoDB
        await connectDB();

        // Setup message scheduler
        setupScheduler();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Health check: https://slackconnectbackend.onrender.com/health`);
            console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
    console.error('❌ Unhandled Promise Rejection:', err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
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

startServer();
