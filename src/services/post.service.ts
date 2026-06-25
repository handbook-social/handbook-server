import { HTTP_STATUS } from '../common/constants/status-code';
import { AppError, NotFoundError } from '../common/errors/app.error';
import { PaginationResult } from '../common/types/base';
import PostInteraction, {
    EPostInteractionType,
} from '../models/post-interaction.model';
import {
    EPostOption,
    EPostStatus,
    EPostType,
    IPostModel,
    IPostWithInteraction,
} from '../models/post.model';
import { PostRepository } from '../repositories/post.repository';
import { BaseService } from './base.service';
import { FollowService } from './follow.service';
import { FriendshipService } from './friendship.service';
import { GroupMemberService } from './group-member.service';
import { NotificationService } from './notification.service';
import { UserService } from './user.service';

/**
 * Service responsible for post-related business logic.
 */
export class PostService extends BaseService<IPostModel> {
    private postRepository: PostRepository;
    private userService: UserService;
    private followService: FollowService;
    private groupMemberService: GroupMemberService;
    private friendshipService: FriendshipService;

    private notificationService: NotificationService;

    constructor() {
        const repository = new PostRepository();
        super(repository);
        this.postRepository = repository;
        this.userService = new UserService();
        this.followService = new FollowService();
        this.groupMemberService = new GroupMemberService();
        this.friendshipService = new FriendshipService();
        this.notificationService = new NotificationService();
    }

    /**
     * Create a new post
     * @param data - Post data
     * @param userId - User ID performing the action
     * @returns Created post
     */
    async createPost(
        data: Partial<IPostModel>,
        userId: string
    ): Promise<IPostModel> {
        // Validate required fields
        this.validateRequiredFields(data, ['author']);

        const post = await this.create(data, userId);

        // Notify followers
        try {
            // If post is not in a group, notify followers
            if (!data?.group) {
                const followers =
                    await this.followService.getFollowerIds(userId);
                if (followers.length > 0) {
                    await Promise.all(
                        followers.map((followerId) =>
                            this.notificationService.createPostNotification(
                                userId,
                                followerId,
                                post._id.toString()
                            )
                        )
                    );
                }
            }
        } catch (error) {
            console.error('Error sending post notifications:', error);
        }

        return post;
    }

    /**
     * Update post by ID
     * @param id - Post ID
     * @param data - Update data
     * @param userId - User ID performing the action
     * @returns Updated post
     */
    async updatePost(
        id: string,
        data: Partial<IPostModel>,
        userId: string
    ): Promise<IPostModel> {
        this.validateId(id);

        // Don't allow changing author
        delete data.author;

        const updated = await this.update(id, data, userId);
        if (!updated) {
            throw new NotFoundError(`Post not found with id: ${id}`);
        }

        return updated;
    }

    /**
     * Get posts by author
     * @param authorId - Author ID
     * @returns Array of posts
     */
    async getPostsByAuthor(authorId: string): Promise<IPostModel[]> {
        this.validateId(authorId, 'Author ID');
        return await this.postRepository.findManyWithSort(
            {
                author: authorId,
                status: EPostStatus.ACTIVE,
            },
            { createdAt: -1 }
        );
    }

    /**
     * Get posts by group
     * @param groupId - Group ID
     * @returns Array of posts
     */
    async getPostsByGroup(groupId: string): Promise<IPostModel[]> {
        this.validateId(groupId, 'Group ID');
        return await this.postRepository.findManyWithSort(
            {
                group: groupId,
                status: EPostStatus.ACTIVE,
            },
            { createdAt: -1 }
        );
    }

    /**
     * Search posts by text
     * @param searchTerm - Search term
     * @returns Array of posts
     */
    async searchPosts(searchTerm: string): Promise<IPostModel[]> {
        if (!searchTerm || searchTerm.trim().length < 2) {
            throw new AppError(
                'Search term must be at least 2 characters',
                HTTP_STATUS.BAD_REQUEST
            );
        }

        return await this.postRepository.findMany({
            $text: { $search: searchTerm },
            status: EPostStatus.ACTIVE,
        });
    }

