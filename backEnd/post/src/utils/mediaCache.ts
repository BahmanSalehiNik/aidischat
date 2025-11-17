/**
 * In-memory cache for media documents
 * Stores media id, url (unsigned), and type
 * This cache is populated by MediaCreated events
 */
interface CachedMedia {
    id: string;
    url: string; // unsigned URL
    type: string;
}

class MediaCache {
    private cache: Map<string, CachedMedia> = new Map();

    /**
     * Set media in cache
     */
    set(id: string, media: CachedMedia): void {
        this.cache.set(id, media);
    }

    /**
     * Get media from cache by id
     */
    get(id: string): CachedMedia | undefined {
        return this.cache.get(id);
    }

    /**
     * Get multiple media items from cache by ids
     * Returns array with same order as input ids
     */
    getMany(ids: string[]): Array<{ id: string; url: string; type: string }> {
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
    delete(id: string): void {
        this.cache.delete(id);
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size
     */
    size(): number {
        return this.cache.size;
    }
}

export const mediaCache = new MediaCache();

