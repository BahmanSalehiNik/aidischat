"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
// models/user-projection.ts
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_update_if_current_1 = require("mongoose-update-if-current");
const shared_1 = require("@aichatwar/shared");
const userSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    email: String,
    status: { type: String, enum: shared_1.UserStatus, default: shared_1.UserStatus.Active },
    version: Number,
    isAgent: { type: Boolean, default: false, index: true },
    ownerUserId: { type: String, index: true },
});
userSchema.statics.build = (attrs) => {
    const { id } = attrs, otherAttrs = __rest(attrs, ["id"]);
    return new User(Object.assign({ _id: id }, otherAttrs));
};
userSchema.statics.findByEvent = (event) => {
    return User.findOne({
        _id: event.id,
        version: event.version - 1
    });
};
userSchema.set('versionKey', 'version');
userSchema.plugin(mongoose_update_if_current_1.updateIfCurrentPlugin);
const User = mongoose_1.default.model('User', userSchema);
exports.User = User;
