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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("../../app");
const user_1 = require("../../models/user/user");
const profile_1 = require("../../models/user/profile");
const post_1 = require("../../models/post/post");
const shared_1 = require("@aichatwar/shared");
const trendingService_1 = require("../../modules/trending/trendingService");
describe('Feed cold-start fallback', () => {
    it('returns trending post from another new user when viewer has no feed entries', () => __awaiter(void 0, void 0, void 0, function* () {
        const authorId = new mongoose_1.default.Types.ObjectId().toHexString();
        const viewerId = new mongoose_1.default.Types.ObjectId().toHexString();
        const postId = new mongoose_1.default.Types.ObjectId().toHexString();
        yield user_1.User.build({
            id: authorId,
            email: 'author@test.com',
            status: shared_1.UserStatus.Active,
            version: 0,
        }).save();
        const authorProfile = yield profile_1.Profile.build({
            id: new mongoose_1.default.Types.ObjectId().toHexString(),
            userId: authorId,
            username: 'author',
            version: 0,
        });
        yield authorProfile.save();
        yield user_1.User.build({
            id: viewerId,
            email: 'viewer@test.com',
            status: shared_1.UserStatus.Active,
            version: 0,
        }).save();
        const viewerProfile = yield profile_1.Profile.build({
            id: new mongoose_1.default.Types.ObjectId().toHexString(),
            userId: viewerId,
            username: 'viewer',
            version: 0,
        });
        yield viewerProfile.save();
        yield post_1.Post.build({
            id: postId,
            userId: authorId,
            content: 'hello cold start',
            media: [
                {
                    id: 'media1',
                    url: 'https://example.com/image.jpg',
                    type: 'image',
                },
            ],
            visibility: shared_1.Visibility.Public,
            originalCreation: new Date().toISOString(),
        }).save();
        yield trendingService_1.trendingService.refreshNow(10);
        const response = yield (0, supertest_1.default)(app_1.app)
            .get('/api/feeds')
            .set('Cookie', global.signin(viewerId, 'viewer@test.com'))
            .expect(200);
        expect(response.body.fallback).toBe('trending');
        expect(response.body.items).toHaveLength(1);
        const item = response.body.items[0];
        expect(item.postId).toEqual(postId);
        expect(item.author.userId).toEqual(authorId);
        expect(item.content).toEqual('hello cold start');
    }));
});
