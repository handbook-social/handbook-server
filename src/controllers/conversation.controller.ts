import { NextFunction, Request, Response } from 'express';
import { ResponseUtil } from '../common/utils/response';
import { ConversationMemberService, ConversationService, GroupMemberService } from '../services';
import { BaseController } from './base.controller';

export class ConversationController extends BaseController {
    private conversationService: ConversationService;
    private conversationMemberService: ConversationMemberService;
    private groupMemberService: GroupMemberService;

    constructor() {
        super();
        this.conversationService = new ConversationService();
        this.conversationMemberService = new ConversationMemberService();
        this.groupMemberService = new GroupMemberService();
    }

    /**
     * POST /api/v1/conversations
     * Create a new conversation
     */
    public createConversation = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const conversationData = req.body;
            const userId = this.getAuthenticatedUserId(req);

            const conversation =
                await this.conversationService.createConversation(
                    conversationData,
                    userId
                );

            ResponseUtil.created(
                res,
                conversation,
                'Conversation created successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/conversations?user_id=:userId&group_id=:groupId
     * Get conversations by participant or group with pagination
     */
    public getConversations = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const groupId = req.query.group_id as string;
            const { page, pageSize } = this.getPaginationParams(req, 20);

            if (groupId) {
                // Get conversations by group ID
                const result =
                    await this.conversationService.getConversationsByGroup(
                        groupId,
                        {
                            page,
                            pageSize,
                        }
                    );

                ResponseUtil.paginated(
                    res,
                    result.data,
                    result.pagination,
                    'Conversations retrieved successfully'
                );
            } else {
                // Get conversations by participant
                const userId =
                    (req.query.user_id as string) ||
                    this.getAuthenticatedUserId(req);
                this.validateRequiredParam(userId, 'User ID');

                const result =
                    await this.conversationService.getConversationsByParticipant(
                        userId,
                        {
                            page,
                            pageSize,
                        }
                    );

                ResponseUtil.paginated(
                    res,
                    result.data,
                    result.pagination,
                    'Conversations retrieved successfully'
                );
            }
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/conversations/:id
     * Get conversation by ID
     */
    public getConversationById = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const userId = this.getAuthenticatedUserId(req);

            const conversation =
                await this.conversationService.getConversationById(id, userId);

            ResponseUtil.success(
                res,
                conversation,
                'Conversation retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * PUT /api/v1/conversations/:id
     * Update a conversation
     */
    public updateConversation = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const updateData = req.body;
            const userId = this.getAuthenticatedUserId(req);

            const conversation =
                await this.conversationService.updateConversation(
                    id,
                    updateData,
                    userId
                );

            ResponseUtil.updated(
                res,
                conversation,
                'Conversation updated successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/conversations/:id/participants
     * Add participant to conversation
     */
    public addParticipant = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const { participantId } = req.body;
            this.validateRequiredBodyField(req.body, 'participantId');
            const userId = this.getAuthenticatedUserId(req);

            const conversation = await this.conversationService.addParticipant(
                id,
                participantId,
                userId
            );

            ResponseUtil.success(
                res,
                conversation,
                'Participant added successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/v1/conversations/:id/participants/:participantId
     * Remove participant from conversation
     */
    public removeParticipant = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            const participantId = req.params.participantId;
            this.validateRequiredParam(id, 'Conversation ID');
            this.validateRequiredParam(participantId, 'Participant ID');
            const userId = this.getAuthenticatedUserId(req);

            const conversation =
                await this.conversationService.removeParticipant(
                    id,
                    participantId,
                    userId
                );

            ResponseUtil.success(
                res,
                conversation,
                'Participant removed successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/conversations/:id/pin
     * Pin message in conversation
     */
    public pinMessage = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const { messageId } = req.body;
            this.validateRequiredBodyField(req.body, 'messageId');
            const userId = this.getAuthenticatedUserId(req);

            const conversation = await this.conversationService.pinMessage(
                id,
                messageId,
                userId
            );

            ResponseUtil.success(
                res,
                conversation,
                'Message pinned successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/v1/conversations/:id/pin/:messageId
     * Unpin message in conversation
     */
    public unpinMessage = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            const messageId = req.params.messageId;
            this.validateRequiredParam(id, 'Conversation ID');
            this.validateRequiredParam(messageId, 'Message ID');
            const userId = this.getAuthenticatedUserId(req);

            const conversation = await this.conversationService.unpinMessage(
                id,
                messageId,
                userId
            );

            ResponseUtil.success(
                res,
                conversation,
                'Message unpinned successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/v1/conversations/:id
     * Delete conversation for user (soft delete)
     */
    public deleteConversation = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const userId = this.getAuthenticatedUserId(req);

            await this.conversationService.deleteConversationForUser(
                id,
                userId
            );

            ResponseUtil.deleted(res, 'Conversation deleted successfully');
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/conversations/private?user_id=:userId&friend_id=:friendId
     * Get or create private conversation between two users
     */
    public getPrivateConversation = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId =
                (req.query.user_id as string) ||
                this.getAuthenticatedUserId(req);
            const friendId = req.query.friend_id as string;
            this.validateRequiredParam(userId, 'User ID');
            this.validateRequiredParam(friendId, 'Friend ID');

            const result =
                await this.conversationService.getPrivateConversation(
                    userId,
                    friendId
                );

            ResponseUtil.success(
                res,
                result,
                result.isNew
                    ? 'Private conversation created successfully'
                    : 'Private conversation retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/v1/conversations/:id/restore
     * Restore conversation (undelete) for user
     */
    public restoreConversation = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const userId = this.getAuthenticatedUserId(req);

            const conversation =
                await this.conversationService.restoreConversation(id, userId);

            ResponseUtil.success(
                res,
                conversation,
                'Conversation restored successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/conversations/:id/members
     * List members of a conversation
     */
    public listMembers = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const userId = this.getAuthenticatedUserId(req);

            const isAllowed = await this.conversationMemberService.isMember(
                id,
                userId
            );
            if (!isAllowed) {
                return ResponseUtil.forbidden(
                    res,
                    'You are not a member of this conversation'
                );
            }

            const members =
                await this.conversationMemberService.listMembers(id);

            ResponseUtil.success(
                res,
                members,
                'Conversation members retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/conversations/group/:groupId
     * Get conversations by group ID
     */
    public getConversationsByGroupId = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const groupId = req.params.groupId;
            this.validateRequiredParam(groupId, 'Group ID');

            const result =
                await this.conversationService.getConversationsByGroup(
                    groupId,
                    { page: 1, pageSize: 10 }
                );

            if (result.data && result.data.length === 0) {
                return ResponseUtil.notFound(
                    res,
                    'Conversation not found for this group'
                );
            }

            ResponseUtil.success(
                res,
                result.data,
                'Conversation retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/conversations/:id/access
     * Check if user has access to conversation
     */
    public checkAccess = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const id = req.params.id;
            this.validateRequiredParam(id, 'Conversation ID');
            const userId = this.getAuthenticatedUserId(req);

            const conversation = await this.conversationService.getById(id);
            if (!conversation) {
                ResponseUtil.success(
                    res,
                    { hasAccess: false, isMember: false, isGroupMember: false },
                    'Conversation not found'
                );
                return;
            }

            let hasAccess = false;
            const isMember = await this.conversationMemberService.isMember(id, userId);
            let isGroupMember = false;

            if (conversation.type === 'private') {
                hasAccess = isMember;
            } else if (conversation.type === 'group') {
                if (conversation.group) {
                    isGroupMember = await this.groupMemberService.isMember(
                        conversation.group.toString(),
                        userId
                    );
                    // A user has access if they are already in the conversation or are part of the linked Group
                    hasAccess = isMember || isGroupMember;
                } else {
                    hasAccess = isMember;
                }
            }

            ResponseUtil.success(
                res,
                {
                    hasAccess,
                    isMember,
                    isGroupMember,
                },
                'Access check completed'
            );
        } catch (error) {
            next(error);
        }
    };
}
