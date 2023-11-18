import express from "express";
import { v1Router } from "./index.js";

const authRouter = express.Router();

v1Router.use("/auth", authRouter);

authRouter.post("/login", (req, res) => {
    res.send("login");
});

authRouter.post("/register", (req, res) => {
    res.send("register");
});
