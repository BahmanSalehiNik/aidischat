# Agent Draft Fixes (Incremental)

You will test after each step. I’ll only proceed to the next step once you confirm the previous step works.

## Step 1 — Make AI drafts image-aware (use signed image URLs as multimodal inputs) ✅ implemented

### Problem
Drafts are often irrelevant to posts that include images because the AI request was **text-only**; the model could not actually “see” images (it only saw image URLs inside JSON).

### Fix
- Add `imageUrls?: string[]` to the AI provider request.
- For **OpenAI**, send those URLs as multimodal `image_url` parts (Chat Completions + Assistants thread messages).
- In `aiGateway` feed scan processing, extract **signed** media URLs from the scanned posts and pass them to the provider via `imageUrls`.
- Tighten the prompt so generated drafts/comments must reference **post text + multiple concrete visual details**, and avoid hallucinations.
- Require that every generated **new post draft** includes **exactly 1 web image URL** (direct `https://` image file URL; not AI-generated; not a webpage link) to avoid “No image attached”.
- **Option A (recommended) now implemented**: instead of the model returning image URLs, it returns **`imageSearchQuery`** keywords; backend searches Wikimedia Commons, imports the found image to Azure, and returns a signed URL to the client.
- Remove the backend fallback that forced a random stock image when the AI didn’t provide a media URL (this was making drafts look irrelevant).

### Code changed
- `backEnd/ai/aiGateway/src/providers/base-provider.ts`
- `backEnd/ai/aiGateway/src/providers/openai-provider.ts`
- `backEnd/ai/aiGateway/src/events/listeners/agent-feed-scanned-listener.ts`
- `backEnd/agent-manager/src/modules/draft-handler/listeners/agentFeedAnswerReceivedListener.ts`
- `backEnd/agent-manager/src/modules/draft-handler/listeners/agentFeedAnswerReceivedListener.ts` (Wikimedia Commons image search + import)

### How to test
- Create/publish a post with a very distinctive image (obvious objects/text/colors).
- Ensure the agent is **Active**, and the model configured is **vision-capable** (OpenAI examples: `gpt-4o-mini`, `gpt-4o`).
- Wait for the agent to scan the feed and create drafts.
- Expected:
  - The draft/comment explicitly references **specific visual details** from the image (not generic filler).
  - If the image is inaccessible (bad signature), logs should show an image fetch failure and the output should mention it.

### Notes / guardrails
- We cap image inputs to **8 unique URLs** per scan to avoid huge requests.
- Non-vision providers will ignore `imageUrls` (we’ll handle them later if needed).
- Draft posts may now legitimately have **no image** if the model doesn’t provide a relevant `mediaUrls`.

---

## Step 2 — Drafts list updates without reloading ✅ implemented

### Goal
When a new draft is created, the drafts screen should update automatically (no manual reload).

### Fix
- While `AgentDraftsScreen` is focused, poll drafts every ~6s (silent refresh) so newly created drafts appear.

### Code changed
- `client/mobile-app/app/(main)/AgentDraftsScreen.tsx`

### How to test
- Open the Drafts screen for an agent and keep it open.
- Trigger draft creation (publish a post / wait for feed scan).
- Expected: within ~6 seconds the new draft appears without you reloading the screen.

---

## Step 3 — Approving a draft publishes it (pending)

### Goal
Approving a **post** draft should create a normal post in the feed (like a normal post).

---

## Step 4 — Revise applies and updates status/content (pending)

### Goal
Submitting revise feedback should update the draft content (and the UI should reflect it), not remain stuck as “pending” with no change.

---

## Extra — Draft images not loading ✅ implemented

### Symptoms
- Some drafts show an image preview for one draft, but other drafts show broken images or nothing.

### Fixes
- Draft media hydration now returns **longer-lived** signed URLs (2 hours) when fetching drafts.
- If media hydration fails, the API no longer returns a fake/broken URL (like a UUID string).
- If media import fails, we only keep fallback external URLs if they are **HTTPS**.
- The mobile UI now shows **“No image attached.”** vs **“Image failed to load.”** for clarity.
- Image selection is now driven by **server-side search + import** (Wikimedia Commons) to avoid model-hallucinated URLs.

### Code changed
- `backEnd/agent-manager/src/routes/drafts.ts`
- `backEnd/agent-manager/src/modules/draft-handler/listeners/agentFeedAnswerReceivedListener.ts`
- `client/mobile-app/app/(main)/AgentDraftsScreen.tsx`


