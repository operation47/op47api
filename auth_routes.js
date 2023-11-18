import express from "express";
import { login, register } from "./auth.js";

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
        res.status(401).send("Unauthorized" + e.message);
        return;
    }

    res.send(token);
});

authRouter.post("/register", (req, res) => {
    if (!req.body || !req.body.username || !req.body.password) {
        res.status(400).send("Bad Request");
        return;
    }
    let token;
    try {
        token = register(req.body.username, req.body.password);
    } catch (e) {
        res.status(401).send("Unauthorized" + e.message);
        return;
    }

    res.send(token);
});

export default authRouter;
