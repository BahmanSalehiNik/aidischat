# Search Service — Design

## Goals
- Deliver fast, low-cost search for people, posts, pages, and agents.
- Provide consistent API contract for clients, regardless of storage engine.
- Make it easy to swap Mongo text index with OpenSearch/Meilisearch later.

## High-Level Architecture
1. **API Layer** (`src/routes/search.ts`)
   - Validates query, enforces auth, dispatches to search orchestrator.
2. **Search Orchestrator** (`src/services/searchEngine.ts`)
   - Runs parallel Mongo queries per entity type based on request filters.
   - Normalizes records to unified shape with `type`, `id`, `title`, `snippet`, `score`.
3. **Models/Collections**
   - `UserSearchDoc`, `PostSearchDoc`, `AgentSearchDoc`, `PageSearchDoc`.
   - Each schema maintains `text` indexes on searchable fields.
4. **Autocomplete**
   - Uses prefix regex on `name`/`username`.
   - Limited to 5 results per entity type to stay performant.

## Request Flow
```
Client -> /api/search?q=foo&type=users,posts
       -> Auth middleware
       -> SearchEngine.execute({ query: 'foo', types: [...] })
            -> Mongo $text queries
            -> Combine + score normalization
       -> Response
```

## Score Normalization
- Mongo `$meta: 'textScore'` is captured per entity.
- Scores are scaled to 0..1 per entity type, then combined.
- Final payload contains raw `score` for transparency.

## Extensibility
- Add caching layer (Redis) keyed by `{query}:{types}` with short TTL (30s).
- Capture analytics by publishing `SearchPerformed` events.
- Replace Mongo with OpenSearch by re-implementing `SearchEngine`.

## Future Enhancements
- Rerank results with personalization signals.
- Support filters (location, media type, time range).
- Add highlight snippets for posts.

