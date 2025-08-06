import mongoose, { Document, Schema } from 'mongoose';
import { ScheduledMessage } from '../types';

export interface IScheduledMessage extends Omit<ScheduledMessage, 'id'>, Document {
    _id: string;
}

const scheduledMessageSchema = new Schema<IScheduledMessage>({
    userId: {
        type: String,
        required: true,
    },
    teamId: {
        type: String,
        required: true,
    },
    channelId: {
        type: String,
        required: true,
    },
    channelName: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
        maxlength: 4000, // Slack's message limit
    },
    scheduledFor: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'cancelled'],
        default: 'pending',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    sentAt: {
        type: Date,
    },
    error: {
        type: String,
    },
});

// Update the updatedAt field on save
scheduledMessageSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Create indexes for efficient queries
scheduledMessageSchema.index({ userId: 1, createdAt: -1 });
scheduledMessageSchema.index({ scheduledFor: 1, status: 1 });
scheduledMessageSchema.index({ teamId: 1, status: 1 });

export const ScheduledMessageModel = mongoose.model<IScheduledMessage>('ScheduledMessage', scheduledMessageSchema);
