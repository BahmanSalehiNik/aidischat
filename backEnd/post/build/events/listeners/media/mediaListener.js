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
exports.MediaCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const queGroupNames_1 = require("../../queGroupNames");
const mediaCache_1 = require("../../../utils/mediaCache");
class MediaCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.MediaCreated;
        this.groupId = queGroupNames_1.GroupIdMediaCreated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Media created event received:', processedMessage);
            // Ensure id is a string for consistent cache lookup
            const mediaId = String(processedMessage.id);
            // Cache media with id and url (unsigned)
            mediaCache_1.mediaCache.set(mediaId, {
                id: mediaId,
                url: processedMessage.url, // unsigned URL
                type: processedMessage.type,
            });
            console.log(`Cached media ${mediaId} with URL: ${processedMessage.url}`);
            // Manual acknowledgment - only after successful cache
            yield this.ack();
        });
    }
}
exports.MediaCreatedListener = MediaCreatedListener;
