import { HTTP_STATUS } from '../common/constants/status-code';
import {
    AppError,
    ForbiddenError,
    NotFoundError,
} from '../common/errors/app.error';
import { PaginationParams, PaginationResult } from '../common/types/base';
import {
    EConversationType,
    IConversationInput,
    IConversationModel,
} from '../models/conversation.model';
import { ConversationRepository } from '../repositories/conversation.repository';
import { BaseService } from './base.service';
import { ConversationMemberService } from './conversation-member.service';
import { GroupMemberService } from './group-member.service';

export class ConversationService extends BaseService<IConversationModel> {
    private conversationRepository: ConversationRepository;
    private conversationMemberService: ConversationMemberService;
    private groupMemberService: GroupMemberService;

    constructor() {
        const repository = new ConversationRepository();
        super(repository);
        this.conversationRepository = repository;
        this.conversationMemberService = new ConversationMemberService();
        this.groupMemberService = new GroupMemberService();
    }

    /**
     * Create a new conversation
     * @param data - Conversation data
     * @param userId - User ID creating the conversation
     * @param participants - Optional participants to add (for initialization)
     * @returns Created conversation
     */
    async createConversation(
        data: Partial<IConversationInput>,
        userId: string,
        participants?: string[]
    ): Promise<IConversationModel> {
        try {
            // Set creator
            data.creator = userId as any;

            // Set default type if not provided
            if (!data.type) {
                data.type = EConversationType.PRIVATE;
            }

            const conversation = await this.create(data, userId);

            // Validate conversation was created with ID
            if (!conversation._id) {
                throw new AppError(
                    'Failed to create conversation: no ID generated',
                    HTTP_STATUS.INTERNAL_SERVER_ERROR
                );
            }

            // Add creator as admin member
            await this.conversationMemberService.addMember(
                conversation._id.toString(),
                userId,
                'admin'
            );

            // Add other participants as members (if provided)
            if (participants && participants.length > 0) {
                for (const participantId of participants) {
                    if (participantId) {
                        await this.conversationMemberService.addMember(
                            conversation._id.toString(),
                            participantId,
                            'member'
                        );
                    }
                }
            }

            return conversation;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to create conversation: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get conversations by member with pagination
     * @param userId - User ID
     * @param params - Pagination parameters
     * @returns Paginated conversations
     */
    async getConversationsByMember(
        userId: string,
        params: PaginationParams
    ): Promise<PaginationResult<IConversationModel>> {
        try {
            this.validateId(userId, 'User ID');

            const { page = 1, pageSize = 20 } = params;

            const result =
                await this.conversationRepository.findByMemberWithPagination(
                    userId,
                    page,
                    pageSize
                );

            return result as PaginationResult<IConversationModel>;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to get conversations: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get conversations by participant with pagination (deprecated - use getConversationsByMember)
     * @param userId - User ID
     * @param params - Pagination parameters
     * @returns Paginated conversations
     */
    async getConversationsByParticipant(
        userId: string,
        params: PaginationParams
    ): Promise<PaginationResult<IConversationModel>> {
        return this.getConversationsByMember(userId, params);
    }

    /**
     * Get conversation by ID
     * @param conversationId - Conversation ID
     * @param userId - User ID (for permission check)
     * @returns Conversation
     */
    async getConversationById(
        conversationId: string,
        userId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(conversationId, 'Conversation ID');

            const conversation =
                await this.conversationRepository.findByIdWithPopulate(
                    conversationId
                );

            if (!conversation) {
                throw new NotFoundError(
                    `Conversation not found with id: ${conversationId}`
                );
            }

            // Check permissions based on conversation type
            if (conversation.type === EConversationType.PRIVATE) {
                const isMember = await this.conversationMemberService.isMember(
                    conversationId,
                    userId
                );

                if (!isMember) {
                    throw new AppError(
                        'You do not have permission to access this conversation',
                        HTTP_STATUS.FORBIDDEN
                    );
                }
            } else if (conversation.type === EConversationType.GROUP) {
                if (conversation.group) {
                    // If it is a group conversation, the user must be a member of the group
                    const isGroupMember = await this.groupMemberService.isMember(
                        conversation.group.toString(),
                        userId
                    );
                    if (!isGroupMember) {
                        throw new AppError(
                            'You do not have permission to access this group conversation',
                            HTTP_STATUS.FORBIDDEN
                        );
                    }
                } else {
                    // Independent group chat without group association, user must be a member of the conversation
                    const isMember = await this.conversationMemberService.isMember(
                        conversationId,
                        userId
                    );
                    if (!isMember) {
                        throw new AppError(
                            'You do not have permission to access this conversation',
                            HTTP_STATUS.FORBIDDEN
                        );
                    }
                }
            }

            return conversation as IConversationModel;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to get conversation: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Update a conversation
     * @param id - Conversation ID
     * @param data - Update data
     * @param userId - User ID performing the action
     * @returns Updated conversation
     */
    async updateConversation(
        id: string,
        data: Partial<IConversationInput>,
        userId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(id);

            const updated = await this.update(id, data, userId);
            if (!updated) {
                throw new NotFoundError(
                    `Conversation not found with id: ${id}`
                );
            }

            return updated;
        } catch (error) {
            if (error instanceof AppError || error instanceof NotFoundError) {
                throw error;
            }
            throw new AppError(
                `Failed to update conversation: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Add participant to conversation (via ConversationMember)
     * @param conversationId - Conversation ID
     * @param participantId - User ID to add
     * @param userId - User ID performing the action
     * @returns Updated conversation
     */
    async addParticipant(
        conversationId: string,
        participantId: string,
        userId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(conversationId, 'Conversation ID');
            this.validateId(participantId, 'Participant ID');

            // If the user is trying to join the conversation themselves
            if (userId === participantId) {
                const conversation = await this.getByIdOrThrow(conversationId);

                // Allow self-join if it's a group conversation and the user is a member of the linked Group
                if (conversation.type === EConversationType.GROUP) {
                    if (conversation.group) {
                        const isGroupMember = await this.groupMemberService.isMember(
                            conversation.group.toString(),
                            userId
                        );
                        if (!isGroupMember) {
                            throw new AppError(
                                'You must be a member of the group to join this conversation',
                                HTTP_STATUS.FORBIDDEN
                            );
                        }
                    } else {
                        throw new AppError(
                            'You do not have permission to join this conversation directly',
                            HTTP_STATUS.FORBIDDEN
                        );
                    }
                } else {
                    throw new AppError(
                        'You cannot join a private conversation directly',
                        HTTP_STATUS.FORBIDDEN
                    );
                }
            } else {
                // Otherwise, the requester must already be a member of the conversation to add others
                const isMember = await this.conversationMemberService.isMember(
                    conversationId,
                    userId
                );

                if (!isMember) {
                    throw new AppError(
                        'You do not have permission to add participants',
                        HTTP_STATUS.FORBIDDEN
                    );
                }
            }

            // Add new participant as member
            await this.conversationMemberService.addMember(
                conversationId,
                participantId,
                'member'
            );

            const conversation = await this.getByIdOrThrow(conversationId);
            return conversation;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to add participant: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Remove participant from conversation (via ConversationMember)
     * @param conversationId - Conversation ID
     * @param participantId - User ID to remove
     * @param userId - User ID performing the action
     * @returns Updated conversation
     */
    async removeParticipant(
        conversationId: string,
        participantId: string,
        userId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(conversationId, 'Conversation ID');
            this.validateId(participantId, 'Participant ID');

            // Check if requester is a member
            const isMember = await this.conversationMemberService.isMember(
                conversationId,
                userId
            );

            if (!isMember) {
                throw new AppError(
                    'You do not have permission to remove participants',
                    HTTP_STATUS.FORBIDDEN
                );
            }

            // Remove participant
            await this.conversationMemberService.removeMember(
                conversationId,
                participantId
            );

            const conversation = await this.getByIdOrThrow(conversationId);
            return conversation;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to remove participant: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Pin message in conversation
     * @param conversationId - Conversation ID
     * @param messageId - Message ID
     * @param userId - User ID performing the action
     * @returns Updated conversation
     */
    async pinMessage(
        conversationId: string,
        messageId: string,
        userId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(conversationId, 'Conversation ID');
            this.validateId(messageId, 'Message ID');

            // Check if user is member
            const isMember = await this.conversationMemberService.isMember(
                conversationId,
                userId
            );

            if (!isMember) {
                throw new ForbiddenError(
                    'You do not have permission to pin messages'
                );
            }

            const conversation = await this.conversationRepository.pinMessage(
                conversationId,
                messageId
            );

            if (!conversation) {
                throw new NotFoundError(
                    `Conversation not found with id: ${conversationId}`
                );
            }

            return conversation as IConversationModel;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to pin message: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Unpin message in conversation
     * @param conversationId - Conversation ID
     * @param messageId - Message ID
     * @param userId - User ID performing the action
     * @returns Updated conversation
     */
    async unpinMessage(
        conversationId: string,
        messageId: string,
        userId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(conversationId, 'Conversation ID');
            this.validateId(messageId, 'Message ID');

            // Check if user is member
            const isMember = await this.conversationMemberService.isMember(
                conversationId,
                userId
            );

            if (!isMember) {
                throw new ForbiddenError(
                    'You do not have permission to unpin messages'
                );
            }

            const conversation = await this.conversationRepository.unpinMessage(
                conversationId,
                messageId
            );

            if (!conversation) {
                throw new NotFoundError(
                    `Conversation not found with id: ${conversationId}`
                );
            }

            return conversation as IConversationModel;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to unpin message: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Delete conversation for user (soft delete)
     * @param conversationId - Conversation ID
     * @param userId - User ID
     * @returns True if deleted
     */
    async deleteConversationForUser(
        conversationId: string,
        userId: string
    ): Promise<boolean> {
        try {
            this.validateId(conversationId, 'Conversation ID');

            const conversation =
                await this.conversationRepository.softDeleteForUser(
                    conversationId,
                    userId
                );

            if (!conversation) {
                throw new NotFoundError(
                    `Conversation not found with id: ${conversationId}`
                );
            }

            return true;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to delete conversation: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Update last message
     * @param conversationId - Conversation ID
     * @param messageId - Message ID
     * @returns Updated conversation
     */
    async updateLastMessage(
        conversationId: string,
        messageId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(conversationId, 'Conversation ID');
            this.validateId(messageId, 'Message ID');

            const conversation =
                await this.conversationRepository.updateLastMessage(
                    conversationId,
                    messageId
                );

            if (!conversation) {
                throw new NotFoundError(
                    `Conversation not found with id: ${conversationId}`
                );
            }

            return conversation as IConversationModel;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to update last message: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get conversations by group ID with pagination
     * @param groupId - Group ID
     * @param params - Pagination parameters
     * @returns Paginated conversations
     */
    async getConversationsByGroup(
        groupId: string,
        params: PaginationParams
    ): Promise<PaginationResult<IConversationModel>> {
        try {
            this.validateId(groupId, 'Group ID');

            const { page = 1, pageSize = 20 } = params;

            const result =
                await this.conversationRepository.findByGroupWithPagination(
                    groupId,
                    page,
                    pageSize
                );

            return result as PaginationResult<IConversationModel>;
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to get conversations by group: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Get or create private conversation between two users
     * @param userId - First user ID
     * @param friendId - Second user ID
     * @returns Conversation with isNew flag
     */
    async getPrivateConversation(
        userId: string,
        friendId: string
    ): Promise<{ isNew: boolean; conversation: IConversationModel }> {
        try {
            this.validateId(userId, 'User ID');
            this.validateId(friendId, 'Friend ID');

            if (userId === friendId) {
                throw new AppError(
                    'Cannot create conversation with yourself',
                    HTTP_STATUS.BAD_REQUEST
                );
            }

            // Try to find existing private conversation
            let conversation =
                await this.conversationRepository.findPrivateConversation(
                    userId,
                    friendId
                );

            let isNew = false;

            // If not found, create a new one
            if (!conversation) {
                isNew = true;
                conversation = await this.createConversation(
                    {
                        type: EConversationType.PRIVATE,
                    },
                    userId,
                    [userId, friendId]
                );
            }

            return {
                isNew,
                conversation: conversation as IConversationModel,
            };
        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to get private conversation: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Restore conversation (undelete) for user
     * @param conversationId - Conversation ID
     * @param userId - User ID
     * @returns Restored conversation
     */
    async restoreConversation(
        conversationId: string,
        userId: string
    ): Promise<IConversationModel> {
        try {
            this.validateId(conversationId, 'Conversation ID');
            this.validateId(userId, 'User ID');

            const conversation =
                await this.conversationRepository.restoreConversation(
                    conversationId,
                    userId
                );

            if (!conversation) {
                throw new NotFoundError(
                    `Conversation not found with id: ${conversationId}`
                );
            }

            return conversation as IConversationModel;
        } catch (error) {
            if (error instanceof NotFoundError || error instanceof AppError) {
                throw error;
            }
            throw new AppError(
                `Failed to restore conversation: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
                HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }
}
