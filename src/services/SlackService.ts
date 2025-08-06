import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { SlackAuthResponse, SlackRefreshResponse, SlackChannel, SlackTokens } from '../types';
import { SlackUserModel } from '../models/SlackUser';

export class SlackService {
    private static instance: SlackService;

    private constructor() { }

    public static getInstance(): SlackService {
        if (!SlackService.instance) {
            SlackService.instance = new SlackService();
        }
        return SlackService.instance;
    }

    /**
     * Generate Slack OAuth authorization URL
     */
    public generateAuthUrl(state?: string): string {
        const clientId = process.env.SLACK_CLIENT_ID;
        const redirectUri = process.env.SLACK_REDIRECT_URI;

        if (!clientId || !redirectUri) {
            throw new Error('Slack OAuth credentials not configured');
        }

        const scopes = [
            'channels:read',
            'groups:read',
            'chat:write',
            'users:read',
            'team:read',
            'chat:write.public'
        ].join(',');

        const params = new URLSearchParams({
            client_id: clientId,
            scope: scopes,
            redirect_uri: redirectUri,
            response_type: 'code',
            access_type: 'offline',
            ...(state && { state })
        });

        return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access tokens
     */
    public async exchangeCodeForTokens(code: string): Promise<SlackAuthResponse> {
        try {
            const response = await axios.post('https://slack.com/api/oauth.v2.access', {
                client_id: process.env.SLACK_CLIENT_ID,
                client_secret: process.env.SLACK_CLIENT_SECRET,
                code,
                redirect_uri: process.env.SLACK_REDIRECT_URI,
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            if (!response.data.ok) {
                throw new Error(`Slack OAuth error: ${response.data.error}`);
            }

            return response.data;
        } catch (error) {
            console.error('Error exchanging code for tokens:', error);
            throw new Error('Failed to exchange authorization code');
        }
    }

    /**
     * Refresh access token using refresh token
     */
    public async refreshAccessToken(refreshToken: string): Promise<SlackRefreshResponse> {
        try {
            const response = await axios.post('https://slack.com/api/oauth.v2.access', {
                client_id: process.env.SLACK_CLIENT_ID,
                client_secret: process.env.SLACK_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            if (!response.data.ok) {
                throw new Error(`Token refresh error: ${response.data.error}`);
            }

            return response.data;
        } catch (error) {
            console.error('Error refreshing token:', error);
            throw new Error('Failed to refresh access token');
        }
    }

    /**
     * Get user's channels
     */
    public async getUserChannels(accessToken: string): Promise<SlackChannel[]> {
        try {
            const client = new WebClient(accessToken);

            // Get all conversations (channels, groups, DMs)
            const result = await client.conversations.list({
                types: 'public_channel,private_channel',
                exclude_archived: true,
                limit: 200,
            });

            if (!result.ok || !result.channels) {
                throw new Error('Failed to fetch channels');
            }

            return result.channels.map(channel => ({
                id: channel.id!,
                name: channel.name || 'Unknown',
                isPrivate: channel.is_private || false,
                isMember: channel.is_member || false,
            }));
        } catch (error) {
            console.error('Error fetching channels:', error);
            throw new Error('Failed to fetch user channels');
        }
    }

    /**
     * Send message to channel
     */
    public async sendMessage(accessToken: string, channelId: string, message: string): Promise<boolean> {
        try {
            const client = new WebClient(accessToken);

            const result = await client.chat.postMessage({
                channel: channelId,
                text: message,
            });

            return result.ok || false;
        } catch (error) {
            console.error('Error sending message:', error);
            throw new Error('Failed to send message');
        }
    }

    /**
     * Get user info
     */
    public async getUserInfo(accessToken: string, userId: string): Promise<any> {
        try {
            const client = new WebClient(accessToken);

            const result = await client.users.info({
                user: userId,
            });

            if (!result.ok || !result.user) {
                throw new Error('Failed to get user info');
            }

            return result.user;
        } catch (error) {
            console.error('Error getting user info:', error);
            throw new Error('Failed to get user information');
        }
    }

    /**
     * Validate and refresh token if necessary
     */
    public async ensureValidToken(userId: string): Promise<string> {
        try {
            const user = await SlackUserModel.findOne({ id: userId });

            if (!user) {
                throw new Error('User not found');
            }

            // Check if token is expired (if we have expiration info)
            if (user.tokenExpiresAt && user.tokenExpiresAt <= new Date()) {
                if (!user.refreshToken) {
                    throw new Error('Token expired and no refresh token available');
                }

                // Refresh the token
                const refreshResponse = await this.refreshAccessToken(user.refreshToken);

                // Update user with new tokens
                user.accessToken = refreshResponse.access_token;
                if (refreshResponse.refresh_token) {
                    user.refreshToken = refreshResponse.refresh_token;
                }
                if (refreshResponse.expires_in) {
                    user.tokenExpiresAt = new Date(Date.now() + refreshResponse.expires_in * 1000);
                }

                await user.save();

                console.log(`✅ Token refreshed for user ${userId}`);

                return refreshResponse.access_token;
            }

            return user.accessToken;
        } catch (error) {
            console.error('Error ensuring valid token:', error);
            throw error;
        }
    }
}

export default SlackService.getInstance();
