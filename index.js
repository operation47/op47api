import express from 'express';
import pg from 'pg';

const port = process.env.PORT || 2001;
const API_KEY = 'thgp673DPP3hFJHoTMMS!s4hRhgxLtN@';

const app = express();
const v1Router = express.Router();
const v1TwitchRouter = express.Router();

// Use JSON Middleware for Express to process JSON
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

// Add general Authorization by Header
v1TwitchRouter.use((req, res, next) => {
    if (!req.get('authorization')) {
        return res.status(403).json({ error: 'No credentials sent!' });
    } else if (req.get('authorization') !== API_KEY) {
        return res.status(401).json({ error: 'Wrong credentials!' });
    }
    return next();
});

v1TwitchRouter.get('/messages/:channel_name', (req, res) => {
    const channelName = "#".concat(req.params.channel_name.toLowerCase());
    pool.query('SELECT *, EXTRACT(EPOCH FROM timestamp) AS timestamp FROM messages WHERE channel = $1', [channelName], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error retrieving messages from database: ' + err);
            return;
        } else {
            res.json(result.rows);
        }
    });
});

v1TwitchRouter.post('/insertMessage', async (req, res) => {
    try {
        console.log(req.body);
        if (!req.body.timestamp || !req.body.channel || !req.body.user || !req.body.content || !req.body.display_name) {
            console.log('Missing required parameters');
            res.status(400).send('Missing required parameters');
            return;
        }
        const data = {
            timestamp: req.body.timestamp,
            channel: req.body.channel,
            user: req.body.user,
            content: req.body.content,
            display_name: req.body.display_name
        }
        const result = await pool.query('INSERT INTO messages (timestamp, channel, "user", content, display_name) VALUES (TO_TIMESTAMP($1), $2, $3, $4, $5)',
            [data.timestamp, data.channel, data.user, data.content, data.displayName]);

        console.log(`Inserted ${result.rowCount} rows.`);
        res.json(`Inserted ${result.rowCount} rows.`)
    } catch (err) {
        console.error(err);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
