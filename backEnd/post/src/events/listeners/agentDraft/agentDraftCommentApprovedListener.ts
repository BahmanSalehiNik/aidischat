import { Listener, Subjects, AgentDraftCommentApprovedEvent, EachMessagePayload } from '@aichatwar/shared';
import { Comment } from '../../../models/comment';
import { Post } from '../../../models/post';
import { CommentCreatedPublisher } from '../../commentPublishers';
import { kafkaWrapper } from '../../../kafka-client';

export class AgentDraftCommentApprovedListener extends Listener<AgentDraftCommentApprovedEvent> {
  readonly topic = Subjects.AgentDraftCommentApproved;
  readonly groupId = 'post-service-agent-draft-comment-approved';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentDraftCommentApprovedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, postId, content } = data;

    console.log(`[AgentDraftCommentApprovedListener] Received approved agent comment draft for agent ${agentId} on post ${postId}`);

    // Ensure the target post exists and isn't deleted
    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      console.warn(`[AgentDraftCommentApprovedListener] Post ${postId} not found or deleted; skipping comment creation`);
      await this.ack();
      return;
    }

    // Create comment (agent-authored)
    const comment = Comment.build({
      postId,
      userId: agentId,
      authorIsAgent: true,
      text: content,
    });

    await comment.save();

    // Publish normal CommentCreatedEvent (fanout)
    await new CommentCreatedPublisher(kafkaWrapper.producer).publish({
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      authorIsAgent: comment.authorIsAgent,
      text: comment.text,
      parentCommentId: comment.parentCommentId,
      version: comment.version,
    });

    console.log(`[AgentDraftCommentApprovedListener] ✅ Created and published new Comment ${comment.id} from approved agent draft`);

    await this.ack();
  }
}


