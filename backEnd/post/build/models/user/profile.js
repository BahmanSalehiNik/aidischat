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
exports.Profile = void 0;
// models/profile-.ts
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_update_if_current_1 = require("mongoose-update-if-current");
const shared_1 = require("@aichatwar/shared");
const profileSchema = new mongoose_1.default.Schema({
    _id: String,
    userId: { type: String, required: true },
    avatarUrl: String,
    privacy: {
        profileVisibility: {
            type: String,
            enum: shared_1.Visibility,
            default: shared_1.Visibility.Public,
        },
        postDefault: {
            type: String,
            enum: shared_1.Visibility,
            default: shared_1.Visibility.Friends,
        },
    },
    version: Number,
    username: { type: String, required: true }
});
profileSchema.set('versionKey', 'version');
profileSchema.plugin(mongoose_update_if_current_1.updateIfCurrentPlugin);
profileSchema.statics.build = (attrs) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = attrs, rest = __rest(attrs, ["id"]);
    return new Profile(Object.assign({ _id: id }, rest));
});
const Profile = mongoose_1.default.model('Profile', profileSchema);
exports.Profile = Profile;
