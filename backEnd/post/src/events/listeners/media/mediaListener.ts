import { MediaCreatedEvent, Subjects, Listener } from "@aichatwar/shared";
import { GroupIdMediaCreated } from "../../queGroupNames";
import { EachMessagePayload } from "kafkajs";
import { mediaCache } from "../../../utils/mediaCache";

class MediaCreatedListener extends Listener<MediaCreatedEvent>{
    readonly topic: Subjects.MediaCreated = Subjects.MediaCreated;
    groupId: string = GroupIdMediaCreated;
    
    async onMessage(processedMessage: MediaCreatedEvent['data'], msg: EachMessagePayload){
        console.log('Media created event received:', processedMessage);
        
        // Ensure id is a string for consistent cache lookup
        const mediaId = String(processedMessage.id);
        
        // Cache media with id and url (unsigned)
        mediaCache.set(mediaId, {
            id: mediaId,
            url: processedMessage.url, // unsigned URL
            type: processedMessage.type,
        });
        
        console.log(`Cached media ${mediaId} with URL: ${processedMessage.url}`);
        
        // Manual acknowledgment - only after successful cache
        await this.ack();
    }
}

export { MediaCreatedListener };

