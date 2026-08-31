# V40 Arena Online - Railway

Bu server V40 Arena 5v5 uchun boshlang'ich real-time WebSocket backend.

## Railway deploy
1. `server` papkasini GitHub repositoryga joylang.
2. Railway -> New Project -> Deploy from GitHub Repo.
3. Root Directory sifatida `server` ni tanlang.
4. Start command: `npm start`
5. Railway `PORT` environment variable orqali portni beradi.

## Test
Deploydan keyin Railway domenini brauzerda oching. JSON status chiqsa server ishlayapti.

WebSocket manzil:
`wss://YOUR-RAILWAY-DOMAIN`

## Protokol
Client:
- `{"type":"queue"}` -> matchmaking
- `{"type":"move","x":0,"y":0,"z":0}` -> pozitsiya
- `{"type":"kill"}` -> test kill

Server:
- `connected`
- `queued`
- `match_start`
- `player_move`
- `score`
- `match_end`
- `return_lobby`

## Match qoidalari
- 5v5
- 10 player to'lganda match boshlanadi
- 13 daqiqa
- 50 team kill limit
- 350x350m arena
- random weather
