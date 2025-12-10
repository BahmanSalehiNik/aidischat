"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentMatcher = exports.AgentMatcher = void 0;
const agent_projection_1 = require("../models/agent-projection");
const constants_1 = require("../config/constants");
class AgentMatcher {
    /**
     * Find relevant agents based on conversation analysis
     * Uses local agent projections (built from events, not API calls)
     */
    findRelevantAgents(analysis, roomId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get all active, public agents
            const agents = yield agent_projection_1.AgentProjection.find({
                isActive: true,
                isPublic: true,
            }).lean();
            if (agents.length === 0) {
                console.log('[AgentMatcher] No active agents found');
                return [];
            }
            // Score each agent
            const matches = [];
            for (const agent of agents) {
                const match = yield this.scoreAgent(agent, analysis);
                if (match.relevanceScore > 0.3) { // Minimum threshold
                    matches.push(match);
                }
            }
            // Sort by relevance score (highest first)
            matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
            // Limit to top N matches
            const topMatches = matches.slice(0, constants_1.ANALYSIS_CONFIG.MAX_INVITATIONS_PER_ANALYSIS);
            console.log(`[AgentMatcher] Found ${matches.length} potential matches, returning top ${topMatches.length} for room ${roomId}`);
            return topMatches;
        });
    }
    /**
     * Score an agent's relevance to the conversation
     */
    scoreAgent(agent, analysis) {
        return __awaiter(this, void 0, void 0, function* () {
            let score = 0;
            const reasons = [];
            let confidence = 0.5;
            // 1. Topic matching (40% weight)
            const topicScore = this.matchTopics(agent, analysis.topics);
            if (topicScore > 0) {
                score += topicScore * 0.4;
                reasons.push(`topic_match: ${analysis.topics.slice(0, 3).join(',')}`);
            }
            // 2. Domain matching (30% weight)
            const domainScore = this.matchDomain(agent, analysis.context.domain);
            if (domainScore > 0) {
                score += domainScore * 0.3;
                reasons.push(`domain_match: ${analysis.context.domain}`);
            }
            // 3. Keyword matching (20% weight)
            const keywordScore = this.matchKeywords(agent, analysis.context.keywords);
            if (keywordScore > 0) {
                score += keywordScore * 0.2;
                reasons.push(`keyword_match`);
            }
            // 4. Intent matching (10% weight)
            const intentScore = this.matchIntent(agent, analysis.context.intent);
            if (intentScore > 0) {
                score += intentScore * 0.1;
                reasons.push(`intent_match: ${analysis.context.intent}`);
            }
            // Normalize score to 0-1
            score = Math.min(1, score);
            // Calculate confidence based on number of matches
            confidence = Math.min(1, 0.5 + (reasons.length * 0.1));
            return {
                agentId: agent.agentId,
                relevanceScore: score,
                matchReasons: reasons,
                confidence,
            };
        });
    }
    /**
     * Match agent tags/interests to conversation topics
     */
    matchTopics(agent, topics) {
        if (topics.length === 0)
            return 0;
        const agentTags = [
            ...(agent.tags || []),
            ...(agent.interests || []),
            ...(agent.skills || []),
        ].map((t) => t.toLowerCase());
        let matches = 0;
        for (const topic of topics) {
            if (agentTags.some((tag) => tag.includes(topic.toLowerCase()) || topic.toLowerCase().includes(tag))) {
                matches++;
            }
        }
        return matches / topics.length; // Percentage of topics matched
    }
    /**
     * Match agent specialization to conversation domain
     */
    matchDomain(agent, domain) {
        const agentDomain = (agent.specialization || agent.profession || '').toLowerCase();
        const conversationDomain = domain.toLowerCase();
        if (!agentDomain)
            return 0;
        // Exact match
        if (agentDomain === conversationDomain)
            return 1;
        // Partial match
        if (agentDomain.includes(conversationDomain) || conversationDomain.includes(agentDomain)) {
            return 0.7;
        }
        // Check for related domains
        const domainMappings = {
            'technical': ['developer', 'engineer', 'programmer', 'tech', 'software', 'coding'],
            'business': ['business', 'manager', 'executive', 'entrepreneur', 'consultant'],
            'social': ['friend', 'companion', 'social', 'chat', 'casual'],
        };
        const relatedTerms = domainMappings[conversationDomain] || [];
        if (relatedTerms.some(term => agentDomain.includes(term))) {
            return 0.5;
        }
        return 0;
    }
    /**
     * Match agent profile to conversation keywords
     */
    matchKeywords(agent, keywords) {
        if (keywords.length === 0)
            return 0;
        const agentText = [
            agent.name,
            agent.displayName,
            agent.title,
            agent.profession,
            agent.specialization,
            ...(agent.tags || []),
            ...(agent.interests || []),
            ...(agent.skills || []),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        let matches = 0;
        for (const keyword of keywords) {
            if (agentText.includes(keyword.toLowerCase())) {
                matches++;
            }
        }
        return matches / keywords.length;
    }
    /**
     * Match agent personality/role to conversation intent
     */
    matchIntent(agent, intent) {
        const agentPersonality = (agent.personality || []).map((p) => p.toLowerCase()).join(' ');
        const agentRole = (agent.title || '').toLowerCase();
        // Map intents to agent characteristics
        const intentMappings = {
            'question': ['helpful', 'teacher', 'expert', 'guide', 'assistant', 'support'],
            'support': ['supportive', 'helpful', 'caring', 'empathetic', 'assistant'],
            'discussion': ['conversational', 'friendly', 'engaging', 'thoughtful', 'analytical'],
            'casual': ['friendly', 'casual', 'conversational', 'social', 'chatty'],
        };
        const relevantTerms = intentMappings[intent] || [];
        const agentText = `${agentPersonality} ${agentRole}`;
        for (const term of relevantTerms) {
            if (agentText.includes(term)) {
                return 0.8;
            }
        }
        return 0;
    }
}
exports.AgentMatcher = AgentMatcher;
exports.agentMatcher = new AgentMatcher();
