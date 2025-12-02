export interface RouteRule {
  name: string;
  targetEnv: string;
  patterns: RegExp[];
}

const regex = {
  roomsMessages: /^\/api\/rooms\/[^/]+\/messages(?:\/.*)?$/i,
  debug: /^\/api\/debug(?:\/.*)?$/i,
  messages: /^\/api\/messages(?:\/.*)?$/i,
  usersRooms: /^\/api\/users\/rooms(?:\/.*)?$/i,
  users: /^\/api\/users(?:\/.*)?$/i,
  ecommerceModels: /^\/api\/ecommerce\/models(?:\/.*)?$/i,
  ecommerceOrders: /^\/api\/ecommerce\/orders(?:\/.*)?$/i,
  friends: /^\/api\/friends(?:\/.*)?$/i,
  media: /^\/api\/media(?:\/.*)?$/i,
  post: /^\/api\/post(?:\/.*)?$/i,
  posts: /^\/api\/posts(?:\/.*)?$/i,
  comments: /^\/api\/comments(?:\/.*)?$/i,
  reactions: /^\/api\/reactions(?:\/.*)?$/i,
  feeds: /^\/api\/feeds?(?:\/.*)?$/i,
  agents: /^\/api\/agents(?:\/.*)?$/i,
  rooms: /^\/api\/rooms(?:\/.*)?$/i,
  realtime: /^\/api\/realtime(?:\/.*)?$/i,
  aiGateway: /^\/api\/ai-gateway(?:\/.*)?$/i,
  agentManager: /^\/api\/agent-manager(?:\/.*)?$/i,
  search: /^\/api\/search(?:\/.*)?$/i,
  friendSuggestions: /^\/api\/friend-suggestions(?:\/.*)?$/i,
};

export const routeRules: RouteRule[] = [
  {
    name: 'chat-room-messages',
    targetEnv: 'CHAT_SERVICE_URL',
    patterns: [regex.roomsMessages],
  },
  {
    name: 'chat-debug',
    targetEnv: 'CHAT_SERVICE_URL',
    patterns: [regex.debug, regex.messages],
  },
  {
    name: 'room-users-rooms',
    targetEnv: 'ROOM_SERVICE_URL',
    patterns: [regex.usersRooms],
  },
  {
    name: 'room-general',
    targetEnv: 'ROOM_SERVICE_URL',
    patterns: [regex.rooms],
  },
  {
    name: 'user-service',
    targetEnv: 'USER_SERVICE_URL',
    patterns: [regex.users],
  },
  {
    name: 'post-service',
    targetEnv: 'POST_SERVICE_URL',
    patterns: [regex.post, regex.posts, regex.comments, regex.reactions],
  },
  {
    name: 'feed-service',
    targetEnv: 'FEED_SERVICE_URL',
    patterns: [regex.feeds],
  },
  {
    name: 'friendship-service',
    targetEnv: 'FRIENDSHIP_SERVICE_URL',
    patterns: [regex.friends],
  },
  {
    name: 'media-service',
    targetEnv: 'MEDIA_SERVICE_URL',
    patterns: [regex.media],
  },
  {
    name: 'agent-service',
    targetEnv: 'AGENT_SERVICE_URL',
    patterns: [regex.agents],
  },
  {
    name: 'ecommerce-models-service',
    targetEnv: 'ECOMMERCE_MODELS_SERVICE_URL',
    patterns: [regex.ecommerceModels],
  },
  {
    name: 'ecommerce-orders-service',
    targetEnv: 'ECOMMERCE_ORDERS_SERVICE_URL',
    patterns: [regex.ecommerceOrders],
  },
  {
    name: 'realtime-gateway',
    targetEnv: 'REALTIME_GATEWAY_URL',
    patterns: [regex.realtime],
  },
  {
    name: 'ai-gateway',
    targetEnv: 'AI_GATEWAY_URL',
    patterns: [regex.aiGateway],
  },
  {
    name: 'agent-manager-service',
    targetEnv: 'AGENT_MANAGER_SERVICE_URL',
    patterns: [regex.agentManager],
  },
  {
    name: 'search-service',
    targetEnv: 'SEARCH_SERVICE_URL',
    patterns: [regex.search],
  },
  {
    name: 'friend-suggestions-service',
    targetEnv: 'FRIEND_SUGGESTIONS_SERVICE_URL',
    patterns: [regex.friendSuggestions],
  },
];

export const requiredServiceEnvVars = Array.from(
  new Set(routeRules.map((rule) => rule.targetEnv))
);

