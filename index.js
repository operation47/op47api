import express from 'express';
import pg from 'pg';

const port = process.env.PORT || 2001;

const app = express();
app.use(express.json())
const v1Router = express.Router();
const v1TwitchRouter = express.Router();

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
        if (!req.body.timestamp || !req.body.channel || !req.body.user || !req.body.content || !req.body.display_name) {
            console.log("something is missing");
            res.status(400).send('Missing required parameters');
            return;
        }
        const data = {
            timestamp: req.body.unixTimestamp,
            channel: req.body.channel,
            user: req.body.username,
            content: req.body.message,
            displayName: req.body.displayName
        }
        const result = await pool.query('INSERT INTO messages (timestamp, channel, "user", content, display_name) VALUES (TO_TIMESTAMP($1), $2, $3, $4, $5)',
            [data.timestamp, data.channel, data.user, data.content, data.displayName]);

        consol.log(`Inserted ${result.rowCount} rows.`);
        res.json(`Inserted ${result.rowCount} rows.`)
    } catch (err) {
        console.error(err);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
