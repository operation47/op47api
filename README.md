# op47 REST API

## Base URL

`https://api.op47.de`

## Authorization

Some of the API requests require the use of an API Key.\
Currently no API Keys are given out.

## Endpoints

### Retrieve messages

###### (Only works for logged channels.)

To get all messages in a channel use this endpoint. A time can be specified so only messages that were posted to that channel after the given time will be returned.

**Variants**:

```http
GET /v1/twitch/messages/{channel}
```

```http
GET /v1/twitch/messages/{channel}/since/{timestamp}
```

**URL Parameters**:

| Parameter | Description |
| - | - |
| `channel` | **Required**. Specify the channel using  `#{channel}` format. |
| `timestamp` | **Optional**. UNIX-timestamp in milliseconds since epoch. |

**Example response**:

```javascript
[
    {
        "id":1,
        "timestamp":1697051732000,
        "channel":"#some_channel",
        "user":"some_user",
        "content":"This is a message.",
        "display_name":"Some User"
    },
    {
        "id":38,
        "timestamp":1697695401,
        "channel":"#some_channel",
        "user":"another-user",
        "content":"This is another message.",
        "display_name":"AnotherUser"
    }
]
```

### Log new message

Used to log a new message to the service. Only available with Authorization.

```http
POST /v1/twitch/insertMessage
```

**Headers**:

| Header | Description |
| - | - |
| `Authorization` | **Required**. Op47 API Key

**Body Parameters**:

| Parameter | Description |
| - | - |
| `timestamp` | **Required**. UNIX-timestamp in milliseconds since epoch. |
| `channel` | **Required**. Name of the channel the message was posted to in `#{channel}` format. |
| `user` |  **Required**. Name of the user that posted the message. |
| `content` | **Required**. The content of the message itself.|
| `display_name` | **Required**. The user's Display Name on Twitch (has to be specified even if it's the same as the user name). |

### Retrieve Twitch Clips

Use this to get the logged clips that were created on a specified date.

```http
GET /v1/clips/{date}
```

**URL Parameters**:

| Parameter | Description |
| - | - |
| `date` | **Required**. ISO Date (YYYY-MM-DD) or just `today`.|

**Example response**:

```js
[
    {
        "id":23,
        "created_at":"2023-10-18T00:00:00.000Z",
        "url":"https://clips.twitch.tv/someClipID",
        "title":"A Nice Title",
        "channel":"some_channel",
        "creator_name":"some_user"
    }
]
```

### Log new Twitch Clip

Used to log a new Clip to the service. Only available with Authorization.

```http
POST /v1/insertClip
```

**Headers**:

| Header | Description |
| - | - |
| `Authorization` | **Required**. Op47 API Key

**Body Parameters**:

| Parameter | Description |
| - | - |
| `url` | **Required**. Valid link to a Twitch Clip. Must either be _twitch.tv/channel/clip/clipID_ or _clips.twitch.tv/clipID_ . |

### Remove Twitch Clip

Used to remove an existing Twitch Clip from the service. Only available with Authorization.

```http
DELETE /v1/removeClip
```

**Headers**:

| Header | Description |
| - | - |
| `Authorization` | **Required**. Op47 API Key

**Body Parameters**:

| Parameter | Description |
| - | - |
| `url` | **Required**. Valid link to a Twitch Clip that is currently logged. Must either be _twitch.tv/channel/clip/clipID_ or _clips.twitch.tv/clipID_ . |
