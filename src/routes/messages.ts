import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler';
import SlackService from '../services/SlackService';
import MessageScheduler from '../services/scheduler';
import { ApiResponse, MessageRequest } from '../types';

const router = Router();

// Middleware to extract user info from JWT token
const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access token is required'
        } as ApiResponse);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
        (req as any).user = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid access token'
        } as ApiResponse);
    }
};

/**
 * @route POST /messages/schedule
 * @desc Schedule a message for future delivery
 */
router.post('/schedule', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId, teamId } = (req as any).user;
    const { channelId, message, scheduledFor }: MessageRequest = req.body;

    if (!channelId || !message || !scheduledFor) {
        return res.status(400).json({
            success: false,
            error: 'Channel ID, message, and scheduled time are required'
        } as ApiResponse);
    }

    try {
        // Validate scheduled time
        const scheduledDate = new Date(scheduledFor);
        if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Scheduled time must be a valid future date'
            } as ApiResponse);
        }

        // Get valid access token and channels to validate channel access
        const accessToken = await SlackService.ensureValidToken(userId);
        const channels = await SlackService.getUserChannels(accessToken);

        const targetChannel = channels.find(ch => ch.id === channelId);
        if (!targetChannel) {
            return res.status(400).json({
                success: false,
                error: 'Channel not found or not accessible'
            } as ApiResponse);
        }

        // Schedule the message
        const messageId = await MessageScheduler.scheduleMessage(
            userId,
            teamId,
            channelId,
            targetChannel.name,
            message,
            scheduledDate
        );

        res.status(201).json({
            success: true,
            data: {
                messageId,
                channelId,
                channelName: targetChannel.name,
                message,
                scheduledFor: scheduledDate.toISOString(),
                status: 'scheduled'
            },
            message: 'Message scheduled successfully'
        } as ApiResponse);

    } catch (error) {
        console.error('Error scheduling message:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to schedule message'
        } as ApiResponse);
    }
}));

/**
 * @route GET /messages/scheduled
 * @desc Get all scheduled messages for the authenticated user
 */
router.get('/scheduled', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as any).user;

    try {
        const scheduledMessages = await MessageScheduler.getUserScheduledMessages(userId);

        res.json({
            success: true,
            data: scheduledMessages
        } as ApiResponse);

    } catch (error) {
        console.error('Error fetching scheduled messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scheduled messages'
        } as ApiResponse);
    }
}));

/**
 * @route DELETE /messages/scheduled/:messageId
 * @desc Cancel a scheduled message
 */
router.delete('/scheduled/:messageId', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const { messageId } = req.params;

    if (!messageId) {
        return res.status(400).json({
            success: false,
            error: 'Message ID is required'
        } as ApiResponse);
    }

    try {
        const success = await MessageScheduler.cancelScheduledMessage(messageId, userId);

        if (success) {
            res.json({
                success: true,
                message: 'Message cancelled successfully'
            } as ApiResponse);
        } else {
            res.status(404).json({
                success: false,
                error: 'Scheduled message not found or already sent'
            } as ApiResponse);
        }

    } catch (error) {
        console.error('Error cancelling scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel scheduled message'
        } as ApiResponse);
    }
}));

/**
 * @route POST /messages/send-now/:messageId
 * @desc Send a scheduled message immediately
 */
router.post('/send-now/:messageId', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const { messageId } = req.params;

    if (!messageId) {
        return res.status(400).json({
            success: false,
            error: 'Message ID is required'
        } as ApiResponse);
    }

    try {
        // Get the scheduled messages to verify ownership
        const userMessages = await MessageScheduler.getUserScheduledMessages(userId);
        const message = userMessages.find(msg => msg.id === messageId && msg.status === 'pending');

        if (!message) {
            return res.status(404).json({
                success: false,
                error: 'Scheduled message not found or already sent'
            } as ApiResponse);
        }

        // Send the message immediately
        await MessageScheduler.sendScheduledMessage(messageId);

        res.json({
            success: true,
            message: 'Message sent successfully'
        } as ApiResponse);

    } catch (error) {
        console.error('Error sending scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send scheduled message'
        } as ApiResponse);
    }
}));

/**
 * @route GET /messages/stats
 * @desc Get message statistics for the authenticated user
 */
router.get('/stats', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as any).user;

    try {
        const messages = await MessageScheduler.getUserScheduledMessages(userId);

        const stats = {
            total: messages.length,
            pending: messages.filter(msg => msg.status === 'pending').length,
            sent: messages.filter(msg => msg.status === 'sent').length,
            failed: messages.filter(msg => msg.status === 'failed').length,
            cancelled: messages.filter(msg => msg.status === 'cancelled').length,
        };

        res.json({
            success: true,
            data: stats
        } as ApiResponse);

    } catch (error) {
        console.error('Error fetching message stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message statistics'
        } as ApiResponse);
    }
}));

export default router;
