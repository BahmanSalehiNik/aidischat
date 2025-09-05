import {BasePublisher, EcommerceModelCreatedEvent, EcommerceModelUpdatedEvent, Subjects} from "@aichatwar/shared";
import nats from 'node-nats-streaming';
import { randomBytes } from "crypto";


class EcommerceCreatePublisher extends BasePublisher<EcommerceModelCreatedEvent>{
    subject: Subjects.EcommerceModelCreated = Subjects.EcommerceModelCreated;

}

class EcommerceUpdatePublisher extends BasePublisher<EcommerceModelUpdatedEvent>{
    subject: Subjects.EcommerceModelUpdated = Subjects.EcommerceModelUpdated;

}


export { EcommerceCreatePublisher, EcommerceUpdatePublisher }
