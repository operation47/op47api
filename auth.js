import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { pool } from "./db.js";

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} password_hash
 * @property {string} created_at
 */

/**
 * Returns the user from a given request if it has a
 * valid auth token otherwise the promise will be rejected.
 * @param {Request} req
 * @returns {Promise<User>}
 */
export async function getUserFromRequest(req) {
    if (!req || !req.headers) {
        return Promise.reject("Invalid request");
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return Promise.reject("Missing authorization header");
    }

    const splitHeader = authHeader.trim().split(" ");
    if (splitHeader.length !== 2 || splitHeader[0].toLowerCase() !== "bearer") {
        return Promise.reject("Invalid authorization header format");
    }

    const token = splitHeader[1];
    const hashedToken = createHash("sha256").update(token).digest("base64");

    try {
        const result = await pool.query(
            "SELECT users.* FROM users JOIN auth_tokens ON auth_tokens.user_id = users.id LIMIT 1",
            [hashedToken],
        );
        if (result.rowCount !== 1) {
            return Promise.reject("Invalid authorization token");
        }
        return result.rows[0];
    } catch (e) {
        console.error(e);
        return Promise.reject("Something went wrong");
    }
}

/**
 * Returns a new auth token for a user if name and password are valid, otherwise rejects the promise.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function login(username, password) {
    if (!username || !password) {
        return Promise.reject("Username and password must be provided");
    }

    let user;
    try {
        await getUserByUsername(username);
    } catch (_) {
        console.log("here");
        return Promise.reject("Invalid username or password");
    }

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return Promise.reject("Invalid username or password");
    }

    let token;
    try {
        token = await createAuthToken(user.id);
    } catch (_) {
        return Promise.reject("Could not create auth token");
    }

    return token;
}

/**
 * Tries to register a new user and returns a new auth token otherwise rejects the promise.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function register(username, password) {
    if (!username || !password) {
        return Promise.reject("Username and password must be provided");
    }

    try {
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE username = $1 LIMIT 1",
            [username],
        );
        if (existingUser.rowCount !== 0) {
            return Promise.reject("Username already exists");
        }
    } catch (e) {
        console.error(e);
        return Promise.reject("Something went wrong");
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    try {
        await pool.query(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
            [username, hashedPassword],
        );
        const token = login(username, password);
        if (!token) {
            return Promise.reject("Error loggin in (should never happen)");
        }
        return token;
    } catch (e) {
        console.error(e);
        return Promise.reject("Something went wrong");
    }
}

/**
 * Creates and returns a new auth token for a user or rejects the promise if the user id is invalid.
 * @param {number} userId
 * @returns {Promise<string>}
 */
async function createAuthToken(userId) {
    if (!userId) {
        return Promise.reject("User id must be provided");
    }

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE id = $1 LIMIT 1",
            [userId],
        );

        if (result.rows.rowCount !== 1) {
            return Promise.reject("User not found");
        }

        const token = createHash("sha256")
            .update(randomBytes(32))
            .digest("base64");
        const hashedToken = createHash("sha256").update(token).digest("base64");

        await pool.query(
            "INSERT INTO auth_tokens (user_id, token) VALUES ($1, $2)",
            [userId, hashedToken],
        );

        return token;
    } catch (e) {
        console.error(e);
        return Promise.reject("Something went wrong");
    }
}

/**
 * Returns the user with the given id or rejects the promise if the id is invalid.
 * @param {number} id
 * @returns Promise<User>
 */
async function getUserById(id) {
    if (!id) {
        return Promise.reject("User id must be provided");
    }

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE id = $1 LIMIT 1",
            [id],
        );
        if (result.rowCount !== 1) {
            return Promise.reject("User not found");
        }
        return result.rows[0];
    } catch (e) {
        console.error(e);
        return Promise.reject("Something went wrong");
    }
}

/**
 * Returns the user with the given username or rejects the promise if the user doesn't exist.
 * @param {string} username
 * @returns Promise<User>
 */
async function getUserByUsername(username) {
    if (!username) {
        return Promise.reject("Username must be provided");
    }

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1 LIMIT 1",
            [username],
        );

        if (result.rowCount !== 1) {
            return Promise.reject("User not found");
        }
        return result.rows[0];
    } catch (e) {
        console.error(e);
        return Promise.reject("Something went wrong");
    }
}
