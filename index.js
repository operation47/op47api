import express, { json } from 'express';
import pg from 'pg';
import cors from 'cors';

const port = process.env.PORT || 2001;
const API_KEY = process.env.API_KEY;

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

v1TwitchRouter.get('/messages/:channel_name', (req, res) => {
    const channelName = "#".concat(req.params.channel_name.toLowerCase());
    pool.query('SELECT * FROM messages WHERE channel = $1', [channelName], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error retrieving messages from database: ' + err);
            return;
        }
        console.log(JSON.stringify(result.rows, null, 2));
        for (const row in result.rows) {
            console.log("row: ", JSON.stringify(row, null, 2));
        }
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
            timestamp: new Date(req.body.timestamp).toISOString(),
            channel: req.body.channel,
            user: req.body.user,
            content: req.body.content,
            display_name: req.body.display_name
        }
        const result = await pool.query('INSERT INTO messages (timestamp, channel, "user", content, display_name) VALUES ($1, $2, $3, $4, $5)',
            [data.timestamp, data.channel, data.user, data.content, data.display_name]);

        console.log(`Inserted ${result.rowCount} rows.`);
        res.json(`Inserted ${result.rowCount} rows.`)
    } catch (err) {
        console.error(err);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
