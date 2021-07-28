"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function DecodeAndVerifyToken(req, res, next) {
    // get the access token from the body
    const { accessToken } = req.body;
    if (!accessToken)
        return res.status(401).send('No access Token found');
    // verify and decode the token
    jsonwebtoken_1.default.verify(accessToken, process.env.TOKEN_KEY, (err, user) => {
        if (err)
            return res.status(401).send(err);
        req.decodedUser = user;
        next();
    });
}
exports.default = DecodeAndVerifyToken;
