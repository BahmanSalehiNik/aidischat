import {BasePublisher, EcommerceOrderCreatedEvent, EcommerceOrderCancelledEvent, Subjects} from "@aichatwar/shared";
import nats from 'node-nats-streaming';
import { randomBytes } from "crypto";


class EcommerceOrderCreatedPublisher extends BasePublisher<EcommerceOrderCreatedEvent>{
    subject: Subjects.EcommerceOrderCreated = Subjects.EcommerceOrderCreated;

}

class EcommerceOrderCancelledPublisher extends BasePublisher<EcommerceOrderCancelledEvent>{
    subject: Subjects.EcommerceOrderCancelled = Subjects.EcommerceOrderCancelled;

}


export { EcommerceOrderCreatedPublisher, EcommerceOrderCancelledPublisher }