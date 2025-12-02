"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaCache = void 0;
class MediaCache {
    constructor() {
        this.cache = new Map();
    }
    /**
     * Set media in cache
     */
    set(id, media) {
        this.cache.set(id, media);
    }
    /**
     * Get media from cache by id
     */
    get(id) {
        return this.cache.get(id);
    }
    /**
     * Get multiple media items from cache by ids
     * Returns array with same order as input ids
     */
    getMany(ids) {
        return ids.map(id => {
            const media = this.cache.get(id);
            if (media) {
                return {
                    id: media.id,
                    url: media.url,
                    type: media.type,
                };
            }
            // Return fallback if not in cache
            return {
                id,
                url: id, // fallback to id as url
                type: 'image',
            };
        });
    }
    /**
     * Remove media from cache
     */
    delete(id) {
        this.cache.delete(id);
    }
    /**
     * Clear entire cache
     */
    clear() {
        this.cache.clear();
    }
    /**
     * Get cache size
     */
    size() {
        return this.cache.size;
    }
}
exports.mediaCache = new MediaCache();
