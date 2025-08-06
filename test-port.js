// Simple test script to verify port binding
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.json({
        message: 'Port test successful!',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', port: PORT });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Test server running on port ${PORT}`);
    console.log(`🌐 Listening on 0.0.0.0:${PORT}`);
    console.log(`🔌 Environment PORT: ${process.env.PORT}`);

    // Auto-close after 5 seconds for testing
    setTimeout(() => {
        console.log('🔄 Closing test server...');
        server.close(() => {
            console.log('✅ Test server closed successfully');
            process.exit(0);
        });
    }, 5000);
});

server.on('error', (error) => {
    console.error('❌ Server error:', error);
    process.exit(1);
});
