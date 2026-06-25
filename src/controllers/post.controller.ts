import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { ForbiddenError } from '../common/errors';
import { ResponseUtil } from '../common/utils/response';
import { EPostInteractionType } from '../models/post-interaction.model';
import { EPostOption, EPostStatus, EPostType } from '../models/post.model';
import {
    FriendshipService,
    GroupMemberService,
    PostInteractionService,
    PostService,
    UploadService,
} from '../services';
import { BaseController } from './base.controller';

/**
 * Controller for post-related HTTP handlers.
 */
export class PostController extends BaseController {
    private postService: PostService;
    private postInteractionService: PostInteractionService;
    private friendshipService: FriendshipService;
    private uploadService: UploadService;
    private groupMemberService: GroupMemberService;

    constructor() {
        super();
        this.postService = new PostService();
        this.postInteractionService = new PostInteractionService();
        this.friendshipService = new FriendshipService();
        this.uploadService = new UploadService();
        this.groupMemberService = new GroupMemberService();
    }

    /**
     * POST /api/posts
     * Create a new post.
     */
    public createPost = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postData = req.body;
            const userId = this.getAuthenticatedUserId(req);
            const files = req.files as Express.Multer.File[];
            let mediaIds: string[] = [];

            // 1. Validate group membership if posting to a group
            if (postData.group) {
                const isMember = await this.groupMemberService.isMember(
                    postData.group,
                    userId
                );
                if (!isMember) {
                    throw new ForbiddenError(
                        'You are not a member of this group'
                    );
                }
            }

            // 2. Upload new files if any
            if (files && files.length > 0) {
                const uploadedMedia = await this.uploadService.uploadFiles(
                    files.map((file) => ({
                        buffer: file.buffer,
                        originalname: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size,
                    })),
                    userId
                );
                mediaIds = uploadedMedia.map((media) => media._id.toString());
            }

            // 3. Handle separate upload mediaIds
            if (postData.mediaIds) {
                const bodyMediaIds = Array.isArray(postData.mediaIds)
                    ? postData.mediaIds
                    : [postData.mediaIds];
                mediaIds = [...mediaIds, ...bodyMediaIds];
            }

            // 4. Create post
            const newPost = await this.postService.createPost(
                {
                    text: postData.content,
                    option: postData.option || EPostOption.PUBLIC,
                    tags: postData.tags || [],
                    media: mediaIds.map((id) => new Types.ObjectId(id)),
                    author: new Types.ObjectId(userId),
                    group: postData.group || null,
                    type: postData.group ? EPostType.GROUP : EPostType.DEFAULT,
                    status: postData.group
                        ? EPostStatus.PENDING
                        : EPostStatus.ACTIVE,
                },
                userId
            );

            ResponseUtil.created(res, newPost, 'Post created successfully');
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/posts
     * Get all posts.
     */
    public getAllPosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const posts = await this.postService.getAllPosts();
            ResponseUtil.success(res, posts, 'Posts retrieved successfully');
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/posts/:id
     * Get a post by ID with interaction flags.
     */
    public getPostById = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postId = req.params.id;
            this.validateRequiredParam(postId, 'Post ID');
            const userId = this.getOptionalUserId(req) || postId; // Fallback to postId if not authenticated

            const post = await this.postService.getPostById(postId, userId);
            ResponseUtil.success(res, post, 'Post retrieved successfully');
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/new-feed
     * Get new feed posts (from followings and friends).
     */
    public getNewFeedPosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getOptionalUserId(req);
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const result = await this.postService.getNewFeedPosts(
                userId,
                page,
                pageSize
            );
            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'New feed posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/new-feed-friend
     * Get new feed posts from friends only.
     */
    public getNewFeedFriendPosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const result = await this.postService.getNewFeedFriendPosts(
                userId,
                page,
                pageSize
            );
            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Friend feed posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/new-feed-group
     * Get new feed posts from groups.
     */
    public getNewFeedGroupPosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const result = await this.postService.getNewFeedGroupPosts(
                userId,
                page,
                pageSize
            );
            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Group feed posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/profile/:userId
     * Get profile posts for a specific user.
     */
    public getProfilePosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = req.params.userId;
            this.validateRequiredParam(userId, 'User ID');
            const authenticatedUserId = this.getAuthenticatedUserId(req);
            const isUserAuthenticated = authenticatedUserId === userId;
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const isFriend = await this.friendshipService.areFriends(
                authenticatedUserId,
                userId
            );

