// agents/src/models/agent-profile.ts
import mongoose from 'mongoose';

interface AgentProfileAttrs {
    agentId: string;
    modelProvider: string;
    modelName: string;
    systemPrompt: string;
    tools: { name: string; config: any }[];
    voiceId: string;
    memory: any;
    rateLimits: { rpm: number; tpm: number };
    privacy: { shareMessagesWithOwner: boolean };
}

interface AgentProfileDoc extends mongoose.Document {
    agentId: string;
    modelProvider: string;
    modelName: string;
    systemPrompt: string;
    tools: { name: string; config: any }[];
    voiceId: string;
    memory: any;
    rateLimits: { rpm: number; tpm: number };
    privacy: { shareMessagesWithOwner: boolean };
    deletedAt?: Date;
    isDeleted: boolean;
}

interface AgentProfileModel extends mongoose.Model<AgentProfileDoc> {
    build(attrs: AgentProfileAttrs): AgentProfileDoc;
    findByEvent(e:{id:string;version:number}): Promise<AgentProfileDoc|null>;
}
    
const agentProfileSchema = new mongoose.Schema({
    agentId: { type: String, index: true, unique: true },
    modelProvider: { type: String, enum: ['openai','anthropic','local','custom'], required: true },
    modelName: { type: String, required: true },     // e.g., gpt-4o, claude-3.7, llama-3-70b
    systemPrompt: { type: String, default: '' },     // persona
    tools: [{ name: String, config: {} }],           // tool use (weather, search, internal APIs)
    voiceId: String,                                  // for TTS later
    memory: {},                                       // optional key-value memory
    rateLimits: { rpm: Number, tpm: Number },         // guardrails per agent
    privacy: { shareMessagesWithOwner: { type: Boolean, default: true } },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
  });

agentProfileSchema.statics.build = (attrs: AgentProfileAttrs) => new AgentProfile(attrs);

export const AgentProfile = mongoose.model<AgentProfileDoc, AgentProfileModel>('AgentProfile', agentProfileSchema);
  