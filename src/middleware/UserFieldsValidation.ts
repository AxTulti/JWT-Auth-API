import dotenv from 'dotenv';
dotenv.config();

// Import our user Schema
import userSchema from '../model/user';
import jwt from 'jsonwebtoken';
import express from 'express';
import bcrypt from 'bcrypt';

// import user schema
import User from '../model/user';

// function for name validation
function IsNameValid (name: string): boolean {
    if ( typeof name !== "string"  || name.length < 2 || name.length > 20 ) return false;

    // the name must not contain the following characters:
    //  <, >, &, ', " and \, becasue they can cause problems when used in the client side.
    const re = /[<>&'\"\\]/g;
    if (re.test(name)) return false;

    return true;
}

// function for lastname validation
function IsLastNameValid (lastName: string): boolean {
    if ( typeof lastName !== "string" || lastName.length < 2 || lastName.length > 30) return false;

    // the lastName must not contain the following characters:
    //  <, >, &, ', " and \, because they can cause problems when used in the client side.
    const re = /[<>&'\"\\]/g;
    if (re.test(lastName)) return false;
    return true;
}

// function for email validation 
function IsEmailValid (email: string): boolean {
    const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

// function for password validation
function IsPasswordValid (password: string): boolean {
    if ( typeof password !== "string" || password.length < 6 || password.length > 20) return false;

    // the password must not contain spaces
    if (password.indexOf(' ') !== -1) return false;
    return true;
}

// validation for all fields
function ValidateUserFields(req: express.Request | any, res: express.Response, next: express.NextFunction) {
    // the user must be sent in request body
    if (!req.body) return res.status(400).send('The user must be sent in the request body');
    const user = req.body;
    // name validation
    if (!IsNameValid(user.name)) return res.status(400).send('The name is invalid or missing: The name must be a string, have at least 2 characters long and at most 20 characters long, it must not contain <, >, &, \', " and \\ characters');
    // lastName validation
    if (!IsLastNameValid(user.lastName)) return res.status(400).send('The lastName is invalid or missing: The lastName must be a string, have at least 2 characters long and at most 30 characters long, it must not contain <, >, &, \', " and \\ characters');
    // email validation
    if (!IsEmailValid(user.email)) return res.status(400).send('The email is invalid or missing: The email must be a valid email address');
    // password validation
    if (!IsPasswordValid(user.password)) return res.status(400).send('The password is invalid or missing: The password must be a string, have at least 6 characters long and at most 20 characters long and must not contain spaces');

    // if all the validation rules are passed, the user is valid and the user is gonna be appended to the req.user
    const userToAppend = {
        name: user.name,
        lastName: user.lastName,
        email: user.email.toLowerCase(),
        password: user.password
    };
    req.user = userToAppend;
    next();
}

/*
The following middleware is intended to be called in the POST /register route 
it must be called after the ValidateUserFields middleware, because it needs
the user to be already appended to the req.user.

this middleware validates that the user's email hasn't been registred before
*/
async function ValidateIfEmailIsAlreadyRegistred(req: express.Request | any, res: express.Response, next: express.NextFunction) {
    const { email } = req.user;

    // check if the email is already registred
    const user = await User.findOne({ email });

    // if the email is already registred, send an error
    // 422 - Unprocessable Entity (the request was well-formed but was unable to be followed due to semantic errors)
    if (user) return res.status(422).send('The email is already registred');

    // if the email is valid continue
    next();
}

function ValidateUserLoginFields(req: express.Request | any, res: express.Response, next: express.NextFunction) {
    // get the user's password and email from the req.body
    const { email, password } = req.body;

    // check if the email is valid
    if (!IsEmailValid(email)) return res.status(400).send('The email is invalid or missing: The email must be a valid email address');

    // check if the password is valid
    if (!IsPasswordValid(password)) return res.status(400).send('The password is invalid or missing: The password must be a string, have at least 6 characters long and at most 20 characters long and must not contain spaces');
    
    // if all the validation rules are passed, the user is valid and the user is gonna be appended to the req.user
    const userToAppend = {
        // the user's email must be turned into lowercase before it is proccessed
        email: email.toLowerCase(),
        password
    };

    // append the modyfied user in the req.user
    req.login = userToAppend;
    next();
}

function VerifyNameAndLastName(req: express.Request | any, res: express.Response, next: express.NextFunction) {
    // get the user's name and lastName from the req.user
    const { name, lastName } = req.body;

    // check if the name is valid
    if (!IsNameValid(name)) return res.status(400).send('the name is invalid or missing: The name must be a string, have at least 2 characters long and at most 20 characters long and it must not contain <, >, &, \', " and \\ characters');

    // check if the lastName is valid
    if (!IsLastNameValid(lastName)) return res.status(400).send('the lastName is invalid or missing: The lastName must be a string, have at least 2 characters long and at most 30 characters long and it must not contain <, >, &, \', " and \\ characters');

    const userToAppend = {
        name,
        lastName
    };
    req.update = userToAppend;
    next();
}

function ValidateNewPassword(req: express.Request | any, res: express.Response, next: express.NextFunction) {
    // get the user's new password from the req.body
    const { newPassword } = req.body;

    // check if the newPassword is valid
    if (!IsPasswordValid(newPassword)) return res.status(400).send('The newPassword is missing or invalid: The newPassword must be a string, have at least 6 characters long and at most 20 characters long and must not contain spaces');

    req.newPassword = newPassword;
    next();
}
//Ok
async function VerifyRefreshToken(req: express.Request | any, res: express.Response, next: express.NextFunction){
    /*
     * this middleware recieves the refresh token from the req.body, and validates it.
     * if the refresh token is valid, it is appended to the req.refreshToken in a json with the user's email.
     * 
     * this are the rules to validate the refresh token:
     * it can't be empty
     * it must be a string
     * it must be a valid JWT token (signed with the REFRESH_TOKEN_KEY)
     * it must be registred in the database as a valid refresh token for that user
     */

    const { refreshToken } = req.body;

    // check if the refresh token was sent
    if (!refreshToken) return res.status(400).send("the refresh token is missing");

    // check if the refresh token is a string
    if (typeof refreshToken !== 'string') return res.status(400).send("the refresh token must be a string");

    // check if the refresh token is a valid JWT token
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_KEY!, async(err: any, decodedUser: any) => {
        if(err) return res.status(400).send(err);

        // check if the refresh token is registred in the database for its user
        const { email } = decodedUser;
        const databaseUser = await userSchema.findOne({ email });
        
        // check if the user exists (it could have been deleted)
        // 410 - Gone (the requested resource is no longer available at the server and no forwarding address is known)
        if(!databaseUser) return res.status(410).send("The user wich the refresh token belongs to no longer exists");

        // check if the refresh token is registred in the database for its user
        const { refreshTokens: allowedRefreshTokens } = databaseUser;
        // 403 - Forbidden (the request was valid but the server is not able to respond to it)
        if (!allowedRefreshTokens.includes(refreshToken)) return res.status(403).send("The refresh token is no longer valid");

        // if all the rules are passed, the refresh token is valid and it is gonna be appended to the req.refreshToken in a json with the user's email
        const infoToAppend = {
            refreshToken,
            email
        };

        req.refreshToken = infoToAppend;

        // and we will also append the user in database to the req.databaseUser
        req.databaseUser = databaseUser;
        next();
    });
}

//Ok
async function VerifyUserCredentials(req: express.Request | any, res: express.Response, next: express.NextFunction) {
    /* this middleware asumes that the user's email and password are already validated.
     * this middleware verifyes that a user with that email exists in the database and that the password is correct.

     * to do that re gonna follow the next steps:
     * 1. Search for the user in the database
     * 2. Check if the password is correct
     * 3. The email and password are gonna be appended to the req.credentials
     * 4. The databse user is gonna be appended to the req.databaseUser
     */

    // We don't verifiy the email and password here, because by the time this middleware is called, the email and password are already supposed to be valid.
    const { email, password: sentPassword } = req.body;
    
    // 1. Search for the user in the database
    const databaseUser = await userSchema.findOne({ email });

    // 403 - Forbidden
    if (!databaseUser) return res.status(403).send(`The user with the email ${email} is not registred`);

    // 2. Check if the password is correct
    const { password: databasePassword } = databaseUser;
    const isPasswordCorrect = await bcrypt.compare(sentPassword, databasePassword);
    if (!isPasswordCorrect) return res.status(403).send(`The password is not correct`);

    // 3. The email and password are gonna be appended to the req.credentials
    const credentials = {
        email,
        password: sentPassword
    };
    req.credentials = credentials;

    // 4. The database user is gonna be appended to the req.databaseUser
    req.databaseUser = databaseUser;
    next();
}
export { ValidateUserFields, ValidateIfEmailIsAlreadyRegistred, ValidateUserLoginFields, VerifyNameAndLastName, ValidateNewPassword, VerifyRefreshToken, VerifyUserCredentials };