            const result = await this.postService.getPostsWithInteraction(
                {
                    author: userId,
                    group: null,
                    status: EPostStatus.ACTIVE,
                    option: isUserAuthenticated
                        ? {
                              $in: [
                                  EPostOption.PUBLIC,
                                  EPostOption.FRIEND,
                                  EPostOption.PRIVATE,
                              ],
                          }
                        : isFriend
                          ? {
                                $in: [EPostOption.PUBLIC, EPostOption.FRIEND],
                            }
                          : EPostOption.PUBLIC,
                },
                authenticatedUserId,
                page,
                pageSize
            );

            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Profile posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/group/:groupId
     * Get posts for a specific group.
     */
    public getGroupPosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const groupId = req.params.groupId;
            this.validateRequiredParam(groupId, 'Group ID');
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const result = await this.postService.getPostsWithInteraction(
                {
                    group: groupId,
                    status: EPostStatus.ACTIVE,
                },
                userId,
                page,
                pageSize
            );

            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Group posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/group/:groupId/manage
     * Get manage group posts (active status).
     */
    public getManageGroupPosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const groupId = req.params.groupId;
            this.validateRequiredParam(groupId, 'Group ID');
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const result = await this.postService.getPostsWithInteraction(
                {
                    group: groupId,
                    status: EPostStatus.ACTIVE,
                },
                userId,
                page,
                pageSize
            );

            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Manage group posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/group/:groupId/manage/pending
     * Get manage group posts (pending status).
     */
    public getManageGroupPostsPending = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const groupId = req.params.groupId;
            this.validateRequiredParam(groupId, 'Group ID');
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const result = await this.postService.getPostsWithInteraction(
                {
                    group: groupId,
                    status: EPostStatus.PENDING,
                },
                userId,
                page,
                pageSize
            );

            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Pending group posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/group/:groupId/member/:userId
     * Get posts by member in a group.
     */
    public getPostByMember = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = req.params.userId;
            const groupId = req.params.groupId;
            this.validateRequiredParam(userId, 'User ID');
            this.validateRequiredParam(groupId, 'Group ID');
            const authenticatedUserId = this.getOptionalUserId(req) || userId;
            const { page, pageSize } = this.getPaginationParams(req, 3);

            const result = await this.postService.getPostsWithInteraction(
                {
                    author: userId,
                    group: groupId,
                    status: EPostStatus.ACTIVE,
                },
                authenticatedUserId,
                page,
                pageSize
            );

            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Member posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * GET /api/v1/posts/saved
     * Get saved posts for the authenticated user.
     */
    public getSavedPosts = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const userId = this.getAuthenticatedUserId(req);
            const { page, pageSize } = this.getPaginationParams(req, 10);

            const result = await this.postService.getSavedPosts(
                userId,
                page,
                pageSize
            );

