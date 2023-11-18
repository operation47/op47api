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
 * valid auth token otherwise null.
 * @param {Request} req
 * @returns {User | null}
 */
export async function getUserFromRequest(req) {
    if (!req || !req.headers || !req.headers.authorization) return null;

    const authHeader = req.headers.authorization;
    if (!authHeader) return null;

    const splitHeader = authHeader.trim().split(" ");
    if (splitHeader.length !== 2 || splitHeader[0].toLowerCase() !== "bearer") {
        return null;
    }

    const token = splitHeader[1];
    const hashedToken = createHash("sha256").update(token).digest("base64");

    try {
        const result = await pool.query(
            "SELECT users.* FROM users JOIN auth_tokens ON auth_tokens.user_id = users.id LIMIT 1",
            [hashedToken],
        );
        if (result.rowCount !== 1) return null;
        return result.rows[0];
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Returns a new login token for a user if it is valid else null.
 * @param {string} username
 * @param {string} password
 * @returns {string | null}
 */
export async function login(username, password) {
    if (!username || !password) return null;

    const user = await getUserByUsername(username);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return null;
    }
    const token = await createAuthToken(user.id);
    if (!token) return null;
    return token;
}

/**
 * Tries to register a new user and returns a new auth token if successful else null.
 * @param {string} username
 * @param {string} password
 * @returns {string | null}
 */
export async function register(username, password) {
    if (!username || !password) return null;

    try {
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE username = $1 LIMIT 1",
            [username],
        );
        if (existingUser.rowCount !== 0) return null;
    } catch (e) {
        console.error(e);
        return null;
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    try {
        await pool.query(
            "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id",
            [username, hashedPassword],
        );
        const token = login(username, password);
        if (!token) return null; // weird should never happen
        return token;
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Returns a new auth token for a user or null if user id is not valid.
 * @param {number} userId
 * @returns {string | null}
 */
async function createAuthToken(userId) {
    if (!userId) return null;

    const token = createHash("sha256").update(randomBytes(32)).digest("base64");
    const hashedToken = createHash("sha256").update(token).digest("base64");

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE id = $1 LIMIT 1",
            [userId],
        );

        if (result.rows.rowCount !== 1) return null;

        await pool.query(
            "INSERT INTO auth_tokens (user_id, token) VALUES ($1, $2)",
            [userId, hashedToken],
        );
        return token;
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Returns a User if the id is valid else null.
 * @param {number} id
 * @returns {User | null}
 */
async function getUserById(id) {
    if (!id) return null;

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE id = $1 LIMIT 1",
            [id],
        );
        if (result.rowCount !== 1) return null;
        return result.rows[0];
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * Returns a new login token for a user if it is valid else null.
 * @param {string} username
 * @returns {User | null}
 */
async function getUserByUsername(username) {
    if (!username) return null;

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1 LIMIT 1",
            [username],
        );

        if (result.rowCount !== 1) return null;
        return result.rows[0];
    } catch (e) {
        console.error(e);
        return null;
    }
}