    /**
     * Get posts by tags
     * @param tags - Array of tags
     * @returns Array of posts
     */
    async getPostsByTags(tags: string[]): Promise<IPostModel[]> {
        if (!tags || tags.length === 0) {
            throw new AppError('Tags are required', HTTP_STATUS.BAD_REQUEST);
        }

        return await this.postRepository.findManyWithSort(
            {
                tags: { $in: tags },
                status: EPostStatus.ACTIVE,
            },
            { createdAt: -1 }
        );
    }

    /**
     * Increment post interaction count
     * @param postId - Post ID
     * @param field - Field to increment (lovesCount, sharesCount, commentsCount)
     * @returns Updated post
     */
    async incrementPostCount(
        postId: string,
        field: 'lovesCount' | 'sharesCount' | 'commentsCount'
    ) {
        this.validateId(postId);

        const post = await this.postRepository.findOneAndUpdate(
            { _id: postId },
            { $inc: { [field]: 1 } }
        );

        if (!post) {
            throw new NotFoundError(`Post not found with id: ${postId}`);
        }

        return post;
    }

    /**
     * Decrement post interaction count
     * @param postId - Post ID
     * @param field - Field to decrement (lovesCount, sharesCount, commentsCount)
     * @returns Updated post
     */
    async decrementPostCount(
        postId: string,
        field: 'lovesCount' | 'sharesCount' | 'commentsCount'
    ) {
        this.validateId(postId);

        const post = await this.postRepository.findOneAndUpdate(
            { _id: postId },
            { $inc: { [field]: -1 } }
        );

        if (!post) {
            throw new NotFoundError(`Post not found with id: ${postId}`);
        }

        return post;
    }

    /**
     * Get post by ID with interaction flags.
     * @param postId - Post ID
     * @param userId - User ID to check interactions
     * @returns Post with interaction flags
     */
    async getPostById(
        postId: string,
        userId: string
    ): Promise<IPostWithInteraction> {
        this.validateId(postId, 'Post ID');
        this.validateId(userId, 'User ID');

        const post = await this.postRepository.findByIdWithInteraction(
            postId,
            userId
        );

        if (!post) {
            throw new NotFoundError(`Post not found with id: ${postId}`);
        }

        return post;
    }

    /**
     * Get all posts.
     * @returns Array of posts
     */
    async getAllPosts(): Promise<IPostModel[]> {
        return await this.postRepository.findAll();
    }

    /**
     * Get new feed posts (from followings and friends).
     * @param userId - User ID
     * @param page - Current page
     * @param pageSize - Number of posts per page
     * @returns Paginated posts with interactions
     */
    async getNewFeedPosts(
        userId: string | undefined,
        page: number,
        pageSize: number
    ): Promise<PaginationResult<IPostWithInteraction>> {
        this.validatePagination(page, pageSize);

        if (!userId) {
            const filters = {
                group: null,
                option: EPostOption.PUBLIC,
            };
            return await this.postRepository.findManyWithInteraction(
                filters,
                '',
                page,
                pageSize
            );
        }

        this.validateId(userId, 'User ID');

        const [followingIds, friendIds] = await Promise.all([
            this.followService.getFollowingIds(userId),
            this.friendshipService.getFriendIds(userId),
        ]);

        const filters = {
            $or: [
                {
                    author: {
                        $in: followingIds,
                    },
                    option: EPostOption.PUBLIC,
                },
                {
                    author: {
                        $in: friendIds,
                    },
                    option: {
                        $in: [EPostOption.FRIEND, EPostOption.PUBLIC],
                    },
                },
                {
                    group: null,
                    option: {
                        $in: [EPostOption.PUBLIC],
                    },
                },
                {
                    author: userId,
                },
            ],
        };

        return await this.postRepository.findManyWithInteraction(
            filters,
            userId,
            page,
            pageSize
        );
    }