            ResponseUtil.paginated(
                res,
                result.data,
                result.pagination,
                'Saved posts retrieved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/posts/:id/like
     * Toggle like on a post.
     */
    public likePost = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postId = req.params.id;
            this.validateRequiredParam(postId, 'Post ID');
            const userId = this.getAuthenticatedUserId(req);

            const result = await this.postInteractionService.toggleInteraction(
                postId,
                userId,
                EPostInteractionType.LOVE
            );

            ResponseUtil.success(
                res,
                result,
                result.action === 'added'
                    ? 'Post liked successfully'
                    : 'Post unliked successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/posts/:id/share
     * Toggle share on a post.
     */
    public sharePost = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postId = req.params.id;
            this.validateRequiredParam(postId, 'Post ID');
            const userId = this.getAuthenticatedUserId(req);

            const result = await this.postInteractionService.toggleInteraction(
                postId,
                userId,
                EPostInteractionType.SHARE
            );

            ResponseUtil.success(
                res,
                result,
                result.action === 'added'
                    ? 'Post shared successfully'
                    : 'Post unshared successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * POST /api/posts/:id/save
     * Save a post.
     */
    public savePost = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postId = req.params.id;
            this.validateRequiredParam(postId, 'Post ID');
            const userId = this.getAuthenticatedUserId(req);

            const result = await this.postInteractionService.toggleInteraction(
                postId,
                userId,
                EPostInteractionType.SAVE
            );

            ResponseUtil.success(
                res,
                result,
                result.action === 'added'
                    ? 'Post saved successfully'
                    : 'Post unsaved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/posts/:id/save
     * Unsave a post.
     */
    public unsavePost = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postId = req.params.id;
            this.validateRequiredParam(postId, 'Post ID');
            const userId = this.getAuthenticatedUserId(req);

            // Check if post is saved
            const isSaved = await this.postInteractionService.hasUserInteracted(
                postId,
                userId,
                EPostInteractionType.SAVE
            );

            if (!isSaved) {
                ResponseUtil.success(
                    res,
                    { success: true },
                    'Post is not saved'
                );
                return;
            }

            await this.postInteractionService.toggleInteraction(
                postId,
                userId,
                EPostInteractionType.SAVE
            );

            ResponseUtil.success(
                res,
                { success: true },
                'Post unsaved successfully'
            );
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/posts/:id
     * Delete a post by ID.
     */
    /**
     * PUT /api/posts/:id
     * Update a post by ID.
     */
    public updatePost = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postId = req.params.id;
            this.validateRequiredParam(postId, 'Post ID');
            const userId = this.getAuthenticatedUserId(req);
            const postData = req.body;
            const files = req.files as Express.Multer.File[];

            // Check ownership
            const post = await this.postService.getById(postId);
            if (!post) {
                ResponseUtil.error(res, 'Post not found', 404);
                return;
            }

            if (post.author.toString() !== userId) {
                ResponseUtil.error(
                    res,
                    'You are not authorized to update this post',
                    403
                );
                return;
            }

            let newMediaIds: string[] = [];

            // 1. Upload new files if any
            if (files && files.length > 0) {
                const uploadedMedia = await this.uploadService.uploadFiles(
                    files.map((file) => ({
                        buffer: file.buffer,
                        originalname: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size,
                    })),
                    userId
                );
                newMediaIds = uploadedMedia.map((media) =>
                    media._id.toString()
                );
            }

            // 2. Handle existing media
            let existingMediaIds: string[] = [];
            if (postData.mediaIds) {
                const bodyMediaIds = Array.isArray(postData.mediaIds)
                    ? postData.mediaIds
                    : [postData.mediaIds];
                existingMediaIds = bodyMediaIds;
            }

            // 3. Combine new and existing media
            const finalMediaIds = [...existingMediaIds, ...newMediaIds];

            const updatedPost = await this.postService.updatePost(
                postId,
                { ...postData, media: finalMediaIds, text: postData.content },
                userId
            );

            ResponseUtil.success(res, updatedPost, 'Post updated successfully');
        } catch (error) {
            next(error);
        }
    };

    /**
     * DELETE /api/posts/:id
     * Delete a post by ID.
     */
    public deletePost = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const postId = req.params.id;
            this.validateRequiredParam(postId, 'Post ID');
            const userId = this.getAuthenticatedUserId(req);
            await this.postService.deletePost(postId, userId);
            ResponseUtil.success(
                res,
                { success: true },
                'Post deleted successfully'
            );
        } catch (error) {
            next(error);
        }
    };
}
