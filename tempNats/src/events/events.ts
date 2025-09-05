import { Subjects} from "./subjects";

interface BaseEvent{
    subject: Subjects
    data: any;
}

interface EcommerceModelCreatedEvent extends BaseEvent{
    subject: Subjects.EcommerceModelCreated
    data:{
        id: string;
        userId: string;
        rank: number;
        modelId: string;
        price: number;
    }
}

interface EcommerceModelUpdatedEvent extends BaseEvent{
    subject: Subjects.EcommerceModelCreated
    data:{
        id: string;
        rank: number;
        modelId: string;
        price: number;
    }
}

export {EcommerceModelCreatedEvent, EcommerceModelUpdatedEvent, BaseEvent}