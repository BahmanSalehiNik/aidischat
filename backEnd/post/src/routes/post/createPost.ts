// routes/create-post.ts
import express, { Request, Response } from 'express';
import { extractJWTPayload, loginRequired, validateRequest, Visibility } from '@aichatwar/shared';
import { PostCreatedPublisher } from '../../events/publishers/postPublisher';
import { Post } from '../../models/post';
import { User } from '../../models/user/user';
import { kafkaWrapper } from '../../kafka-client';
import { body } from 'express-validator';
import { getPostMedia } from '../../utils/mediaLookup';

const router = express.Router();

router.post('/api/post', 
  extractJWTPayload, 
  loginRequired,
    [
      body('content').optional().isString().isLength({ min: 1 }).withMessage('Text must be valid'),
      body('mediaIds').optional().isArray().withMessage('MediaIds must be an array of strings'),
      body('visibility').optional().isIn([Visibility.Friends, Visibility.Private, Visibility.Public]),
    ],
    validateRequest, 
  async (req: Request, res: Response) => {
  const { id, content, mediaIds, visibility, version } = req.body;

  // Determine author type (agent vs human) from Post service User projection
  const author = await User.findById(req.jwtPayload!.id).select('isAgent').lean();
  const authorIsAgent = author?.isAgent ?? false;

  const post = await Post.build({
    id: id,
    userId: req.jwtPayload!.id,
    authorIsAgent,
    content,
    mediaIds,
    visibility,
    version
  });

  // Get media from cache and store in document
  let validMedia = await getPostMedia(post, {
    checkDocument: false, // Will check after save
    updateDocument: false,
  });

  // Store media in post document if found
  if (validMedia && validMedia.length > 0) {
    post.media = validMedia;
  }

  await post.save();

  // If we have mediaIds but no valid media, check document after save and retry cache
  if (post.mediaIds && post.mediaIds.length > 0 && (!validMedia || validMedia.length === 0)) {
    validMedia = await getPostMedia(post, {
      checkDocument: true, // Check document after save
      updateDocument: true, // Update document if found on retry
    });
    
    // If we found media on retry, update the post document and save again
    if (validMedia && validMedia.length > 0) {
      const savedPost = await Post.findById(post.id);
      if (savedPost) {
        savedPost.media = validMedia;
        await savedPost.save();
        // Update the local post object for response
        post.media = validMedia;
      }
    }
  }

  console.log('Post media to publish:', validMedia);
  console.log('Post mediaIds:', post.mediaIds);

  await new PostCreatedPublisher(kafkaWrapper.producer).publish({
    id: post.id,
    userId: post.userId,
    authorIsAgent: post.authorIsAgent,
    content: post.content,
    mediaIds: post.mediaIds,
    media: validMedia,
    visibility: post.visibility,
    createdAt: post.createdAt.toISOString(),
    version: post.version
  })
  
  // Include media in response so client has it immediately
  const postResponse: any = post.toJSON();
  if (validMedia) {
    postResponse.media = validMedia;
  }
  
  res.status(201).send(postResponse);
});

export { router as createPostRouter };
