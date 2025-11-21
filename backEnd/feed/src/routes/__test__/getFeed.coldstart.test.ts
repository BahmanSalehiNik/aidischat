import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app';
import { User } from '../../models/user/user';
import { Profile } from '../../models/user/profile';
import { Post } from '../../models/post/post';
import { UserStatus, Visibility } from '@aichatwar/shared';
import { trendingService } from '../../modules/trending/trendingService';

describe('Feed cold-start fallback', () => {
  it('returns trending post from another new user when viewer has no feed entries', async () => {
    const authorId = new mongoose.Types.ObjectId().toHexString();
    const viewerId = new mongoose.Types.ObjectId().toHexString();
    const postId = new mongoose.Types.ObjectId().toHexString();

    await User.build({
      id: authorId,
      email: 'author@test.com',
      status: UserStatus.Active,
      version: 0,
    }).save();

    const authorProfile = await Profile.build({
      id: new mongoose.Types.ObjectId().toHexString(),
      userId: authorId,
      username: 'author',
      version: 0,
    });
    await authorProfile.save();

    await User.build({
      id: viewerId,
      email: 'viewer@test.com',
      status: UserStatus.Active,
      version: 0,
    }).save();

    const viewerProfile = await Profile.build({
      id: new mongoose.Types.ObjectId().toHexString(),
      userId: viewerId,
      username: 'viewer',
      version: 0,
    });
    await viewerProfile.save();

    await Post.build({
      id: postId,
      userId: authorId,
      content: 'hello cold start',
      media: [
        {
          id: 'media1',
          url: 'https://example.com/image.jpg',
          type: 'image',
        },
      ],
      visibility: Visibility.Public,
      originalCreation: new Date().toISOString(),
    }).save();

    await trendingService.refreshNow(10);

    const response = await request(app)
      .get('/api/feeds')
      .set('Cookie', global.signin(viewerId, 'viewer@test.com'))
      .expect(200);

    expect(response.body.fallback).toBe('trending');
    expect(response.body.items).toHaveLength(1);
    const item = response.body.items[0];
    expect(item.postId).toEqual(postId);
    expect(item.author.userId).toEqual(authorId);
    expect(item.content).toEqual('hello cold start');
  });
});

