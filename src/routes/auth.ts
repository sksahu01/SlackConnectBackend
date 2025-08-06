import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler';
import SlackService from '../services/SlackService';
import { SlackUserModel } from '../models/SlackUser';
import { ApiResponse } from '../types';

const router = Router();

/**
 * @route GET /auth/slack
 * @desc Initialize Slack OAuth flow
 */
router.get('/slack', asyncHandler(async (req: Request, res: Response) => {
    const state = jwt.sign(
        { timestamp: Date.now() },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '10m' }
    );

    const authUrl = SlackService.generateAuthUrl(state);

    res.json({
        success: true,
        data: { authUrl, state }
    } as ApiResponse);
}));

/**
 * @route GET /auth/slack/callback
 * @desc Handle Slack OAuth callback
 */
router.get('/slack/callback', asyncHandler(async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=${encodeURIComponent(error as string)}`);
    }

    if (!code || !state) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=missing_parameters`);
    }

    try {
        // Verify state parameter
        jwt.verify(state as string, process.env.JWT_SECRET || 'default-secret');
    } catch (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=invalid_state`);
    }

    try {
        // Exchange code for tokens
        const tokenData = await SlackService.exchangeCodeForTokens(code as string);

        // Get user info
        const userInfo = await SlackService.getUserInfo(
            tokenData.authed_user.access_token,
            tokenData.authed_user.id
        );

        // Calculate token expiration if provided
        let tokenExpiresAt: Date | undefined;
        if (tokenData.expires_in) {
            tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        }

        // Save or update user in database
        const userData = {
            id: tokenData.authed_user.id,
            name: userInfo.name || userInfo.real_name || 'Unknown User',
            email: userInfo.profile?.email,
            teamId: tokenData.team.id,
            teamName: tokenData.team.name,
            accessToken: tokenData.authed_user.access_token,
            refreshToken: tokenData.refresh_token,
            tokenExpiresAt,
        };

        await SlackUserModel.findOneAndUpdate(
            { id: userData.id, teamId: userData.teamId },
            userData,
            { upsert: true, new: true }
        );

        // Generate JWT for frontend authentication
        const authToken = jwt.sign(
            {
                userId: userData.id,
                teamId: userData.teamId,
                teamName: userData.teamName,
                userName: userData.name,
            },
            process.env.JWT_SECRET || 'default-secret',
            { expiresIn: '7d' }
        );

        // Redirect to frontend with auth token
        res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${authToken}`);

    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/auth/error?error=auth_failed`);
    }
}));

/**
 * @route POST /auth/verify
 * @desc Verify JWT token and return user info
 */
router.post('/verify', asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            error: 'Token is required'
        } as ApiResponse);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;

        // Verify user still exists in database
        const user = await SlackUserModel.findOne({
            id: decoded.userId,
            teamId: decoded.teamId
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            } as ApiResponse);
        }

        return res.json({
            success: true,
            data: {
                userId: decoded.userId,
                teamId: decoded.teamId,
                teamName: decoded.teamName,
                userName: decoded.userName,
            }
        } as ApiResponse);

    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Invalid token'
        } as ApiResponse);
    }
}));

/**
 * @route POST /auth/logout
 * @desc Logout user (client-side token removal)
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
    res.json({
        success: true,
        message: 'Logged out successfully'
    } as ApiResponse);
}));

export default router;
