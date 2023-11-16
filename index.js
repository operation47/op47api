import express from "express";
import pg from "pg";
import cors from "cors";
import helmet from "helmet";
import moment from "moment-timezone";

const port = process.env.PORT || 2001;
const API_KEY = process.env.API_KEY;
const RECAP_PASSWORD = process.env.RECAP_PASSWORD;
const WIKI_PASSWORD = process.env.WIKI_PASSWORD;

const TWITCH_AUTH = {
    "client-id": process.env.TWITCH_CLIENT_ID,
    authorization: process.env.TWITCH_OAUTH,
};

const app = express();
const v1Router = express.Router();
const v1TwitchRouter = express.Router();
const pool = new pg.Pool();

// Use JSON Middleware for Express to process JSON
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(helmet());

app.use("/v1", v1Router);
v1Router.get("/", (_, res) => {
    res.send("api v1");
});
v1Router.use("/twitch", v1TwitchRouter);
v1Router.get("/twitch", (_, res) => {
    res.send("twitch api v1");
});
v1Router.get("/wiki/pages", async (_, res) => {
    try {
        const result = await pool.query("SELECT title FROM wiki_pages");
        res.status(200).json(result.rows.map((row) => row.title));
    }
    catch(err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
v1Router.get("/wiki/page/:title", async (req, res) => {
    const title = req.params.title;
    if(!title) {
        res.status(400).send("Missing required parameters");
        return;
    }
    try {
        const result = await pool.query("SELECT * FROM wiki_pages WHERE title = $1", [title]);
        if(result.rowCount === 0) {
            res.status(404).send("Wiki page not found");
            return;
        }
        res.status(200).json(result.rows[0]);
    }
    catch(err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

v1Router.post("/wiki/create", async (req, res) => {
    console.log("create wiki page");
    const password = req.body.password;
    const title = req.body.title;
    const content = req.body.content;

    if(!password || !title || !content) {
        res.status(400).send("Missing required parameters");
        return;
    }
    if(password !== WIKI_PASSWORD) {
        res.status(401).send("Invalid password");
        return;
    }
    if(await doesWikiPageExist(title)) {
        res.status(409).send("Wiki page already exists");
        return;
    }
    try {
        pool.query("INSERT INTO wiki_pages (title, content) VALUES ($1, $2)", [title.trim(), content]);
        res.status(200).send("Success");
    }
    catch(err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});
async function doesWikiPageExist(title) {
    if (!title) return false;
    try {
        const result = await pool.query("SELECT * FROM wiki_pages WHERE title = $1", [title]);
        return result.rowCount > 0;
    }
    catch(err) {
        console.error(err);
        return true;
    }
}

v1Router.post("/insertClip", async (req, res) => {
    if (!req.get("authorization"))
        return res.status(403).json({ error: "No password sent!" });
    if (req.get("authorization") !== RECAP_PASSWORD)
        return res.status(401).json({ error: "Wrong password!" });
    try {
        if (!req.body.url) {
            console.log("Missing required url parameter");
            res.status(400).send("Missing required url parameter");
            return;
        }

        let twitchLinkRegex =
            /^(?:https?\:\/\/)?(?:(?:clips|www)\.twitch\.tv\/)(?:(?:[a-zA-Z0-9][\w]{2,24})\/clip\/)?([a-zA-Z0-9-_]+)(?:\S)*$/;
        let match = req.body.url.match(twitchLinkRegex);
        if (!match) {
            console.log("Invalid url parameter");
            res.status(422).send("Invalid url parameter");
            return;
        }
        let id = match[match.length - 1];

        const options = {
            method: "GET",
            headers: TWITCH_AUTH,
        };
        let twitchRes = await fetch(
            `https://api.twitch.tv/helix/clips?id=${id}`,
            options,
        );
        twitchRes = await twitchRes.json();
        twitchRes = await twitchRes.data[0];
        if (
            !twitchRes.created_at ||
            !twitchRes.url ||
            !twitchRes.broadcaster_name ||
            !twitchRes.creator_name
        ) {
            console.log("Problem with Twitch API");
            res.status(500).send("Internal Server Error");
            return;
        }
        // twitch clip titles can be empty
        const clipTitle = !twitchRes.title ? twitchRes.broadcaster_name : twitchRes.title;
        const data = {
            created_at: moment(twitchRes.created_at).tz("Europe/Berlin").format("YYYY-MM-DD"),
            url: twitchRes.url,
            title: clipTitle,
            channel: twitchRes.broadcaster_name,
            creator_name: twitchRes.creator_name,
        };
        pool.query(
            "INSERT INTO clips (created_at, url, title, channel, creator_name) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            [
                data.created_at,
                data.url,
                data.title,
                data.channel,
                data.creator_name,
            ],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send(
                        "Error inserting clip into database: " + err,
                    );
                    return;
                }
                console.log(`Inserted clip: ${twitchRes.url}`);
                const options = {
                    method: "GET",
                };
                fetch("https://op47.de/comm/new_clip", options);
                const id = result.rows[0].id;
                const author = req.body.author ? req.body.author : "unknown";
                pool.query(
                    "INSERT INTO clips_aggregate (id, views, author) VALUES ($1, $2, $3)",
                    [id, 0, author],
                    (err, _) => {
                        if (err) {
                            console.log("Error adding aggregate for id: " + id);
                            return;
                        }
                        console.log(`aggregate info inserted for id: ${id}, added by ${author}`);
                    });
                res.json(`Inserted clip: ${twitchRes.url}`);
            },
        );
    } catch (err) {
        console.error(err);
    }
});

v1Router.delete("/removeClip", (req, res) => {
    if (!req.get("authorization"))
        return res.status(403).json({ error: "No password sent!" });
    if (req.get("authorization") !== RECAP_PASSWORD)
        return res.status(401).json({ error: "Wrong password!" });
    if (!req.body.url) {
        console.log("Missing required url parameter");
        res.status(400).send("Missing required url parameter");
        return;
    }

    let twitchLinkRegex =
        /^(?:https?\:\/\/)?(?:(?:clips|www)\.twitch\.tv\/)(?:(?:[a-zA-Z0-9][\w]{2,24})\/clip\/)?([a-zA-Z0-9-_]+)(?:\S)*$/;
    let match = req.body.url.match(twitchLinkRegex);
    if (!match) {
        console.log("Invalid url parameter");
        res.status(422).send("Invalid url parameter");
        return;
    }
    let twitchId = match[match.length - 1];
    let newURL = "https://clips.twitch.tv/" + twitchId;
    let dbId;
    pool.query(`SELECT id FROM clips WHERE url='${newURL}'`, (err, result) => {
        dbId = result.rows[0].id;
    });
    pool.query(`DELETE FROM clips WHERE url='${newURL}'`, (err, _) => {
        if (err) {
            res.status(500).send("Error removing clip from database: " + err);
            return;
        }
        console.log(`Deleted clip: ${newURL}`);

        if (dbId != undefined) {
            pool.query(`DELETE FROM clips_aggregate WHERE id=${dbId}`, (err, _) => {
                if (err) console.log(`Error deleting id ${dbId} from aggregate`);
            })
        } else console.log(`Error deleting ${newURL} from aggregate`);

        res.json(`Deleted clip: ${newURL}`);
    });
});

v1Router.get("/clips/:date", (req, res) => {
    let date = req.params.date;
    if (date.toLowerCase() === "today") {
        date = moment().tz("Europe/Berlin").format("YYYY-MM-DD");
    } else if (!/^\d\d\d\d-\d\d-\d\d$/.test(date)) {
        console.log("Invalid date parameter");
        res.status(422).send("Invalid date parameter. Should be: YYYY-MM-DD");
        return;
    }
    date = `${date} 00:00:00`;
    pool.query(
        `SELECT * FROM clips WHERE created_at = '${date}'`,
        (err, result) => {
            if (err) {
                res.status(500).send(
                    "Error retrieving messages from database: " + err,
                );
                return;
            }
            res.json(result.rows);
        },
    );
});

v1TwitchRouter.get("/messages/:channel_name", (req, res) => {
    const channelName = "#".concat(req.params.channel_name.toLowerCase());
    pool.query(
        "SELECT * FROM messages WHERE channel = $1 AND timestamp >= NOW() - INTERVAL '3 days'",
        [channelName],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send(
                    "Error retrieving messages from database: " + err,
                );
                return;
            }

            result.rows.forEach((row) => {
                row.timestamp = new Date(row.timestamp).getTime();
            });
            res.json(result.rows);
        },
    );
});
v1TwitchRouter.get("/messages/:channel_name/since/:timestamp", (req, res) => {
    const channelName = "#".concat(req.params.channel_name.toLowerCase());
    const timestamp = new Date(parseInt(req.params.timestamp));

    pool.query(
        "SELECT * FROM messages WHERE channel = $1 AND timestamp > $2",
        [channelName, timestamp],
        (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send(
                    "Error retrieving messages from database: " + err,
                );
                return;
            }

            result.rows.forEach((row) => {
                row.timestamp = new Date(row.timestamp).getTime();
            });
            res.json(result.rows);
        },
    );
});

v1TwitchRouter.post("/insertMessage", async (req, res) => {
    if (!req.get("authorization"))
        return res.status(403).json({ error: "No credentials sent!" });
    if (req.get("authorization") !== API_KEY)
        return res.status(401).json({ error: "Wrong credentials!" });
    try {
        if (
            !req.body.timestamp ||
            !req.body.channel ||
            !req.body.user ||
            !req.body.content ||
            !req.body.display_name
        ) {
            res.status(400).send("Missing required parameters");
            return;
        }
        const data = {
            timestamp: new Date(req.body.timestamp * 1000).toISOString(),
            channel: req.body.channel,
            user: req.body.user,
            content: req.body.content,
            display_name: req.body.display_name,
        };
        const result = await pool.query(
            'INSERT INTO messages (timestamp, channel, "user", content, display_name) VALUES ($1, $2, $3, $4, $5)',
            [
                data.timestamp,
                data.channel,
                data.user,
                data.content,
                data.display_name,
            ],
        );

        console.log(`Inserted ${result.rowCount} rows.`);
        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({channel: data.channel}),
        };
        fetch("https://op47.de/comm/new_message", options);
        res.json(`Inserted ${result.rowCount} rows.`);
    } catch (err) {
        console.error(err);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
