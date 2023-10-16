## Endpoints

#### GET /v1/twitch/messages/{channel}
Channel with the \#
Timestamp in ms since epoch iirc

#### POST /v1/twitch/insertMessage
Request with req.unixTimestamp, req.channel, req.username, req.message, req.displayName in that order

#### POST /v1/insertClip
Request with req.url using a valid twitch clip link (clips.twitch.tv/...)

#### DELETE /v1/removeClip
Request with req.url using a valid twitch clip link (clips.twitch.tv/...)
