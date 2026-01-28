// src/modules/draft-handler/listeners/agentFeedAnswerReceivedListener.ts
import { Listener, Subjects, AgentFeedAnswerReceivedEvent, EachMessagePayload } from '@aichatwar/shared';
import { draftHandler } from '../draftHandler';
import { AgentDraftPostCreatedPublisher, AgentDraftCommentCreatedPublisher, AgentDraftReactionCreatedPublisher, AgentDraftConnectionRequestCreatedPublisher } from '../../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../../kafka-client';
import { v4 as uuidv4 } from 'uuid';
import { Visibility } from '@aichatwar/shared';
import { importImageFromUrl } from '../../../utils/mediaServiceClient';
import { AgentDraftPost } from '../../../models/agent-draft-post';

export class AgentFeedAnswerReceivedListener extends Listener<AgentFeedAnswerReceivedEvent> {
  readonly topic = Subjects.AgentFeedAnswerReceived;
  readonly groupId = 'agent-manager-agent-feed-answer-received';
  protected fromBeginning: boolean = true;

  async onMessage(data: AgentFeedAnswerReceivedEvent['data'], msg: EachMessagePayload): Promise<void> {
    const { agentId, ownerUserId, scanId, correlationId, response, metadata, timestamp } = data;

    console.log(`[AgentFeedAnswerReceivedListener] Received feed answer for agent ${agentId} (scanId: ${scanId})`);

    try {
      const createdDrafts: Array<{ type: string; draftId: string }> = [];
      const shortSeed = (input: string): string => {
        // Non-crypto, stable-ish seed for cache-busting and lightweight randomization.
        let h = 2166136261;
        for (let i = 0; i < input.length; i++) {
          h ^= input.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return (h >>> 0).toString(36);
      };

      // Used to avoid immediately reusing the exact same external URL (Wikimedia/fallback) across drafts.
      // Best-effort: older drafts won't have this metadata yet.
      const recentlyUsedImageSourceUrls = new Set<string>();
      try {
        const recentDrafts = await AgentDraftPost.find({ agentId, ownerUserId })
          .sort({ createdAt: -1 })
          .limit(30)
          .lean();
        for (const d of recentDrafts as any[]) {
          const u = d?.metadata?.image?.sourceUrl;
          if (typeof u === 'string' && u.startsWith('https://')) recentlyUsedImageSourceUrls.add(u);
        }
      } catch (e: any) {
        console.warn(`[AgentFeedAnswerReceivedListener] Failed to load recent drafts for image de-dupe (scanId ${scanId}):`, e?.message);
      }

      const isLikelyRasterImageUrl = (url: string): boolean => {
        try {
          const u = new URL(url);
          if (u.protocol !== 'https:') return false;
          // Allow known template endpoints that redirect to a real JPEG (no file extension in the template URL)
          if (u.host === 'loremflickr.com') return true;
          const path = u.pathname.toLowerCase();
          return (
            path.endsWith('.jpg') ||
            path.endsWith('.jpeg') ||
            path.endsWith('.png') ||
            path.endsWith('.webp') ||
            path.endsWith('.gif')
          );
        } catch {
          return false;
        }
      };

      /**
       * Wikimedia often returns very large "original" files which are slow to load on mobile
       * and may exceed our internal import size cap. Convert commons originals into 1024px thumbnails.
       * Example:
       *  https://upload.wikimedia.org/wikipedia/commons/3/3f/Foo.jpg
       *  -> https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Foo.jpg/1024px-Foo.jpg
       */
      const normalizeWebImageUrl = (url: string): string => {
        try {
          const u = new URL(url);
          if (u.protocol !== 'https:') return url;
          if (u.host !== 'upload.wikimedia.org') return url;
          const p = u.pathname;
          // If already a thumb URL, keep it.
          if (p.includes('/wikipedia/commons/thumb/')) return url;
          // Only handle commons originals.
          const prefix = '/wikipedia/commons/';
          if (!p.startsWith(prefix)) return url;

          const rest = p.slice(prefix.length); // e.g. "3/3f/Foo.jpg"
          const parts = rest.split('/').filter(Boolean);
          if (parts.length < 3) return url;
          const filename = parts[parts.length - 1];
          const dir1 = parts[0];
          const dir2 = parts[1];
          const width = 1024;
          const thumbPath = `/wikipedia/commons/thumb/${dir1}/${dir2}/${filename}/${width}px-${filename}`;
          u.pathname = thumbPath;
          u.search = ''; // drop any query params
          return u.toString();
        } catch {
          return url;
        }
      };

      const buildWebImageFallbackUrl = (text: string, seed?: string): string => {
        const raw = (text || '').toLowerCase();
        const words = raw.match(/\b[a-z0-9]{4,}\b/g) || [];
        const stop = new Set(['this', 'that', 'with', 'from', 'have', 'your', 'just', 'like', 'love', 'post', 'draft']);
        const keywords: string[] = [];
        for (const w of words) {
          if (stop.has(w)) continue;
          if (!keywords.includes(w)) keywords.push(w);
          if (keywords.length >= 4) break;
        }
        const q = keywords.length > 0 ? keywords.join(',') : 'photo';
        // loremflickr supports comma-separated keywords in the path and reliably returns an image via redirect.
        // Add cache-busting so back-to-back imports don't accidentally return the same cached image.
        const cacheBust = seed ? shortSeed(seed) : shortSeed(`${Date.now()}-${Math.random()}`);
        return `https://loremflickr.com/1024/768/${encodeURIComponent(q)}?random=${encodeURIComponent(cacheBust)}`;
      };

      const deriveKeywordsFromText = (text: string): string => {
        const raw = (text || '').toLowerCase();
        const words = raw.match(/\b[a-z0-9]{4,}\b/g) || [];
        const stop = new Set([
          'this','that','with','from','have','your','just','like','love','post','draft','when','what','about','into','they','them',
          'been','were','will','would','could','should','make','made','more','most','very','also','here','there'
        ]);
        const keywords: string[] = [];
        for (const w of words) {
          if (stop.has(w)) continue;
          if (!keywords.includes(w)) keywords.push(w);
          if (keywords.length >= 6) break;
        }
        return keywords.join(',');
      };

      const normalizeImageSearchQuery = (query: string, contentHint: string): string => {
        const raw = (query || '').toLowerCase();
        const tokens = raw
          .split(/[,\s]+/g)
          .map((t) => t.trim())
          .filter(Boolean)
          .flatMap((t) => t.split('-').filter(Boolean)); // sports-car -> sports, car

        const blacklist = new Set([
          'highway','road','street','st','ave','avenue','drive','dr','route','lane','freeway','motorway','intersection',
          'pdf','document','report','administration',
        ]);

        const kept: string[] = [];
        for (const t of tokens) {
          if (blacklist.has(t)) continue;
          if (!kept.includes(t)) kept.push(t);
          if (kept.length >= 6) break;
        }

        // If query becomes too generic, augment with keywords derived from content.
        if (kept.length < 2) {
          const derived = deriveKeywordsFromText(contentHint || '');
          for (const t of derived.split(',').map(s => s.trim()).filter(Boolean)) {
            if (blacklist.has(t)) continue;
            if (!kept.includes(t)) kept.push(t);
            if (kept.length >= 6) break;
          }
        }

        return kept.join(' ');
      };

      const searchWikimediaCommonsThumbUrls = async (query: string): Promise<string[]> => {
        const q = (query || '').trim();
        if (!q) return [];

        // Wikimedia Commons search for files (namespace 6) + return a 1024px thumb URL when possible.
        const url =
          `https://commons.wikimedia.org/w/api.php` +
          `?action=query` +
          `&generator=search` +
          `&gsrnamespace=6` +
          `&gsrsearch=${encodeURIComponent(q)}` +
          `&gsrlimit=50` +
          `&prop=imageinfo` +
          `&iiprop=url|mime` +
          `&iiurlwidth=512` +
          `&format=json`;

        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'aichatwar-agent-manager/1.0 (image search)',
            'Accept': 'application/json',
          },
        });
        if (!resp.ok) return [];
        const data: any = await resp.json().catch(() => null);
        const pages = data?.query?.pages;
        if (!pages || typeof pages !== 'object') return [];

        const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        const out: string[] = [];
        for (const key of Object.keys(pages)) {
          const page = pages[key];
          const info = page?.imageinfo?.[0];
          const mime = String(info?.mime || '').toLowerCase();
          if (!allowedMimes.has(mime)) continue;
          const thumburl = info?.thumburl;
          const originalUrl = info?.url;
          const candidate = typeof thumburl === 'string' ? thumburl : typeof originalUrl === 'string' ? originalUrl : undefined;
          if (candidate && candidate.startsWith('https://')) out.push(candidate);
        }
        return out;
      };

