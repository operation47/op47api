## Endpoints

#### GET /v1/twitch/messages/{channel}
Channel without the \#
Timestamp in ms since epoch iirc

#### POST /v1/twitch/insertMessage
Request with req.unixTimestamp, req.channel, req.username, req.message, req.displayName in that order
