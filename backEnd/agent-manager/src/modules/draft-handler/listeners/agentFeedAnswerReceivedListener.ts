// src/modules/draft-handler/listeners/agentFeedAnswerReceivedListener.ts
import { Listener, Subjects, AgentFeedAnswerReceivedEvent, EachMessagePayload } from '@aichatwar/shared';
import { draftHandler } from '../draftHandler';
import { AgentDraftPostCreatedPublisher, AgentDraftCommentCreatedPublisher, AgentDraftReactionCreatedPublisher, AgentDraftConnectionRequestCreatedPublisher } from '../../../events/publishers/agentManagerPublishers';
import { kafkaWrapper } from '../../../kafka-client';
import { v4 as uuidv4 } from 'uuid';
import { Visibility } from '@aichatwar/shared';
import { AgentDraftPost } from '../../../models/agent-draft-post';
import { importImageFromUrl } from '../../../utils/mediaServiceClient';

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
      const isLikelyRasterImageUrl = (url: string): boolean => {
        try {
          const u = new URL(url);
          if (u.protocol !== 'https:') return false;
          // Allow known template endpoints that redirect to a real JPEG (no file extension in the template URL)
          if (u.host === 'loremflickr.com') return true;
          if (u.host === 'picsum.photos') return true;
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

      const searchOpenverseImageUrls = async (query: string): Promise<string[]> => {
        const q = (query || '').trim();
        if (!q) return [];
        // Openverse: free, no API key required for basic usage.
        // We still validate URLs before using them.
        const url =
          `https://api.openverse.engineering/v1/images` +
          `?q=${encodeURIComponent(q)}` +
          `&page_size=20` +
          `&mature=false`;

        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'aichatwar-agent-manager/1.0 (openverse image search)',
            'Accept': 'application/json',
          },
        });
        if (!resp.ok) return [];
        const data: any = await resp.json().catch(() => null);
        const results: any[] = Array.isArray(data?.results) ? data.results : [];

        const out: string[] = [];
        for (const r of results) {
          // Prefer direct image URLs when provided, else fall back to thumbnail.
          // Openverse fields may vary; we keep this defensive.
          const candidates = [
            r?.url,
            r?.thumbnail,
            r?.thumbnail_url,
            r?.image,
            r?.image_url,
          ]
            .filter((x: any) => typeof x === 'string')
            .map((s: string) => s.trim())
            .filter(Boolean);
          for (const c of candidates) {
            if (c.startsWith('https://')) out.push(c);
          }
        }
        return out;
      };

      type OpenverseCandidate = { url: string; title?: string; tags?: string[]; provider?: string; source?: string };

      const tokenize = (input: string): string[] => {
        const s = (input || '')
          .toLowerCase()
          .replace(/[,/]+/g, ' ')
          .replace(/[^a-z0-9\s-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!s) return [];
        const stop = new Set([
          'the', 'and', 'or', 'a', 'an', 'to', 'of', 'for', 'with', 'on', 'in', 'at', 'by', 'is', 'are',
          'this', 'that', 'it', 'my', 'your', 'our', 'their', 'from', 'as', 'be', 'been', 'was', 'were',
          'looks', 'look', 'great', 'new', 'just', 'recently', 'anyone', 'tried',
        ]);
        return s
          .split(' ')
          .map((t) => t.trim())
          .filter(Boolean)
          .filter((t) => t.length >= 3)
          .filter((t) => !stop.has(t));
      };

      const scoreCandidate = (cand: OpenverseCandidate, tokens: string[]): number => {
        if (!cand?.url) return 0;
        const title = (cand.title || '').toLowerCase();
        const tags = Array.isArray(cand.tags) ? cand.tags : [];
        const tagStr = tags.join(' ').toLowerCase();
        let score = 0;
        for (const tok of tokens) {
          if (!tok) continue;
          if (title.includes(tok)) score += 3;
          if (tagStr.includes(tok)) score += 2;
          if (cand.url.toLowerCase().includes(tok)) score += 1;
        }
        return score;
      };

      const searchOpenverseCandidates = async (query: string): Promise<OpenverseCandidate[]> => {
        const q = (query || '').trim();
        if (!q) return [];
        const url =
          `https://api.openverse.engineering/v1/images` +
          `?q=${encodeURIComponent(q)}` +
          `&page_size=30` +
          `&mature=false`;
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'aichatwar-agent-manager/1.0 (openverse image search)',
            'Accept': 'application/json',
          },
        });
        if (!resp.ok) return [];
        const data: any = await resp.json().catch(() => null);
        const results: any[] = Array.isArray(data?.results) ? data.results : [];
        const out: OpenverseCandidate[] = [];
        for (const r of results) {
          const tags = Array.isArray(r?.tags)
            ? r.tags.map((t: any) => (typeof t?.name === 'string' ? t.name : '')).filter(Boolean)
            : undefined;
          const title = typeof r?.title === 'string' ? r.title : undefined;
          const provider = typeof r?.provider === 'string' ? r.provider : undefined;
          const source = typeof r?.source === 'string' ? r.source : undefined;

          const candidates = [
            r?.thumbnail, // often a resolvable image endpoint
            r?.thumbnail_url,
            r?.url, // sometimes direct image (flickr static), sometimes page url
            r?.image,
            r?.image_url,
          ]
            .filter((x: any) => typeof x === 'string')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .filter((c: string) => c.startsWith('https://'));

          for (const c of candidates) {
            out.push({ url: c, title, tags, provider, source });
          }
        }
        return out;
      };

      const searchWikimediaCommonsImageUrls = async (query: string): Promise<string[]> => {
        const q = (query || '').trim();
        if (!q) return [];

        // Search only in File namespace (6) to get media.
        const searchUrl =
          `https://commons.wikimedia.org/w/api.php` +
          `?action=query&format=json&origin=*` +
          `&list=search&srnamespace=6&srlimit=12` +
          `&srsearch=${encodeURIComponent(q)}`;

        const sresp = await fetch(searchUrl, {
          headers: { 'User-Agent': 'aichatwar-agent-manager/1.0 (wikimedia commons search)', 'Accept': 'application/json' },
        });
        if (!sresp.ok) return [];
        const sdata: any = await sresp.json().catch(() => null);
        const hits: any[] = Array.isArray(sdata?.query?.search) ? sdata.query.search : [];
        const titles: string[] = hits
          .map((h: any) => (typeof h?.title === 'string' ? h.title : ''))
          .filter(Boolean)
          .slice(0, 8);
        if (titles.length === 0) return [];

        // Resolve titles to imageinfo URLs.
        const infoUrl =
          `https://commons.wikimedia.org/w/api.php` +
          `?action=query&format=json&origin=*` +
          `&prop=imageinfo&iiprop=url|mime` +
          `&iiurlwidth=1024` +
          `&titles=${encodeURIComponent(titles.join('|'))}`;

        const iresp = await fetch(infoUrl, {
          headers: { 'User-Agent': 'aichatwar-agent-manager/1.0 (wikimedia commons imageinfo)', 'Accept': 'application/json' },
        });
        if (!iresp.ok) return [];
        const idata: any = await iresp.json().catch(() => null);
        const pages = idata?.query?.pages || {};
        const out: string[] = [];
        for (const key of Object.keys(pages)) {
          const p = pages[key];
          const ii = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
          const mime = String(ii?.mime || '').toLowerCase();
          const url = (ii?.thumburl || ii?.url) as any;
          if (typeof url !== 'string' || !url.startsWith('https://')) continue;
          if (!mime.startsWith('image/')) continue;
          // Avoid SVG (import endpoint rejects it by design)
          if (mime.includes('svg')) continue;
          out.push(url);
        }
        return out;
      };

      const isReachableImageUrl = async (url: string): Promise<boolean> => {
        try {
          if (!url || typeof url !== 'string') return false;
          const u = new URL(url);
          if (u.protocol !== 'https:') return false;
          // Prefer HEAD (no download). Some hosts disallow HEAD; fall back to a tiny GET.
          const head = await fetch(url, { method: 'HEAD', redirect: 'follow' as any });
          if (head.ok) {
            const ct = String(head.headers.get('content-type') || '').toLowerCase();
            if (ct.startsWith('image/')) return true;
            // Some CDNs omit content-type on HEAD; allow ok status as best-effort.
            if (!ct) return true;
          }
          // Fallback: request 1 byte
          const get = await fetch(url, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
            redirect: 'follow' as any,
          });
          if (!get.ok) return false;
          const ct = String(get.headers.get('content-type') || '').toLowerCase();
          return ct.startsWith('image/');
        } catch {
          return false;
        }
      };

      const normalizeWebImageUrl = (url: string): string => {
        // Keep normalization lightweight; do NOT download or import images.
        try {
          const u = new URL(url);
          if (u.protocol !== 'https:') return url;
          // Drop query params for stability (best-effort)
          // NOTE: some CDNs require query params; we only strip for Wikimedia originals.
          if (u.host === 'upload.wikimedia.org') {
            u.search = '';
            return u.toString();
          }
          return url;
        } catch {
          return url;
        }
      };

      // Process posts
      if (response.posts && Array.isArray(response.posts)) {
        for (const post of response.posts) {
          try {
            // v2: prefer keywords-based imageSearchQuery from AI gateway
            const imageSearchQuery =
              typeof (post as any).imageSearchQuery === 'string' ? String((post as any).imageSearchQuery) : '';

            // v1 fallback: accept explicit URLs if present (older models)
            const sourceImageUrls: string[] =
              post.mediaUrls && Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 ? post.mediaUrls : [];

            // Candidate URL directly from older model output
            const legacyUrlCandidate = normalizeWebImageUrl(sourceImageUrls[0] || '');
            const mediaUrlsForEvent: string[] = [];
            const mediaIds: string[] = [];
            let chosenImage: { source: 'model_url' | 'external_url'; sourceUrl?: string } | undefined;

            let finalUrl: string | undefined;
            let pickedFrom: 'legacy_url' | 'openverse' | 'wikimedia' | 'picsum' | undefined;
            if (legacyUrlCandidate && legacyUrlCandidate.startsWith('https://')) {
              const reachable = await isReachableImageUrl(legacyUrlCandidate);
              if (reachable) {
                finalUrl = legacyUrlCandidate;
                pickedFrom = 'legacy_url';
              } else {
                console.warn(`[AgentFeedAnswerReceivedListener] Image URL not reachable (scanId ${scanId}); falling back`, {
                  url: legacyUrlCandidate.slice(0, 120),
                });
              }
            }

            // Main path: use Openverse search on the model-provided query.
            if (!finalUrl) {
              const q0 = imageSearchQuery.trim();
              const tokens0 = tokenize(q0);
              const tokensFromContent = tokenize(String(post.content || '')).slice(0, 6);
              const attemptQueries: string[] = [];
              if (q0) attemptQueries.push(q0.replace(/,/g, ' '));
              if (tokens0.length > 0) attemptQueries.push(tokens0.join(' '));
              if (tokensFromContent.length > 0) attemptQueries.push(tokensFromContent.join(' '));
              // Generic last attempt before switching providers
              attemptQueries.push('skincare product');

              const scored: Array<{ url: string; score: number; title?: string; tags?: string[] }> = [];
              for (const aq of attemptQueries) {
                if (!aq) continue;
                console.log(`[AgentFeedAnswerReceivedListener] Openverse search (scanId ${scanId}):`, { query: aq });
                const candidates = await searchOpenverseCandidates(aq);
                const tokens = tokenize(aq);
                for (const c of candidates) {
                  const candidate = normalizeWebImageUrl(c.url);
                  if (!candidate.startsWith('https://')) continue;
                  if (!isLikelyRasterImageUrl(candidate)) continue;
                  // Relevance filter: require at least 2 token hits across title/tags/url to avoid random postcards, etc.
                  const s = scoreCandidate({ ...c, url: candidate }, tokens);
                  if (s < 4) continue;
                  scored.push({ url: candidate, score: s, title: c.title, tags: c.tags });
                }
                // If we already have strong candidates, stop expanding.
                if (scored.length >= 8) break;
              }

              scored.sort((a, b) => b.score - a.score);
              for (const pick of scored.slice(0, 12)) {
                const ok = await isReachableImageUrl(pick.url);
                if (ok) {
                  finalUrl = pick.url;
                  pickedFrom = 'openverse';
                  console.log(`[AgentFeedAnswerReceivedListener] Openverse picked image (scanId ${scanId}):`, {
                    url: pick.url.slice(0, 140),
                    score: pick.score,
                    title: pick.title,
                  });
                  break;
                }
              }
            }

            if (!finalUrl) {
              // Wikimedia Commons fallback (more likely to be semantically relevant than random picsum).
              const qW = imageSearchQuery?.trim() || String(post.content || '').slice(0, 120);
              console.log(`[AgentFeedAnswerReceivedListener] Wikimedia fallback search (scanId ${scanId}):`, { query: qW });
              const urls = await searchWikimediaCommonsImageUrls(qW);
              for (const u of urls) {
                const candidate = normalizeWebImageUrl(u);
                if (!candidate.startsWith('https://')) continue;
                if (!isLikelyRasterImageUrl(candidate)) continue;
                const ok = await isReachableImageUrl(candidate);
                if (ok) {
                  finalUrl = candidate;
                  pickedFrom = 'wikimedia';
                  console.log(`[AgentFeedAnswerReceivedListener] Wikimedia picked image (scanId ${scanId}):`, { url: candidate.slice(0, 140) });
                  break;
                }
              }
            }

            if (!finalUrl) {
              // Last resort fallback: stable public image URL that always resolves (may be irrelevant).
              finalUrl = `https://picsum.photos/seed/${encodeURIComponent(`${scanId}:${post.content || ''}`)}/1024/768`;
              pickedFrom = 'picsum';
            }

            // Import the chosen public URL into our storage (Azure) via media service.
            // This gives us a stable mediaId and allows returning signed SAS URLs to clients.
            try {
              const imported = await importImageFromUrl({
                userId: ownerUserId,
                agentId,
                sourceUrl: finalUrl,
                container: 'posts',
                expiresSeconds: 7200,
              });
              mediaIds.push(imported.id);
              if (imported.downloadUrl) mediaUrlsForEvent.push(imported.downloadUrl);
              else if (imported.url) mediaUrlsForEvent.push(imported.url);
              chosenImage = {
                source: (pickedFrom || 'openverse') as any,
                sourceUrl: finalUrl,
                storedMediaId: imported.id,
                storedUrl: imported.url,
              } as any;
            } catch (err: any) {
              // If import fails, fall back to external URL (best-effort).
              console.warn(`[AgentFeedAnswerReceivedListener] Failed to import image into storage (scanId ${scanId}); using external URL`, {
                error: err?.message,
                url: finalUrl?.slice(0, 140),
              });
              chosenImage = { source: (pickedFrom || 'external_url') as any, sourceUrl: finalUrl } as any;
              mediaUrlsForEvent.push(finalUrl);
            }

            const draft = await draftHandler.createPostDraft({
              agentId,
              ownerUserId,
              content: post.content,
              // Store media IDs when available (preferred). If import failed, store URL for backward compatibility.
              mediaIds:
                mediaIds.length > 0
                  ? mediaIds
                  : mediaUrlsForEvent.length > 0
                    ? mediaUrlsForEvent
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
        for (const reaction of response.reactions) {
          try {
            const targetType = reaction.postId ? 'post' : 'comment';
            const targetId = reaction.postId || reaction.commentId;

            if (!targetId) {
              console.warn(`[AgentFeedAnswerReceivedListener] Skipping reaction without postId or commentId`);
              continue;
            }

            // NOTE:
            // We can't validate that the reaction target is part of the original scan batch here because
            // AgentFeedAnswerReceivedEvent does not include feedData. If we want strict enforcement,
            // we should persist scan feedData keyed by scanId in AgentFeedScannedListener and load it here.

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

