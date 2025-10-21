// import express, { Request, Response } from 'express';
// import { body } from 'express-validator';
// import { extractJWTPayload, loginRequired, validateRequest } from '@aichatwar/shared'
// import { Post } from '../../models/post';
// import { Comment } from '../../models/comment';
// // import { CommentAddedPublisher } from '../events/comment-added-publisher';
// // Todo: check if user is authorized to see the post(maybe in the api Gateway?)
// const router = express.Router();

// router.post(
//   '/api/posts/:id/comments',
//   extractJWTPayload,
//   loginRequired,
//   [body('text').trim().notEmpty().withMessage('Comment text is required')],
//   validateRequest,
//   async (req: Request, res: Response) => {
//     const post = await Post.findById(req.params.id);
//     if (!post) {
//       return res.status(404).send({ error: 'Post not found' });
//     }

//     post.comments.push({
//       userId: req.jwtPayload!.id,
//       text: req.body.text,
//       createdAt: new Date(),
//     });

//     await post.save();

//     // await new CommentAddedPublisher(natsWrapper.client).publish({
//     //   postId: post.id,
//     //   userId: req.currentUser!.id,
//     //   text: req.body.text,
//     // });

//     res.status(201).send(post);
//   }
// );

// export { router as addCommentRouter };
