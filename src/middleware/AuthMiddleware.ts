import express from 'express';
import jwt from 'jsonwebtoken';

function DecodeAndVerifyToken(req: express.Request | any, res: express.Response, next: express.NextFunction) {
    // get the access token from the body
    const { accessToken } = req.body;
    if (!accessToken) return res.status(401).send('No access Token found');

    // verify and decode the token
    jwt.verify(accessToken, process.env.TOKEN_KEY!, (err: any, user: any) => {
        if (err) return res.status(401).send(err);
        req.decodedUser = user;
        next();
    });
}

export default DecodeAndVerifyToken;