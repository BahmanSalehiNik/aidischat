# AI Gateway Service - TODO List

## Completed ✅

- [x] Create AI gateway service structure (package.json, tsconfig, etc.)
- [x] Create Kafka client wrapper for AI gateway
- [x] Create AI provider interfaces and base classes
- [x] Implement OpenAI provider
- [x] Implement Anthropic provider
- [x] Implement local LLM provider (Azure)
- [x] Create agent profile model/cache for AI gateway
- [x] Create ai-message-created listener
- [x] Create ai-message-reply publisher
- [x] Create main index.ts with service initialization

## High Priority 🔴

### Agent Profile Population
- [ ] **Agent Profile Sync**: Implement full agent profile synchronization
  - Option 1: Add HTTP client to fetch from agents service
  - Option 2: Create event that includes full profile data (AgentProfileCreated/Updated)
  - Option 3: Share database connection (not recommended for microservices)
  - **Status**: Currently agent profiles need to be manually populated or synced

### API Key Management
- [ ] **Secure API Key Storage**: Implement proper API key management
  - [ ] Encrypt API keys in database
  - [ ] Support environment variables per provider (OPENAI_API_KEY, ANTHROPIC_API_KEY, COHERE_API_KEY)
  - [ ] Consider integration with key management service (AWS Secrets Manager, Azure Key Vault)
  - [ ] Add API key rotation support

### Error Handling & Resilience
- [ ] **Retry Logic**: Add retry mechanism for failed provider calls
  - [ ] Exponential backoff
  - [ ] Max retry attempts
  - [ ] Dead-letter queue for permanently failed messages
- [ ] **Circuit Breaker**: Implement circuit breaker pattern for provider calls
- [ ] **Timeout Handling**: Better timeout management for slow providers
- [ ] **Error Logging**: Enhanced error logging and monitoring

## Medium Priority 🟡

### Rate Limiting
- [ ] **Rate Limit Enforcement**: Enforce agent-level rate limits
  - [ ] Track requests per agent (RPM/TPM)
  - [ ] Queue requests when limit reached
  - [ ] Respect provider-level rate limits
- [ ] **Rate Limit Monitoring**: Track and log rate limit violations

### Moderation Integration
- [ ] **Moderation Event Listener**: Consume moderation events
  - [ ] Handle "boring" content events
  - [ ] Handle "user engagement" events
  - [ ] Handle "repetitive messages" events
  - [ ] Handle "inappropriate content" events
- [ ] **Content Filtering**: Filter or modify AI responses based on moderation signals
- [ ] **Response Quality Checks**: Validate AI responses before publishing

### Performance & Scalability
- [ ] **Response Caching**: Cache common responses to reduce API calls
- [ ] **Connection Pooling**: Optimize provider connection management
- [ ] **Batch Processing**: Process multiple agents in optimized batches
- [ ] **Load Balancing**: Distribute load across multiple gateway instances

## Low Priority 🟢

### Advanced Features
- [ ] **Streaming Responses**: Support streaming AI responses (Server-Sent Events)
- [ ] **Tool/Function Calling**: Full support for AI tool/function calling
- [ ] **Multi-turn Conversation Context**: Maintain conversation history
- [ ] **Response Formatting**: Format responses (markdown, code blocks, etc.)
- [ ] **Response Validation**: Validate response format and content

### Monitoring & Observability
- [ ] **Metrics Collection**: Track provider response times, success rates
- [ ] **Cost Tracking**: Track token usage and costs per agent/user
- [ ] **Health Checks**: Add health check endpoint
- [ ] **Distributed Tracing**: Add tracing for request flow
- [ ] **Dashboard**: Create monitoring dashboard

### Billing Integration
- [ ] **Cost Tracking**: Track costs per agent, per user, per provider
- [ ] **Billing Events**: Publish billing events to billing service
- [ ] **Usage Reports**: Generate usage reports

### Testing
- [ ] **Unit Tests**: Add unit tests for providers
- [ ] **Integration Tests**: Test with real providers (sandbox mode)
- [ ] **Load Tests**: Test under high load
- [ ] **Mock Providers**: Create mock providers for testing

### Documentation
- [ ] **API Documentation**: Document provider-specific configurations
- [ ] **Deployment Guide**: Step-by-step deployment instructions
- [ ] **Troubleshooting Guide**: Common issues and solutions
- [ ] **Architecture Diagrams**: Visual diagrams of the system

## Future Enhancements 🔮

- [ ] **Multi-Model Support**: Support multiple models per agent (fallback, A/B testing)
- [ ] **Custom Providers**: Plugin system for custom AI providers
- [ ] **Response Post-Processing**: Add post-processing pipeline (sentiment, summarization)
- [ ] **Agent Collaboration**: Allow agents to collaborate on responses
- [ ] **Response Ranking**: Rank multiple responses and select best one
- [ ] **Adaptive Prompting**: Adjust prompts based on conversation context
- [ ] **Multi-Language Support**: Support for multiple languages
- [ ] **Voice Integration**: Support for voice-based interactions (TTS/STT)

## Notes

- Agent profile synchronization is the most critical missing piece
- Consider using a message queue for provider calls to handle rate limits better
- Monitor provider costs closely as usage scales
- Consider implementing a provider abstraction layer for easier provider switching

