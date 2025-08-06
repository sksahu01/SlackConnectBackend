export interface SlackTokens {
    accessToken: string;
    refreshToken?: string;
    tokenType: string;
    scope: string;
    expiresAt?: Date;
    teamId: string;
    teamName: string;
    userId: string;
    userName: string;
}

export interface SlackChannel {
    id: string;
    name: string;
    isPrivate: boolean;
    isMember: boolean;
}

export interface SlackUser {
    id: string;
    name: string;
    email?: string;
    teamId: string;
    teamName: string;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface ScheduledMessage {
    id: string;
    userId: string;
    teamId: string;
    channelId: string;
    channelName: string;
    message: string;
    scheduledFor: Date;
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    createdAt: Date;
    updatedAt: Date;
    sentAt?: Date;
    error?: string;
}

export interface SlackAuthResponse {
    ok: boolean;
    access_token: string;
    token_type: string;
    scope: string;
    bot_user_id?: string;
    app_id: string;
    team: {
        id: string;
        name: string;
    };
    enterprise?: {
        id: string;
        name: string;
    };
    authed_user: {
        id: string;
        scope: string;
        access_token: string;
        token_type: string;
    };
    incoming_webhook?: {
        url: string;
        channel: string;
        channel_id: string;
    };
    refresh_token?: string;
    expires_in?: number;
}

export interface SlackRefreshResponse {
    ok: boolean;
    access_token: string;
    token_type: string;
    scope: string;
    refresh_token?: string;
    expires_in?: number;
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface MessageRequest {
    channelId: string;
    message: string;
    scheduledFor?: string; // ISO date string
}

export interface SendMessageRequest {
    channelId: string;
    message: string;
}
