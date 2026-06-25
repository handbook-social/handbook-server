import { FilterQuery, Types } from 'mongoose';
import { PaginationResult } from '../common/types/base';
import { POPULATE_GROUP, POPULATE_USER } from '../common/utils/populate';
import PostInteraction, {
    EPostInteractionType,
} from '../models/post-interaction.model';
import Post, { IPostModel, IPostWithInteraction } from '../models/post.model';
import { BaseRepository } from './base.repository';

/**
 * Repository for post-related database operations.
 */
export class PostRepository extends BaseRepository<IPostModel> {
    constructor() {
        super(Post);
    }

    /**
     * Find a post by ID with populated fields and user interactions.
     * @param postId - Post ID
     * @param userId - User ID to check interactions
     * @returns Post with interaction flags or null if not found
     */
    async findByIdWithInteraction(
        postId: string,
        userId: string
    ): Promise<IPostWithInteraction | null> {
        const post = await this.model
            .findOne({
                _id: new Types.ObjectId(postId),
            })
            .populate('media')
            .populate('author', POPULATE_USER)
            .populate(POPULATE_GROUP)
            .lean<IPostWithInteraction>();

        if (!post) {
            return null;
        }

        const interactions = await PostInteraction.find({
            post: post._id,
            user: userId,
            type: {
                $in: [
                    EPostInteractionType.LOVE,
                    EPostInteractionType.SHARE,
                    EPostInteractionType.SAVE,
                ],
            },
        }).lean();

        const isLoved = interactions.some(
            (i) => i.type === EPostInteractionType.LOVE
        );
        const isShared = interactions.some(
            (i) => i.type === EPostInteractionType.SHARE
        );
        const isSaved = interactions.some(
            (i) => i.type === EPostInteractionType.SAVE
        );

        return {
            ...post,
            userHasLoved: isLoved,
            userHasShared: isShared,
            userHasSaved: isSaved,
        } as IPostWithInteraction;
    }

    /**
     * Find all posts with populated fields.
     * @returns Array of posts
     */
    async findAll(): Promise<IPostModel[]> {
        return await this.model.find().lean<IPostModel[]>();
    }

    /**
     * Find posts with pagination and user interaction flags.
     * @param filter - MongoDB filter query
     * @param userId - User ID to check interactions
     * @param page - Current page (1-based index)
     * @param pageSize - Number of posts per page
     * @returns Paginated result with posts and interaction flags
     */
    public async findManyWithInteraction(
        filter: FilterQuery<IPostModel>,
        userId: string | undefined,
        page: number,
        pageSize: number
    ): Promise<PaginationResult<IPostWithInteraction>> {
        const skip = (page - 1) * pageSize;

        const [posts, totalPosts] = await Promise.all([
            this.model
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .populate('media')
                .populate('author', POPULATE_USER)
                .populate(POPULATE_GROUP)
                .lean<IPostWithInteraction[]>(),
            this.model.countDocuments(filter),
        ]);

        let interactions: any[] = [];
        if (userId) {
            interactions = await PostInteraction.find({
                user: userId,
                post: { $in: posts.map((post) => post._id) },
                type: {
                    $in: [
                        EPostInteractionType.LOVE,
                        EPostInteractionType.SHARE,
                        EPostInteractionType.SAVE,
                    ],
                },
            }).lean();
        }

        const interactionMap = new Map<string, Set<EPostInteractionType>>();
        interactions.forEach((interaction) => {
            const key = interaction.post.toString();
            if (!interactionMap.has(key)) {
                interactionMap.set(key, new Set());
            }
            interactionMap.get(key)?.add(interaction.type);
        });

        const postsWithInteraction = posts.map((post) => ({
            ...post,
            userHasLoved: interactionMap
                .get(post._id.toString())
                ?.has(EPostInteractionType.LOVE)
                ? true
                : false,
            userHasShared: interactionMap
                .get(post._id.toString())
                ?.has(EPostInteractionType.SHARE)
                ? true
                : false,
            userHasSaved: interactionMap
                .get(post._id.toString())
                ?.has(EPostInteractionType.SAVE)
                ? true
                : false,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
        })) as IPostWithInteraction[];

        return {
            data: postsWithInteraction,
            pagination: {
                page,
                pageSize,
                total: totalPosts,
                totalPages: Math.ceil(totalPosts / pageSize),
                hasNext: page < Math.ceil(totalPosts / pageSize),
                hasPrev: page > 1,
            },
        };
    }

    /**
     * Increment the comments count of a post.
     * @param postId - Post ID
     * @param incrementBy - Number to increment by (default is 1)
     */
    async incrementCommentsCount(
        postId: string,
        incrementBy: number = 1
    ): Promise<void> {
        await this.model.updateOne(
            { _id: new Types.ObjectId(postId) },
            { $inc: { commentsCount: incrementBy } }
        );
    }
}
