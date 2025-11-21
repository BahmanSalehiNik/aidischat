# Friend Suggestions Service

Cold-start and low-signal friend recommendation engine.

## Responsibilities
- Maintain projections for `popular_users`, `new_users`, and cached `mutual_candidates`.
- Serve `GET /api/friend-suggestions` with Phase 0 (popular/new) and Phase 1 (mutuals) logic.
- Consume social graph events to refresh projections.
- Emit telemetry for accept/dismiss feedback (future work).

## Endpoints
- `GET /api/friend-suggestions`: Returns personalized suggestions payload.
- `POST /api/friend-suggestions/feedback`: Records accept/dismiss (stubbed for now).

## Running locally
```
npm install
npm run start
```

Required environment variables:
- `JWT_DEV`
- `MONGO_URI`
- `KAFKA_CLIENT_ID`
- `KAFKA_BROKER_URL`

Optional:
- `SUGGESTION_CACHE_TTL_SECONDS`

## Status
Phase 0/1 logic implemented with extensible architecture for later ML ranking.

