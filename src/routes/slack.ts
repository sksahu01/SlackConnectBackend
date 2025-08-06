import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler';
import SlackService from '../services/SlackService';
import { ApiResponse, SendMessageRequest } from '../types';

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
 * @route GET /slack/channels
 * @desc Get user's Slack channels
 */
router.get('/channels', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as any).user;

    try {
        // Get valid access token (refresh if necessary)
        const accessToken = await SlackService.ensureValidToken(userId);

        // Get user's channels
        const channels = await SlackService.getUserChannels(accessToken);

        res.json({
            success: true,
            data: channels
        } as ApiResponse);

    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch channels'
        } as ApiResponse);
    }
}));

/**
 * @route POST /slack/send-message
 * @desc Send immediate message to Slack channel
 */
router.post('/send-message', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId } = (req as any).user;
    const { channelId, message }: SendMessageRequest = req.body;

    if (!channelId || !message) {
        return res.status(400).json({
            success: false,
            error: 'Channel ID and message are required'
        } as ApiResponse);
    }

    try {
        // Get valid access token (refresh if necessary)
        const accessToken = await SlackService.ensureValidToken(userId);

        // Send message
        const success = await SlackService.sendMessage(accessToken, channelId, message);

        if (success) {
            res.json({
                success: true,
                message: 'Message sent successfully'
            } as ApiResponse);
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to send message'
            } as ApiResponse);
        }

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send message'
        } as ApiResponse);
    }
}));

/**
 * @route GET /slack/user-info
 * @desc Get current user's Slack information
 */
router.get('/user-info', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId, teamId, teamName, userName } = (req as any).user;

    try {
        // Get valid access token (refresh if necessary)
        const accessToken = await SlackService.ensureValidToken(userId);

        // Get detailed user info from Slack
        const userInfo = await SlackService.getUserInfo(accessToken, userId);

        res.json({
            success: true,
            data: {
                id: userId,
                name: userName,
                teamId,
                teamName,
                slackInfo: {
                    realName: userInfo.real_name,
                    displayName: userInfo.profile?.display_name,
                    email: userInfo.profile?.email,
                    image: userInfo.profile?.image_192,
                    timezone: userInfo.tz_label,
                }
            }
        } as ApiResponse);

    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user information'
        } as ApiResponse);
    }
}));

/**
 * @route GET /slack/connection-status
 * @desc Check Slack connection status
 */
router.get('/connection-status', authenticateUser, asyncHandler(async (req: Request, res: Response) => {
    const { userId, teamId, teamName } = (req as any).user;

    try {
        // Try to get a valid access token (will refresh if needed)
        const accessToken = await SlackService.ensureValidToken(userId);

        // Test the connection by getting user info
        await SlackService.getUserInfo(accessToken, userId);

        res.json({
            success: true,
            data: {
                connected: true,
                teamId,
                teamName,
                lastChecked: new Date().toISOString()
            }
        } as ApiResponse);

    } catch (error) {
        console.error('Connection status check failed:', error);

        res.json({
            success: true,
            data: {
                connected: false,
                error: error instanceof Error ? error.message : 'Connection failed',
                lastChecked: new Date().toISOString()
            }
        } as ApiResponse);
    }
}));

export default router;
