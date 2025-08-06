import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
    try {
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        const options = {
            // No longer needed in Mongoose 6+
        };

        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Handle connection events
        mongoose.connection.on('error', (error) => {
            console.error('❌ MongoDB connection error:', error);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('📡 MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('🔄 MongoDB reconnected');
        });

    } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        console.log('⚠️  Server will continue running without database connection for testing purposes');
        // Don't throw error to allow server to start for testing
    }
};
