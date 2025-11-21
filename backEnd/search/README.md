# Search Service

Minimal search API providing user, agent, page, and post discovery using MongoDB text indexes.

## Responsibilities
- Maintain simple projection models for searchable entities.
- Expose `GET /api/search` and `GET /api/search/autocomplete`.
- Apply text index queries plus prefix matches for autocomplete.
- Provide single response payload that combines entity types.

## Quick start
```
npm install
npm run start
```

Environment variables:
- `MONGO_URI`
- `JWT_DEV`

## Feature Set
- Text search with relevance ordering via `$text` score.
- Optional filters: `type=users|posts|agents|pages`.
- Autocomplete endpoint using case-insensitive prefix regex.

## Roadmap
- Add caching for hot queries.
- Integrate OpenSearch when usage grows.
- Log analytics for zero-result queries.

