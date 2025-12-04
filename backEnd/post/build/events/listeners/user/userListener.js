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
exports.UserUpdatedListener = exports.UserCreatedListener = void 0;
const shared_1 = require("@aichatwar/shared");
const queGroupNames_1 = require("./../../queGroupNames");
const user_1 = require("../../../models/user/user");
class UserCreatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.UserCreated;
        this.groupId = queGroupNames_1.GroupIdUserCreated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('User created event received:', processedMessage);
            const user = user_1.User.build(processedMessage);
            yield user.save();
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.UserCreatedListener = UserCreatedListener;
class UserUpdatedListener extends shared_1.Listener {
    constructor() {
        super(...arguments);
        this.topic = shared_1.Subjects.UserUpdated;
        this.groupId = queGroupNames_1.GroupIdUserUpdated;
    }
    onMessage(processedMessage, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('User updated event received:', processedMessage);
            const user = yield user_1.User.findByEvent({ id: processedMessage.id, version: processedMessage.version });
            if (!user) {
                throw new shared_1.NotFoundError();
            }
            user.status = processedMessage.status;
            yield user.save();
            // Manual acknowledgment - only after successful save
            yield this.ack();
        });
    }
}
exports.UserUpdatedListener = UserUpdatedListener;
