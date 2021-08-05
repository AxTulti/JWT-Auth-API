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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bcrypt_1 = __importDefault(require("bcrypt"));
const morgan_1 = __importDefault(require("morgan"));
// Allow CORS
const cors_1 = __importDefault(require("cors"));
// Import the DB coneection
const database_1 = __importDefault(require("./config/database"));
database_1.default();
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Import our middleware
const UserFieldsValidation_1 = require("./middleware/UserFieldsValidation");
const AuthMiddleware_1 = __importDefault(require("./middleware/AuthMiddleware"));
// Import our user Schema
const user_1 = __importDefault(require("./model/user"));
// create our application
const app = express_1.default();
// Settings
// port
app.set("port", process.env.PORT || 3000);
// midleware
// Allow CORS
const whitelist = process.env.ALLOWED_ORIGINS;
const corsOptions = {
    origin: function (origin, callback) {
        if (whitelist.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};
app.use(cors_1.default(corsOptions));
app.use(morgan_1.default('tiny'));
// add json support
app.use(express_1.default.json());
// routes
// Register route - OK
app.post("/register", UserFieldsValidation_1.ValidateUserFields, UserFieldsValidation_1.ValidateIfEmailIsAlreadyRegistred, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    *  If this route is hit, it means that the client has sent a user object with all the required fields,
    *  and all the fields are valid (that is checked in the ValidatesUserFields middleware). It also means
    *  that the email is not already registred (that is checked in the ValidateIfEmailIsAlreadyRegistred middleware).
    *
    *  So, now we can create the user, since it's all valid. To acomplish this, we'll folow these steps:
    *  1. Hash the password with 10 salt cycles(bcrypt).
    *  2. Get the other user's data from the request object (the user data is stored in the req.user, since the ValidateUserFields middleware
    *     put it there.
    *  3. Save the user in the database useing the userSchema (without a refresh token since those are gonna be created when the user logs in).
    *  4. Send back a response with the user object.
    */
    try {
        // 1. Hash the password with 10 salt cycles(bcrypt).
        const hashedPassword = yield bcrypt_1.default.hash(req.user.password, 10);
        // 2. Get the other user's data from the request object (the user data is stored in the req.user, since the ValidateUserFields middleware put it there.
        const { name, lastName, email } = req.user;
        // 3. Save the user in the database using the userSchema (without a refresh token since those are gonna be created when the user logs in).
        const databaseUser = yield user_1.default.create({
            name,
            lastName,
            email,
            password: hashedPassword,
            refreshTokens: []
        });
        // 201 - Created
        res.status(201).json(databaseUser);
    }
    catch (err) {
        res.status(500).send(err);
        console.log(err);
    }
}));
// Login route - OK
app.post("/login", UserFieldsValidation_1.ValidateUserLoginFields, UserFieldsValidation_1.VerifyUserCredentials, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    *  This route is meant to create a new refresh token for the user, and return it to the client.
    *  In order to do this, the client has to provide the user's email and password, wich are validated
    *  by the ValidateUserLoginFields and VerifyUserCredentials middleware. So for now, we'll asume
    *  that the user has permition to generate a refresh token.
    *
    *  The steps to do this are:
    *  1. Get the user from the database using the userSchema.
    *  2. Generate a refresh token for the user.
    *  3. Update the user's refresh tokens (add the new refresh token).
    *  4. Send the new refresh token.
    */
    try {
        // 1. Get the user from the database using the userSchema.
        const { email } = req.credentials;
        const databaseUser = yield user_1.default.findOne({ email });
        // 2. Generate a refresh token for the user.
        const refreshToken = jsonwebtoken_1.default.sign({ user_id: databaseUser._id, email: databaseUser.email }, process.env.REFRESH_TOKEN_KEY);
        // 3. Update the user's refresh tokens (add the new refresh token).
        databaseUser.refreshTokens.push(refreshToken);
        yield databaseUser.save();
        // 4. Send the new refresh token.
        res.status(201).json({ refreshToken });
    }
    catch (err) {
        res.status(500).send(err);
        console.log(err);
    }
}));
// Token route - OK
app.post("/token", UserFieldsValidation_1.VerifyRefreshToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    * This route is ment to be used by the client to get a new access token, those are the tokens wich will allow
    * the client to make actions on the aplications that this server provides auth for. they are intended to be
    * used as one-time tokens, so they are valid only for a short time.
    *
    * To do that, client has to provide a valid refresh token (gotten from the login route) and validated by
    * the VerifyRefreshToken middleware wich appends the refresh token info to de req.refreshToken.
    * the req.refreshToken contains two properties:
    * - email: the email obtained from the refresh token
    * - refreshToken: the refresh token itself
    *
    * theese are the steps to get a new token:
    * 1. Get the refresh token's email from the req.refreshToken.email property.
    * 2. Get the corresponding user from the database using the userSchema (wich will always exist since its existence of it was validated on the VerifyRefreshToken middleware).
    * 3. Generate a new access token with the data obtained by our search in the database.
    * 4. Send the access token.
    */
    try {
        // 1. Get the refresh token's email from the req.refreshToken.email property.
        const { email } = req.refreshToken;
        // 2. Get the corresponding user from the database using the userSchema (wich will always exist since its existence was validated on the VerifyRefreshToken middleware).
        const databaseUser = yield user_1.default.findOne({ email });
        // 3. Generate a new access token with the data obtained by our search in the database.
        const tokenDuration = "30s";
        const accessToken = jsonwebtoken_1.default.sign({ user_id: databaseUser._id, email: databaseUser.email, name: databaseUser.name, lastName: databaseUser.lastName }, process.env.TOKEN_KEY, { expiresIn: tokenDuration });
        // 4. Send the access token.
        res.status(201).json({ accessToken: accessToken });
    }
    catch (error) {
        res.status(500).send(error);
        console.log(error);
    }
}));
// Decode route - OK - This route is only for testing purposes, a route like this has to be implemented in the aplications that use this server.
app.post("/decode", AuthMiddleware_1.default, (req, res) => res.status(200).json(req.decodedUser));
// Logout route - OK
app.delete("/logout", UserFieldsValidation_1.VerifyRefreshToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    * This route is ment to be used by the client to logout the user.
    * to do that, client has to provide a valid refresh token (gotten from the login route).
    * an the refresh token provided will be invalidated. The refresh Token is removed validated by the VerifyRefreshToken middleware
    * beforehand accesing this route, and the info validated is stored in the req.refreshToken, with the following properties:
    * - email: the email obtained from the refresh token
    * - refreshToken: the refresh token itself
    *
    * to complete this, the route will follow the following steps:
    * 1. Get the user's email from the req.refreshToken.email property.
    * 2. Get the user from the database using the userSchema.
    * 3. Delete the refresh token from the user document.
    */
    try {
        // 1. Get the user's email from the req.refreshToken.email property.
        const { email, refreshToken } = req.refreshToken;
        // 2. Get the user from the database using the userSchema.
        const databaseUser = yield user_1.default.findOne({ email });
        // 3. Delete the refresh token from the user document.
        databaseUser.refreshTokens.remove(refreshToken);
        yield databaseUser.save();
        res.status(200).send("You have been logged out, that refresh token will no longer be valid");
    }
    catch (error) {
        res.status(500).send(error);
        console.log(error);
    }
}));
// LogoutAll route - OK
app.delete("/logoutAll", UserFieldsValidation_1.ValidateUserLoginFields, UserFieldsValidation_1.VerifyUserCredentials, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    * This route is ment to be used by the client to invalidate all the refresh tokens.
    * to do that, client has to provide a valid email and password.
    * the credentals that reach this route are validated by the ValidateUserLoginFields middleware
    * and the VerifyUserCredentials middleware. So the password here is always valid and correct.
    * So we will asume for now on that the user has the permission to do this.
    *
    * To complete this, the route will follow the following steps:
    * 1. Get the user from the database using the userSchema.
    * 2. Delete all the refresh tokens from the user document.
    */
    try {
        // 1. Get the user from the database using the userSchema.
        const { email } = req.credentials;
        const databaseUser = yield user_1.default.findOne({ email });
        // 2. Delete all the refresh tokens from the user document.
        databaseUser.refreshTokens = [];
        yield databaseUser.save();
        // Sends a message to the user.
        res.status(200).send("All refresh tokens have been invalidated");
    }
    catch (error) {
        res.status(500).send(error);
        console.log(error);
    }
}));
// update route - OK
app.put("/update", UserFieldsValidation_1.VerifyNameAndLastName, UserFieldsValidation_1.VerifyRefreshToken, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    * This route is meant to be used by the client to update it's name and lastName.
    * to do that, client has to provide a valid refresh token (gotten from the login route),
    * wich is validated by the VerifyRefreshToken middleware.
    *
    * These are the steps to update the user info:
    *  1. Get the user new info from the res.update (putted there by the VerifyNameAndLastName middleware).
    *  2. Get the user from the database using the userSchema with the req.refreshToken.email property (putted there by the VerifyRefreshToken middleware).
    *  3. Update the user document with the new info.
    */
    try {
        // 1. Get the user new info from the res.update (putted there by the VerifyNameAndLastName middleware).
        const { name, lastName } = req.update;
        // 2. Get the user from the database using the userSchema with the req.refreshToken.email property (putted there by the VerifyRefreshToken middleware).
        const { email } = req.refreshToken;
        const databaseUser = yield user_1.default.findOne({ email });
        // 3. Update the user document with the new info.
        Object.assign(databaseUser, { name, lastName }); //TODO: Test this.
        yield databaseUser.save();
        // Sends a message to the user.
        res.status(200).send("The user info has been updated");
    }
    catch (error) {
        res.status(500).send(error);
        console.log(error);
    }
}));
// changePassword route - OK
app.put("/changePassword", UserFieldsValidation_1.ValidateUserLoginFields, UserFieldsValidation_1.ValidateNewPassword, UserFieldsValidation_1.VerifyUserCredentials, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    * This route is ment to be used by the client to change the user password.
    * to do that, client has to provide a valid email and password, that is checked by the ValidateUserLoginFields middleware,
    * and the ValidateNewPassword middleware, so for now on we assume that the client has the permission to do this.
    *
    * Theese are the steps required to acomplish that:
    * 1. Get the user from the database using the userSchema with the req.credentials.email property (putted there by the VerifyUserCredentials middleware).
    * 2. Update the user document with the new password gotten from the req.newPassword (putted there by the ValidateNewPassword middleware).
    */
    try {
        // 1. Get the user from the database using the userSchema with the req.credentials.email property (putted there by the VerifyUserCredentials middleware).
        const { email } = req.credentials;
        const databaseUser = yield user_1.default.findOne({ email });
        // 2. Update the user document with the new password gotten from the req.newPassword (putted there by the ValidateNewPassword middleware).
        const newHashedPassword = yield bcrypt_1.default.hash(req.newPassword, 10);
        databaseUser.password = newHashedPassword;
        yield databaseUser.save();
        res.status(200).send("The password has been changed");
    }
    catch (error) {
        res.status(500).send(error);
        console.log(error);
    }
}));
// delete route - OK
app.delete("/delete", UserFieldsValidation_1.ValidateUserLoginFields, UserFieldsValidation_1.VerifyUserCredentials, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    /*
    * This route is ment to be used by the client to delete the user account.
    * to do that, client has to provide a valid email and password, wich are gonna be validated by the VerifyUserCredentials middleware.
    * So we will asume that the user has the permission to do this.
    *
    * These are the steps required to acomplish that:
    * 1. Search for the user getting the email from the user.credentials.email property (putted there by the VerifyUserCredentials middleware).
    * 2. Delete the user document.
    */
    try {
        // 1. Search for the user getting the email from the user.credentials.email property (putted there by the VerifyUserCredentials middleware).
        const { email } = req.credentials;
        const databaseUser = yield user_1.default.findOne({ email });
        // 2. Delete the user document.
        yield databaseUser.remove();
        res.status(200).send("The user has been deleted");
    }
    catch (error) {
        res.status(500).send(error);
        console.log(error);
    }
}));
// listen on port
app.listen(app.get("port"), () => console.log("Server started on port " + app.get("port")));
