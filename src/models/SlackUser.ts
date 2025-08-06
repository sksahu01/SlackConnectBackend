import mongoose, { Document, Schema } from 'mongoose';
import { SlackUser } from '../types';

export interface ISlackUser extends Omit<SlackUser, 'id'>, Document {
    _id: string;
}

const slackUserSchema = new Schema<ISlackUser>({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        sparse: true,
    },
    teamId: {
        type: String,
        required: true,
    },
    teamName: {
        type: String,
        required: true,
    },
    accessToken: {
        type: String,
        required: true,
    },
    refreshToken: {
        type: String,
    },
    tokenExpiresAt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update the updatedAt field on save
slackUserSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Create compound index for efficient queries
slackUserSchema.index({ teamId: 1, id: 1 });
slackUserSchema.index({ accessToken: 1 });

export const SlackUserModel = mongoose.model<ISlackUser>('SlackUser', slackUserSchema);
