import {BasePublisher, EcommerceOrderExpiredEvent, Subjects} from "@aichatwar/shared";


class EcommerceExpirationPublisher extends BasePublisher<EcommerceOrderExpiredEvent>{
    subject: Subjects.EcommerceOrderExpired = Subjects.EcommerceOrderExpired;

}


export { EcommerceExpirationPublisher }
