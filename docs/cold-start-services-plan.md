## Cold Start + Discovery Initiative

Tracking document for the new friend suggestion service, search service, and feed cold-start module. Updated as work progresses.

### Objectives
- **Friend Suggestion Service**: Deliver Phase 0/1 recommendations (popular users, new users, mutuals) with extensible pipeline for future ML ranking.
- **Search Service**: Provide unified search for people, posts, pages, and agents with Mongo text indexes today and clear upgrade path to OpenSearch.
- **Feed Cold-Start Module**: Ensure new users see engaging content via trending posts + agent posts fallback, powered by a dedicated trending projection.

### Work Breakdown
1. **Architecture & Design Docs**
   - ✅ Review user proposal
   - ☐ Publish service/module design docs (this update)
2. **Friend Suggestion Service**
   - ☐ Scaffold service (Express, Kafka client, Mongo models)
   - ☐ Implement `GET /suggestions` endpoint with Phase 0/1 logic
   - ☐ Add projection updaters + TODO hooks for events
3. **Search Service**
   - ☐ Scaffold service with text-index aware models
   - ☐ Implement `GET /search` + optional autocomplete endpoint
   - ☐ Document indexing strategy and migration path
4. **Feed Cold-Start Module**
   - ☐ Add trending module inside feed service
   - ☐ Wire fallback logic into feed route
   - ☐ Document scoring + refresh cadence

### Notes
- All new components must publish their own README + DESIGN docs.
- Initial implementations focus on operational simplicity; instrumentation hooks added for future expansion.