      // Process posts
      if (response.posts && Array.isArray(response.posts)) {
        for (const post of response.posts) {
          try {
            // v2: prefer keywords-based image search query
            const imageSearchQuery =
              typeof (post as any).imageSearchQuery === 'string' ? String((post as any).imageSearchQuery) : '';

            // v1 fallback: accept explicit URLs if present (older models / older prompt)
            const sourceImageUrls: string[] =
              post.mediaUrls && Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 ? post.mediaUrls : [];

            // Convert public image URL(s) into Media IDs in media service (uploaded to storage + registered)
            const mediaIds: string[] = [];
            const mediaUrlsForEvent: string[] = [];
            let chosenImage: { source: 'model_url' | 'wikimedia' | 'loremflickr' | 'external_url'; query?: string; sourceUrl?: string } | undefined;

            // Only take 1 for now to keep drafts lightweight
            const firstUrl = sourceImageUrls[0] ? normalizeWebImageUrl(sourceImageUrls[0]) : undefined;

            // If the model didn't provide a URL, use Wikimedia search based on keywords.
            let searchedUrl: string | undefined;
            let searchedQueryUsed: string | undefined;
            if (!firstUrl) {
              const candidates: string[] = [];
              const normalizedFromModel = imageSearchQuery.trim()
                ? normalizeImageSearchQuery(imageSearchQuery, String(post.content || ''))
                : '';
              const derived = normalizeImageSearchQuery(deriveKeywordsFromText(String(post.content || '')), String(post.content || ''));
              if (normalizedFromModel) candidates.push(normalizedFromModel);
              if (derived && !candidates.includes(derived)) candidates.push(derived);
              // Broaden to increase Wikimedia hit-rate (Commons often doesn't have brand-specific items).
              for (const base of [...candidates]) {
                const toks = base.split(/\s+/).filter(Boolean);
                const last2 = toks.slice(-2).join(' ');
                const last1 = toks.slice(-1).join(' ');
                if (last2 && !candidates.includes(last2)) candidates.push(last2);
                if (last1 && !candidates.includes(last1)) candidates.push(last1);
              }

              console.log(`[AgentFeedAnswerReceivedListener] Wikimedia query candidates for scanId ${scanId}:`, {
                providedByModel: imageSearchQuery.trim() ? imageSearchQuery.trim() : undefined,
                candidates,
              });

              for (const q of candidates) {
                const urls = await searchWikimediaCommonsThumbUrls(q);
                // Deterministic shuffle based on scanId+query so different posts don't always pick the first result.
                const seed = shortSeed(`${scanId}:${q}`);
                const shuffled = [...urls].sort((a, b) => shortSeed(seed + a).localeCompare(shortSeed(seed + b)));
                const picked = shuffled.find((u) => !recentlyUsedImageSourceUrls.has(u)) || shuffled[0];

                console.log(`[AgentFeedAnswerReceivedListener] Wikimedia search attempt for scanId ${scanId}:`, {
                  query: q,
                  found: !!picked,
                  urlHost: picked ? new URL(picked).host : undefined,
                  // Show enough to debug without giant logs
                  urlSample: picked ? `${picked.slice(0, 96)}...` : undefined,
                  results: urls.length,
                });

                if (picked) {
                  searchedUrl = picked;
                  searchedQueryUsed = q;
                  break;
                }
              }
            }

            const primaryUrl = firstUrl || searchedUrl;

            if (!primaryUrl) {
              // If we couldn't find any image via URL or Wikimedia search, use a deterministic fallback
              // so drafts don't end up with "No image attached".
              const fallbackUrl = buildWebImageFallbackUrl(post.content || '', `${scanId}:${post.content || ''}`);
              console.warn(`[AgentFeedAnswerReceivedListener] No image URL found (scanId ${scanId}); importing fallback: ${fallbackUrl}`);
              chosenImage = { source: 'loremflickr', sourceUrl: fallbackUrl, query: deriveKeywordsFromText(String(post.content || '')) || undefined };
              try {
                const importedFallback = await importImageFromUrl({
                  userId: ownerUserId,
                  agentId,
                  sourceUrl: fallbackUrl,
                  container: 'posts',
                  expiresSeconds: 7200,
                });
                mediaIds.push(importedFallback.id);
                if (importedFallback.downloadUrl) mediaUrlsForEvent.push(importedFallback.downloadUrl);
                else if (importedFallback.url) mediaUrlsForEvent.push(importedFallback.url);
              } catch (fallbackError: any) {
                console.error(`[AgentFeedAnswerReceivedListener] Fallback import failed (${fallbackUrl}) scanId ${scanId}:`, fallbackError.message);
                // Last resort: keep external URL if safe
                if (isLikelyRasterImageUrl(fallbackUrl)) {
                  chosenImage = { source: 'external_url', sourceUrl: fallbackUrl, query: undefined };
                  mediaUrlsForEvent.push(fallbackUrl);
                }
              }
            } else if (primaryUrl) {
              chosenImage = firstUrl
                ? { source: 'model_url', sourceUrl: firstUrl, query: imageSearchQuery.trim() || undefined }
                : { source: 'wikimedia', sourceUrl: searchedUrl, query: searchedQueryUsed || imageSearchQuery.trim() || undefined };
              try {
                const imported = await importImageFromUrl({
                  userId: ownerUserId, // owner can review/delete
                  agentId,
                  sourceUrl: primaryUrl,
                  container: 'posts',
                  // Longer-lived preview URL for events/logs; the UI will re-hydrate signed URLs on fetch anyway.
                  expiresSeconds: 7200,
                });
                mediaIds.push(imported.id);
                if (imported.downloadUrl) mediaUrlsForEvent.push(imported.downloadUrl);
                else if (imported.url) mediaUrlsForEvent.push(imported.url);
              } catch (mediaError: any) {
                // Wikimedia may rate-limit backend downloads (429). In that case, keep the Wikimedia URL as-is
                // (client can load it directly) instead of falling back to random sources.
                const msg = String(mediaError?.message || '');
                const isWikimedia = typeof primaryUrl === 'string' && (() => { try { return new URL(primaryUrl).host === 'upload.wikimedia.org'; } catch { return false; } })();
                if (isWikimedia && msg.includes('429') && isLikelyRasterImageUrl(primaryUrl)) {
                  console.warn(`[AgentFeedAnswerReceivedListener] Wikimedia import rate-limited (429) for ${primaryUrl}; using external URL directly.`);
                  chosenImage = { source: 'external_url', sourceUrl: primaryUrl, query: searchedQueryUsed || imageSearchQuery.trim() || undefined };
                  mediaUrlsForEvent.push(primaryUrl);
                } else {
                console.error(`[AgentFeedAnswerReceivedListener] Error importing media from ${primaryUrl}, trying fallback URL:`, mediaError.message);

                // Try a robust fallback that reliably resolves to an image
                const fallbackUrl = buildWebImageFallbackUrl(post.content || '', `${scanId}:${primaryUrl}:${post.content || ''}`);
                chosenImage = { source: 'loremflickr', sourceUrl: fallbackUrl, query: deriveKeywordsFromText(String(post.content || '')) || undefined };
                try {
                  const importedFallback = await importImageFromUrl({
                    userId: ownerUserId,
                    agentId,
                    sourceUrl: fallbackUrl,
                    container: 'posts',
                    expiresSeconds: 7200,
                  });
                  mediaIds.push(importedFallback.id);
                  if (importedFallback.downloadUrl) mediaUrlsForEvent.push(importedFallback.downloadUrl);
                  else if (importedFallback.url) mediaUrlsForEvent.push(importedFallback.url);
                } catch (fallbackError: any) {
                  // Last resort: keep external URL only if it looks safe
                  console.error(`[AgentFeedAnswerReceivedListener] Fallback import also failed (${fallbackUrl}); using external URL if safe:`, fallbackError.message);
                  if (typeof primaryUrl === 'string' && isLikelyRasterImageUrl(primaryUrl)) {
                    chosenImage = { source: 'external_url', sourceUrl: primaryUrl, query: searchedQueryUsed || imageSearchQuery.trim() || undefined };
                    mediaUrlsForEvent.push(primaryUrl);
                  } else if (typeof fallbackUrl === 'string' && isLikelyRasterImageUrl(fallbackUrl)) {
                    chosenImage = { source: 'external_url', sourceUrl: fallbackUrl, query: undefined };
                    mediaUrlsForEvent.push(fallbackUrl);
                  }
                }
                }
              }
            }

            const draft = await draftHandler.createPostDraft({
              agentId,
              ownerUserId,
              content: post.content,
              mediaIds:
                mediaIds.length > 0
                  ? mediaIds
                  : mediaUrlsForEvent.length > 0
                    ? mediaUrlsForEvent // fallback to URL strings only if we have an explicit AI-provided URL
                    : undefined,
              visibility: (post.visibility as Visibility) || Visibility.Public,
              metadata: ({
                suggestedBy: 'ai_gateway',
                context: `From feed scan ${scanId}`,
                image: chosenImage,
              } as any),
            });

            // Publish draft created event
            await new AgentDraftPostCreatedPublisher(kafkaWrapper.producer).publish({
              draftId: draft.id,
              agentId,
              ownerUserId,
              content: draft.content,
              mediaUrls: mediaUrlsForEvent, // best-effort preview URL(s)
              visibility: draft.visibility,
              status: 'pending',
              expiresAt: draft.expiresAt.toISOString(),
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
                confidence: undefined,
                context: `From feed scan ${scanId}`,
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'post', draftId: draft.id });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created post draft ${draft.id} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating post draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      // Process comments
      if (response.comments && Array.isArray(response.comments)) {
        for (const comment of response.comments) {
          try {
            const draft = await draftHandler.createCommentDraft({
              agentId,
              ownerUserId,
              postId: comment.postId,
              content: comment.content,
              metadata: {
                suggestedBy: 'ai_gateway',
                context: `From feed scan ${scanId}`,
              },
            });

            // Publish draft created event
            await new AgentDraftCommentCreatedPublisher(kafkaWrapper.producer).publish({
              draftId: draft.id,
              agentId,
              ownerUserId,
              postId: draft.postId,
              content: draft.content,
              status: 'pending',
              expiresAt: draft.expiresAt.toISOString(),
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'comment', draftId: draft.id });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created comment draft ${draft.id} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating comment draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      // Process reactions
      if (response.reactions && Array.isArray(response.reactions)) {
        const allowedPostIds = new Set<string>((feedData?.posts || []).map((p: any) => String(p.id)));
        const allowedCommentIds = new Set<string>((feedData?.comments || []).map((c: any) => String(c.id)));

        for (const reaction of response.reactions) {
          try {
            const targetType = reaction.postId ? 'post' : 'comment';
            const targetId = reaction.postId || reaction.commentId;

            if (!targetId) {
              console.warn(`[AgentFeedAnswerReceivedListener] Skipping reaction without postId or commentId`);
              continue;
            }

            // Enforce: reactions can only target entities included in the scanned feedData batch.
            // This prevents cross-post/comment reactions and ensures we only react to human posts/comments.
            if (targetType === 'post') {
              if (!reaction.postId || !allowedPostIds.has(String(reaction.postId))) {
                console.warn(`[AgentFeedAnswerReceivedListener] Skipping reaction targeting postId not in scan batch`, { postId: reaction.postId, scanId });
                continue;
              }
            } else {
              if (!reaction.commentId || !allowedCommentIds.has(String(reaction.commentId))) {
                console.warn(`[AgentFeedAnswerReceivedListener] Skipping reaction targeting commentId not in scan batch`, { commentId: reaction.commentId, scanId });
                continue;
              }
            }

            const draft = await draftHandler.createReactionDraft({
              agentId,
              ownerUserId,
              targetType,
              targetId,
              reactionType: reaction.type,
              metadata: {
                suggestedBy: 'ai_gateway',
                context: `From feed scan ${scanId}`,
              },
            });

            // Publish draft created event
            await new AgentDraftReactionCreatedPublisher(kafkaWrapper.producer).publish({
              draftId: draft.id,
              agentId,
              ownerUserId,
              postId: reaction.postId,
              commentId: reaction.commentId,
              type: draft.reactionType,
              status: 'pending',
              expiresAt: draft.expiresAt.toISOString(),
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'reaction', draftId: draft.id });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created reaction draft ${draft.id} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating reaction draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      // Process connection requests
      if (response.connectionRequests && Array.isArray(response.connectionRequests)) {
        for (const request of response.connectionRequests) {
          try {
            const draftId = uuidv4();
            // TODO: Create AgentDraftConnectionRequest model and handler
            // For now, we'll just publish the event
            // The connection request draft model needs to be created first

            // Publish draft created event
            await new AgentDraftConnectionRequestCreatedPublisher(kafkaWrapper.producer).publish({
              draftId,
              agentId,
              ownerUserId,
              targetUserId: request.userId,
              message: request.message,
              status: 'pending',
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
              metadata: {
                scanId,
                suggestedBy: 'activity_worker', // Note: This should be 'ai_gateway' but event interface uses 'activity_worker'
              },
              timestamp: new Date().toISOString(),
            });

            createdDrafts.push({ type: 'connection_request', draftId });
            console.log(`[AgentFeedAnswerReceivedListener] ✅ Created connection request draft ${draftId} for agent ${agentId}`);
          } catch (error: any) {
            console.error(`[AgentFeedAnswerReceivedListener] ❌ Error creating connection request draft:`, error.message);
            // Continue with other drafts
          }
        }
      }

      console.log(`[AgentFeedAnswerReceivedListener] ✅ Completed processing feed answer for agent ${agentId}: created ${createdDrafts.length} drafts (scanId: ${scanId})`);

      await this.ack();
    } catch (error: any) {
      console.error(`[AgentFeedAnswerReceivedListener] ❌ Error processing feed answer for agent ${agentId}:`, {
        error: error.message,
        stack: error.stack,
        scanId,
      });
      // Don't ack on error - let Kafka retry
      throw error;
    }
  }
}

