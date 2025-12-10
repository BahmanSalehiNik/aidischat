import { MessageWindow, WindowMessage } from '../models/message-window';
import { NLP_CONFIG } from '../config/constants';

export interface AnalysisResult {
  topics: string[];
  sentiment: {
    overall: 'positive' | 'neutral' | 'negative';
    score: number; // -1 to 1
    breakdown?: { [messageId: string]: number };
  };
  context: {
    intent: string; // "question", "discussion", "support", "casual"
    domain: string; // "technical", "social", "business", "general"
    keywords: string[];
  };
  confidence: number; // 0 to 1
}

export class NLPAnalyzer {
  /**
   * Analyze message window to extract topics, sentiment, and context
   */
  async analyze(window: MessageWindow): Promise<AnalysisResult> {
    // Get only human messages for analysis
    const humanMessages = window.messages.filter(m => m.senderType === 'human');
    
    if (humanMessages.length === 0) {
      // No human messages - return default analysis
      return this.getDefaultAnalysis();
    }

    // Combine all human messages into text
    const combinedText = humanMessages.map(m => m.content).join(' ');

    if (NLP_CONFIG.ENABLED && NLP_CONFIG.PROVIDER === 'ai-gateway') {
      try {
        return await this.analyzeWithAIGateway(combinedText, humanMessages);
      } catch (error) {
        console.error('[NLPAnalyzer] AI Gateway analysis failed, falling back to keyword-based:', error);
        return this.analyzeWithKeywords(combinedText, humanMessages);
      }
    } else {
      // Use keyword-based analysis as fallback or default
      return this.analyzeWithKeywords(combinedText, humanMessages);
    }
  }

  /**
   * Analyze using AI Gateway (or external NLP service)
   */
  private async analyzeWithAIGateway(
    text: string,
    messages: WindowMessage[]
  ): Promise<AnalysisResult> {
    // TODO: Implement AI Gateway integration
    // For now, fall back to keyword-based
    return this.analyzeWithKeywords(text, messages);
  }

  /**
   * Fallback: Keyword-based analysis
   * This is a simple implementation that can be enhanced
   */
  private analyzeWithKeywords(
    text: string,
    messages: WindowMessage[]
  ): AnalysisResult {
    const lowerText = text.toLowerCase();

    // Extract topics (simple keyword matching)
    const topics = this.extractTopics(lowerText);

    // Analyze sentiment (simple keyword-based)
    const sentiment = this.analyzeSentiment(lowerText, messages);

    // Determine context
    const context = this.determineContext(lowerText, topics);

    return {
      topics,
      sentiment,
      context,
      confidence: 0.6, // Lower confidence for keyword-based analysis
    };
  }

  /**
   * Extract topics from text using keyword matching
   */
  private extractTopics(text: string): string[] {
    // Common technical topics
    const technicalKeywords: { [key: string]: string } = {
      'javascript': 'javascript',
      'js': 'javascript',
      'typescript': 'typescript',
      'ts': 'typescript',
      'react': 'react',
      'node': 'nodejs',
      'python': 'python',
      'java': 'java',
      'c++': 'cpp',
      'html': 'html',
      'css': 'css',
      'api': 'api',
      'database': 'database',
      'sql': 'sql',
      'mongodb': 'mongodb',
      'docker': 'docker',
      'kubernetes': 'kubernetes',
      'aws': 'aws',
      'cloud': 'cloud',
      'debugging': 'debugging',
      'error': 'debugging',
      'bug': 'debugging',
    };

    const foundTopics = new Set<string>();
    
    for (const [keyword, topic] of Object.entries(technicalKeywords)) {
      if (text.includes(keyword)) {
        foundTopics.add(topic);
      }
    }

    return Array.from(foundTopics);
  }

  /**
   * Analyze sentiment using keyword matching
   */
  private analyzeSentiment(
    text: string,
    messages: WindowMessage[]
  ): AnalysisResult['sentiment'] {
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'thanks', 'thank you', 'helpful', 'love', 'like', 'perfect', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'wrong', 'error', 'broken', 'fail', 'problem', 'issue', 'bug'];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of positiveWords) {
      if (text.includes(word)) positiveCount++;
    }

    for (const word of negativeWords) {
      if (text.includes(word)) negativeCount++;
    }

    // Calculate sentiment score (-1 to 1)
    const total = positiveCount + negativeCount;
    let score = 0;
    if (total > 0) {
      score = (positiveCount - negativeCount) / total;
    }

    // Determine overall sentiment
    let overall: 'positive' | 'neutral' | 'negative';
    if (score > 0.2) {
      overall = 'positive';
    } else if (score < -0.2) {
      overall = 'negative';
    } else {
      overall = 'neutral';
    }

    return {
      overall,
      score,
    };
  }

  /**
   * Determine conversation context
   */
  private determineContext(text: string, topics: string[]): AnalysisResult['context'] {
    // Determine intent
    const questionWords = ['how', 'what', 'why', 'when', 'where', 'can', 'could', 'should', '?'];
    const isQuestion = questionWords.some(word => text.includes(word)) || text.includes('?');
    
    const intent = isQuestion ? 'question' : 
                   text.includes('help') || text.includes('support') ? 'support' :
                   text.length > 200 ? 'discussion' : 'casual';

    // Determine domain
    const technicalIndicators = ['code', 'function', 'variable', 'error', 'bug', 'api', 'database', 'server'];
    const businessIndicators = ['business', 'company', 'product', 'market', 'sales', 'revenue'];
    const socialIndicators = ['friend', 'party', 'fun', 'happy', 'excited', 'celebrate'];

    const hasTechnical = technicalIndicators.some(indicator => text.includes(indicator)) || topics.length > 0;
    const hasBusiness = businessIndicators.some(indicator => text.includes(indicator));
    const hasSocial = socialIndicators.some(indicator => text.includes(indicator));

    let domain = 'general';
    if (hasTechnical) {
      domain = 'technical';
    } else if (hasBusiness) {
      domain = 'business';
    } else if (hasSocial) {
      domain = 'social';
    }

    // Extract keywords (top 5 most common words, excluding common stop words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    const words = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    const wordCounts = new Map<string, number>();
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    const keywords = Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return {
      intent,
      domain,
      keywords,
    };
  }

  /**
   * Get default analysis when no human messages
   */
  private getDefaultAnalysis(): AnalysisResult {
    return {
      topics: [],
      sentiment: {
        overall: 'neutral',
        score: 0,
      },
      context: {
        intent: 'casual',
        domain: 'general',
        keywords: [],
      },
      confidence: 0,
    };
  }
}

export const nlpAnalyzer = new NLPAnalyzer();

