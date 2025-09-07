import { Subjects } from '@aichatwar/shared';
import {Stan} from 'node-nats-streaming';


export const natsClient = {
    client:{
        publish: jest.fn().mockImplementation(
            (subject:string,data: string, callback: ()=> void) => {
            callback();
    }
        )
    //         publish: function(subject:string,data: string, callback: ()=> void) {
    //         callback();
    // }


}


}
