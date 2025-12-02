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
exports.getPostMedia = getPostMedia;
exports.getAndStorePostMedia = getAndStorePostMedia;
/**
 * Utility functions for looking up media for posts
 * Handles cache lookup, document fallback, and retry logic
 */
const post_1 = require("../models/post");
const mediaCache_1 = require("./mediaCache");
/**
 * Get media for a post, checking cache first, then document, then retrying cache
 * @param post - The post document (can be before or after save)
 * @param options - Options for media lookup
 * @returns Valid media array or undefined
 */
function getPostMedia(post_2) {
    return __awaiter(this, arguments, void 0, function* (post, options = {}) {
        const { checkDocument = false, updateDocument = false } = options;
        // If no mediaIds, return undefined
        if (!post.mediaIds || post.mediaIds.length === 0) {
            return undefined;
        }
        // Step 1: Try cache first
        const mediaIdStrings = post.mediaIds.map((id) => String(id));
        let media = mediaCache_1.mediaCache.getMany(mediaIdStrings);
        // Filter out fallback media (where url === id, meaning not in cache)
        let validMedia = media ? media.filter(m => m.url !== m.id) : undefined;
        // If we found valid media in cache, return it
        if (validMedia && validMedia.length > 0) {
            return validMedia;
        }
        // Step 2: If cache doesn't have media, check document (for existing posts or after save)
        if (checkDocument) {
            // Reload post to get any media that might have been stored
            const savedPost = yield post_1.Post.findById(post.id);
            if ((savedPost === null || savedPost === void 0 ? void 0 : savedPost.media) && Array.isArray(savedPost.media) && savedPost.media.length > 0) {
                console.log('Found media in document after save:', savedPost.media.length, 'items');
                return savedPost.media;
            }
        }
        else if (post.media && Array.isArray(post.media) && post.media.length > 0) {
            // Use existing media from document (for update flow)
            console.log('Using existing media from document:', post.media.length, 'items');
            return post.media;
        }
        // Step 3: Retry cache (in case MediaCreated event arrived between checks)
        const retryMedia = mediaCache_1.mediaCache.getMany(mediaIdStrings);
        const retryValidMedia = retryMedia ? retryMedia.filter(m => m.url !== m.id) : undefined;
        if (retryValidMedia && retryValidMedia.length > 0) {
            console.log('Found media in cache on retry:', retryValidMedia.length, 'items');
            // Optionally update document with found media
            if (updateDocument) {
                const postToUpdate = yield post_1.Post.findById(post.id);
                if (postToUpdate) {
                    postToUpdate.media = retryValidMedia;
                    yield postToUpdate.save();
                }
            }
            return retryValidMedia;
        }
        // No media found
        console.log('Warning: Post has mediaIds but no media found in cache or document');
        return undefined;
    });
}
/**
 * Get and store media for a post
 * This function gets media and stores it in the post document
 * @param post - The post document
 * @returns Valid media array or undefined
 */
function getAndStorePostMedia(post) {
    return __awaiter(this, void 0, void 0, function* () {
        const media = yield getPostMedia(post, {
            checkDocument: false, // Don't check document for create flow (will be checked after save)
            updateDocument: false,
        });
        // Store media in post document if found
        if (media && media.length > 0) {
            post.media = media;
        }
        return media;
    });
}
