import cron from 'node-cron';
import { ScheduledMessageModel, IScheduledMessage } from '../models/ScheduledMessage';
import { SlackService } from './SlackService';

export class MessageScheduler {
    private static instance: MessageScheduler;
    private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

    private constructor() { }

    public static getInstance(): MessageScheduler {
        if (!MessageScheduler.instance) {
            MessageScheduler.instance = new MessageScheduler();
        }
        return MessageScheduler.instance;
    }

    /**
     * Setup the message scheduler - runs every minute to check for messages to send
     */
    public setupScheduler(): void {
        console.log('🕒 Setting up message scheduler...');

        // Run every minute to check for messages to send
        cron.schedule('* * * * *', async () => {
            await this.processScheduledMessages();
        });

        console.log('✅ Message scheduler started');
    }

    /**
     * Process messages that are due to be sent
     */
    private async processScheduledMessages(): Promise<void> {
        try {
            const now = new Date();

            // Find messages that are due to be sent
            const dueMessages = await ScheduledMessageModel.find({
                scheduledFor: { $lte: now },
                status: 'pending'
            }).sort({ scheduledFor: 1 });

            if (dueMessages.length === 0) {
                return;
            }

            console.log(`📨 Processing ${dueMessages.length} scheduled messages`);

            for (const message of dueMessages) {
                await this.sendScheduledMessage(message._id.toString());
            }
        } catch (error) {
            console.error('Error processing scheduled messages:', error);
        }
    }

    /**
     * Send a specific scheduled message
     */
    public async sendScheduledMessage(messageId: string): Promise<void> {
        try {
            const message = await ScheduledMessageModel.findById(messageId);

            if (!message || message.status !== 'pending') {
                return;
            }

            // Update status to prevent duplicate processing
            message.status = 'sent';
            message.sentAt = new Date();

            try {
                // Get Slack service instance
                const slackService = SlackService.getInstance();

                // Get valid access token
                const accessToken = await slackService.ensureValidToken(message.userId);

                // Send the message
                const success = await slackService.sendMessage(
                    accessToken,
                    message.channelId,
                    message.message
                );

                if (success) {
                    await message.save();
                    console.log(`✅ Sent scheduled message ${messageId} to channel ${message.channelName}`);
                } else {
                    throw new Error('Failed to send message to Slack');
                }
            } catch (error) {
                // Mark as failed
                message.status = 'failed';
                message.error = error instanceof Error ? error.message : 'Unknown error';
                await message.save();

                console.error(`❌ Failed to send scheduled message ${messageId}:`, error);
            }
        } catch (error) {
            console.error(`Error sending scheduled message ${messageId}:`, error);
        }
    }

    /**
     * Schedule a new message
     */
    public async scheduleMessage(
        userId: string,
        teamId: string,
        channelId: string,
        channelName: string,
        message: string,
        scheduledFor: Date
    ): Promise<string> {
        try {
            // Validate that the scheduled time is in the future
            if (scheduledFor <= new Date()) {
                throw new Error('Scheduled time must be in the future');
            }

            // Create scheduled message
            const scheduledMessage = new ScheduledMessageModel({
                userId,
                teamId,
                channelId,
                channelName,
                message,
                scheduledFor,
                status: 'pending',
            });

            await scheduledMessage.save();

            console.log(`📅 Scheduled message for ${scheduledFor.toISOString()}`);

            return scheduledMessage._id.toString();
        } catch (error) {
            console.error('Error scheduling message:', error);
            throw error;
        }
    }

    /**
     * Cancel a scheduled message
     */
    public async cancelScheduledMessage(messageId: string, userId: string): Promise<boolean> {
        try {
            const message = await ScheduledMessageModel.findOne({
                _id: messageId,
                userId,
                status: 'pending'
            });

            if (!message) {
                return false;
            }

            message.status = 'cancelled';
            await message.save();

            console.log(`🚫 Cancelled scheduled message ${messageId}`);

            return true;
        } catch (error) {
            console.error('Error cancelling scheduled message:', error);
            throw error;
        }
    }

    /**
     * Get scheduled messages for a user
     */
    public async getUserScheduledMessages(userId: string): Promise<any[]> {
        try {
            const messages = await ScheduledMessageModel.find({
                userId,
                status: { $in: ['pending', 'sent', 'failed'] }
            }).sort({ scheduledFor: -1 });

            return messages.map((msg: IScheduledMessage) => ({
                id: msg._id.toString(),
                channelId: msg.channelId,
                channelName: msg.channelName,
                message: msg.message,
                scheduledFor: msg.scheduledFor,
                status: msg.status,
                createdAt: msg.createdAt,
                sentAt: msg.sentAt,
                error: msg.error,
            }));
        } catch (error) {
            console.error('Error getting user scheduled messages:', error);
            throw error;
        }
    }
}

export const setupScheduler = (): void => {
    MessageScheduler.getInstance().setupScheduler();
};

export default MessageScheduler.getInstance();
