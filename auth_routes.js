import express from "express";

const authRouter = express.Router();

authRouter.post("/login", (req, res) => {
    res.send("login");
});

authRouter.post("/register", (req, res) => {
    res.send("register");
});

export default authRouter;
