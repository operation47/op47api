﻿import express, { json } from 'express';
import pg from 'pg';
import cors from 'cors';

const port = process.env.PORT || 2001;
const API_KEY = process.env.API_KEY;
const RECAP_PASSWORD = process.env.RECAP_PASSWORD;

const TWITCH_AUTH = {
    'client-id': process.env.TWITCH_CLIENT_ID,
    'authorization': process.env.TWITCH_OAUTH,
}

const app = express();
const v1Router = express.Router();
const v1TwitchRouter = express.Router();

// Use JSON Middleware for Express to process JSON
app.use(cors(
    {
        origin: "*"
    }
));
app.use(express.json())

app.use('/v1', v1Router);

const pool = new pg.Pool();

v1Router.get('/', (req, res) => {
    res.send('api v1');
});
v1Router.use('/twitch', v1TwitchRouter);
v1Router.get('/twitch', (req, res) => {
    res.send('twitch api v1');
});

v1Router.post('/insertClip', async (req, res) => {
    if (!req.get('authorization')) return res.status(403).json({ error: 'No password sent!' });
    if (req.get('authorization') !== RECAP_PASSWORD) return res.status(401).json({ error: 'Wrong password!' });
    try {
        if (!req.body.url) {
            console.log('Missing required url parameter');
            res.status(400).send('Missing required url parameter');
            return;
        }

        let twitchLinkRegex = /^(?:https?\:\/\/)?(?:(?:clips|www)\.twitch\.tv\/)(?:(?:[a-zA-Z0-9][\w]{2,24})\/clip\/)?([a-zA-Z0-9-_]+)(?:\S)*$/;
        let match = req.body.url.match(twitchLinkRegex);
        if (!match) {
            console.log('Invalid url parameter');
            res.status(422).send('Invalid url parameter');
            return;
        }
        let id = match[match.length - 1];

        const options = {
            method: 'GET',
            headers: TWITCH_AUTH,
        };
        let twitchRes = await fetch(`https://api.twitch.tv/helix/clips?id=${id}`, options);
        twitchRes = await twitchRes.json();
        twitchRes = await twitchRes.data[0];
        if (!twitchRes.created_at || !twitchRes.url || !twitchRes.title || !twitchRes.broadcaster_name || !twitchRes.creator_name) {
            console.log('Problem with Twitch API');
            res.status(500).send('Internal Server Error');
            return;
        }
        const data = {
            created_at: new Date(twitchRes.created_at).toISOString(),
            url: twitchRes.url,
            title: twitchRes.title,
            channel: twitchRes.broadcaster_name,
            creator_name: twitchRes.creator_name
        }
        pool.query('INSERT INTO clips (created_at, url, title, channel, creator_name) VALUES ($1, $2, $3, $4, $5)',
            [data.created_at, data.url, data.title, data.channel, data.creator_name], (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error inserting clip into database: ' + err);
                    return;
                }
                console.log(`Inserted clip: ${twitchRes.url}`);
                const options = {
                    method: 'GET',
                };
                fetch('https://op47.de/comm/new_clip', options);
                res.json(`Inserted clip: ${twitchRes.url}`);
            });
    } catch (err) {
        console.error(err);
    }
})

v1Router.delete('/removeClip', (req, res) => {
    if (!req.get('authorization')) return res.status(403).json({ error: 'No password sent!' });
    if (req.get('authorization') !== RECAP_PASSWORD) return res.status(401).json({ error: 'Wrong password!' });
    if (!req.body.url) {
        console.log('Missing required url parameter');
        res.status(400).send('Missing required url parameter');
        return;
    }

    let twitchLinkRegex = /^(?:https?\:\/\/)?(?:(?:clips|www)\.twitch\.tv\/)(?:(?:[a-zA-Z0-9][\w]{2,24})\/clip\/)?([a-zA-Z0-9-_]+)(?:\S)*$/;
    let match = req.body.url.match(twitchLinkRegex);
    if (!match) {
        console.log('Invalid url parameter');
        res.status(422).send('Invalid url parameter');
        return;
    }
    let id = match[match.length - 1];
    let newURL = 'https://clips.twitch.tv/' + id;
    pool.query(`DELETE FROM clips WHERE url='${newURL}'`, (err, result) => {
        if (err) {
            res.status(500).send('Error removing clip from database: ' + err);
            return;
        }
        console.log(`Deleted ${result.rowCount} rows with link: ${newURL}`);
        res.json(`Deleted ${result.rowCount} entries.`);
    });
})

v1Router.get('/clips/:date', (req, res) => {
    let date = req.params.date;
    if (date.toLowerCase() === 'today') {
        date = new Date().toISOString().split('T')[0];
    } else if (!/^\d\d\d\d-\d\d-\d\d$/.test(date)) {
        console.log('Invalid date parameter');
        res.status(422).send('Invalid date parameter. Should be: YYYY-MM-DD');
        return;
    }
    date = `${date} 00:00:00`;
    pool.query(`SELECT * FROM clips WHERE created_at = '${date}'`, (err, result) => {
        if (err) {
            res.status(500).send('Error retrieving messages from database: ' + err);
            return;
        }
        res.json(result.rows);
    });
})

v1TwitchRouter.get('/messages/:channel_name', (req, res) => {
    const channelName = "#".concat(req.params.channel_name.toLowerCase());
    pool.query("SELECT * FROM messages WHERE channel = $1 AND timestamp >= NOW() - INTERVAL '3 days'", [channelName], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error retrieving messages from database: ' + err);
            return;
        }

        result.rows.forEach(row => {
            row.timestamp = new Date(row.timestamp).getTime();
        });
        res.json(result.rows);
    });
});
v1TwitchRouter.get('/messages/:channel_name/since/:timestamp', (req, res) => {
    const channelName = "#".concat(req.params.channel_name.toLowerCase());
    const timestamp = new Date(parseInt(req.params.timestamp));

    pool.query('SELECT * FROM messages WHERE channel = $1 AND timestamp > $2', [channelName, timestamp], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error retrieving messages from database: ' + err);
            return;
        }

        result.rows.forEach(row => {
            row.timestamp = new Date(row.timestamp).getTime();
        });
        res.json(result.rows);
    });
});

v1TwitchRouter.post('/insertMessage', async (req, res) => {
    if (!req.get('authorization')) return res.status(403).json({ error: 'No credentials sent!' });
    if (req.get('authorization') !== API_KEY) return res.status(401).json({ error: 'Wrong credentials!' });
    try {
        if (!req.body.timestamp || !req.body.channel || !req.body.user || !req.body.content || !req.body.display_name) {
            console.log('Missing required parameters');
            res.status(400).send('Missing required parameters');
            return;
        }
        const data = {
            timestamp: new Date(req.body.timestamp * 1000).toISOString(),
            channel: req.body.channel,
            user: req.body.user,
            content: req.body.content,
            display_name: req.body.display_name
        }
        const result = await pool.query('INSERT INTO messages (timestamp, channel, "user", content, display_name) VALUES ($1, $2, $3, $4, $5)',
            [data.timestamp, data.channel, data.user, data.content, data.display_name]);

        console.log(`Inserted ${result.rowCount} rows.`);
        // post to op47.de/comms/new_message

        const options = {
            method: 'GET',
        };
        fetch('https://op47.de/comm/new_message', options);
        res.json(`Inserted ${result.rowCount} rows.`)
    } catch (err) {
        console.error(err);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
