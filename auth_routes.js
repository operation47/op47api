import express from "express";
import { login, register } from "./auth.js";

const authRouter = express.Router();

authRouter.post("/login", async (req, res) => {
    if (!req.body || !req.body.username || !req.body.password) {
        res.status(400).send("Bad Request");
        return;
    }
    const token = await login(req.body.username, req.body.password);
    if (!token) {
        res.status(401).send("Unauthorized");
        return;
    }

    res.send(token);
});

authRouter.post("/register", (req, res) => {
    if (!req.body || !req.body.username || !req.body.password) {
        res.status(400).send("Bad Request");
        return;
    }
    const token = register(req.body.username, req.body.password);
    if (!token) {
        res.status(401).send("Unauthorized");
        return;
    }
    res.send(token);
});

export default authRouter;
