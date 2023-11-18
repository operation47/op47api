import express from "express";
import { login, register, revokeToken, getTokenFromRequest } from "./auth.js";

const authRouter = express.Router();

authRouter.post("/login", async (req, res) => {
    if (!req.body || !req.body.username || !req.body.password) {
        res.status(400).send("Bad Request");
        return;
    }
    let token;
    try {
        token = await login(req.body.username, req.body.password);
    } catch (e) {
        res.status(401).send("Unauthorized " + e);
        return;
    }

    res.send(token);
});

authRouter.post("/register", async (req, res) => {
    if (!req.body || !req.body.username || !req.body.password) {
        res.status(400).send("Bad Request");
        return;
    }
    let token;
    try {
        token = await register(req.body.username, req.body.password);
    } catch (e) {
        res.status(401).send("Unauthorized " + e);
        return;
    }

    res.send(token);
});

authRouter.post("/logout", async (req, res) => {
    try {
        const token = await getTokenFromRequest(req);
        await revokeToken(token);
    } catch (e) {
        res.status(401).send("Unauthorized " + e);
        return;
    }
    res.send("OK");
});

export default authRouter;
