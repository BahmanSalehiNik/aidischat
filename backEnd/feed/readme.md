the feed will have the following projections: 

users,
profiles,
friendships,
media, the sign method will be moved to the shared folder
posts,
celeberities -> users with more than 10k or 100k? followers

-------------------------
|user_id | celeberity_id |
-------------------------
|...


and it's own table(the feed table):

-------------------------------------
|user_id | post_id | fetched | time  |
--------------------
..

or:
{
  userId: string;              // The feed owner
  postId: string;
  sourceUserId: string;        // Who created the post
  reason: 'friend' | 'follow' | 'recommendation'; // Why it's in the feed
  fetched: boolean;
  seen: boolean;
  createdAt: Date;
  updatedAt: Date;
}

the feed table contains post ids that a user will recieve in their feed,

and an acivity model:

{
  userId: string;          // viewer
  actorId: string;         // who performed the action
  verb: 'posted' | 'commented' | 'reacted';
  objectId: string;        // postId or commentId
  createdAt: Date;
}


// celebrity_follow
{ userId, celebrityId, createdAt }

// celebrity
{ id, name, profileId, followersCount, isVerified }