    /**
     * Get new feed posts from friends only.
     * @param userId - User ID
     * @param page - Current page
     * @param pageSize - Number of posts per page
     * @returns Paginated posts with interactions
     */
    async getNewFeedFriendPosts(
        userId: string,
        page: number,
        pageSize: number
    ): Promise<PaginationResult<IPostWithInteraction>> {
        this.validateId(userId, 'User ID');
        this.validatePagination(page, pageSize);

        const friendIds = await this.friendshipService.getFriendIds(userId);

        if (friendIds.length === 0) {
            return {
                data: [],
                pagination: {
                    page,
                    pageSize,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
            };
        }

        return await this.postRepository.findManyWithInteraction(
            {
                author: {
                    $in: friendIds,
                },
            },
            userId,
            page,
            pageSize
        );
    }

    /**
     * Get new feed posts from groups.
     * @param userId - User ID
     * @param page - Current page
     * @param pageSize - Number of posts per page
     * @returns Paginated posts with interactions
     */
    async getNewFeedGroupPosts(
        userId: string,
        page: number,
        pageSize: number
    ): Promise<PaginationResult<IPostWithInteraction>> {
        this.validateId(userId, 'User ID');
        this.validatePagination(page, pageSize);

        const groupIds = await this.groupMemberService.getUserGroupIds(userId);

        if (groupIds.length === 0) {
            return {
                data: [],
                pagination: {
                    page,
                    pageSize,
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false,
                },
            };
        }

        return await this.postRepository.findManyWithInteraction(
            {
                group: {
                    $in: groupIds,
                },
                status: EPostStatus.ACTIVE,
                type: EPostType.GROUP,
            },
            userId,
            page,
            pageSize
        );
    }

    /**
     * Get saved posts for the authenticated user.
     * @param userId - User ID
     * @param page - Current page
     * @param pageSize - Number of posts per page
     * @returns Paginated saved posts with interactions
     */
    async getSavedPosts(
        userId: string,
        page: number,
        pageSize: number
    ): Promise<PaginationResult<IPostWithInteraction>> {
        this.validateId(userId, 'User ID');
        this.validatePagination(page, pageSize);

        const { currentPage, currentPageSize } = this.normalizePagination(
            page,
            pageSize
        );
        const skip = (currentPage - 1) * currentPageSize;

        const [interactions, total] = await Promise.all([
            PostInteraction.find({
                user: userId,
                type: EPostInteractionType.SAVE,
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(currentPageSize)
                .lean(),
            PostInteraction.countDocuments({
                user: userId,
                type: EPostInteractionType.SAVE,
            }),
        ]);

        const postIds = interactions.map((interaction) =>
            interaction.post.toString()
        );

        const totalPages = Math.ceil(total / currentPageSize) || 1;

        if (postIds.length === 0) {
            return {
                data: [],
                pagination: {
                    page: currentPage,
                    pageSize: currentPageSize,
                    total,
                    totalPages,
                    hasNext: currentPage < totalPages,
                    hasPrev: currentPage > 1,
                },
            };
        }

        const postsResult = await this.postRepository.findManyWithInteraction(
            { _id: { $in: postIds } },
            userId,
            1,
            postIds.length
        );

        const postsMap = new Map(
            postsResult.data.map((post) => [post._id.toString(), post])
        );

        const orderedPosts = postIds
            .map((id) => postsMap.get(id))
            .filter((post): post is IPostWithInteraction => Boolean(post));

        return {
            data: orderedPosts,
            pagination: {
                page: currentPage,
                pageSize: currentPageSize,
                total,
                totalPages,
                hasNext: currentPage < totalPages,
                hasPrev: currentPage > 1,
            },
        };
    }

    /**
     * Get posts with interaction.
     * @param filter - Filter
     * @param userId - User ID
     * @param page - Page
     * @param pageSize - Page size
     * @returns Paginated posts with interactions
     */
    public async getPostsWithInteraction(
        filter: any,
        userId: string,
        page: number,
        pageSize: number
    ): Promise<PaginationResult<IPostWithInteraction>> {
        return await this.postRepository.findManyWithInteraction(
            filter,
            userId,
            page,
            pageSize
        );
    }

    /**
     * Increment comments count of a post.
     * @param postId - Post ID
     * @param incrementBy - Number to increment by (default is 1)
     */
    async incrementCommentsCount(
        postId: string,
        incrementBy: number = 1
    ): Promise<void> {
        this.validateId(postId, 'Post ID');
        await this.postRepository.incrementCommentsCount(postId, incrementBy);
    }

    /**
     * Delete post by ID.
     * @param postId - Post ID
     * @param userId - User ID performing the action
     */
    async deletePost(postId: string, userId: string): Promise<void> {
        this.validateId(postId, 'Post ID');

        const post = await this.getById(postId);
        if (!post) {
            throw new Error('Post not found');
        }

        const isUserAuthenticated = userId === post.author.toString();
        if (!isUserAuthenticated) {
            throw new Error('You are not authorized to delete this post');
        }

        await this.delete(postId, userId);
    }
}
