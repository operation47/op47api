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
        res = await dbClient.query('INSERT INTO messages (timestamp, channel, "user", content, display_name) VALUES (TO_TIMESTAMP($1), $2, $3, $4, $5)',
            [req.body.unixTimestamp, req.body.channel, req.body.username, req.body.message, req.body.displayName]);

        res.json(`Inserted ${res.rowCount} rows.`)
    } catch (err) {
        console.error(err);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
