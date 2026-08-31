const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
const TEAM_SIZE = 5;
const MATCH_MS = 13 * 60 * 1000;
const KILL_LIMIT = 50;

const waiting = [];
const matches = new Map();
const players = new Map();

function send(ws, type, data={}) {
  if (ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({type, ...data}));
}

function broadcast(match, type, data={}) {
  for (const p of match.players.values()) send(p.ws, type, data);
}

function makeMatch() {
  if (waiting.length < MAX_PLAYERS) return;

  const selected = waiting.splice(0, MAX_PLAYERS);
  const id = crypto.randomUUID();
  const match = {
    id, players: new Map(), kills: [0,0], startedAt: Date.now(),
    endsAt: Date.now() + MATCH_MS, status: "running",
    weather: ["clear","cloudy","rain","fog","wind"][Math.floor(Math.random()*5)]
  };

  selected.forEach((p, i) => {
    p.matchId = id;
    p.team = i < TEAM_SIZE ? 0 : 1;
    p.x = p.team === 0 ? -120 : 120;
    p.y = 0;
    p.z = 0;
    match.players.set(p.id, p);
    players.set(p.id, p);
  });

  matches.set(id, match);
  broadcast(match, "match_start", {
    matchId: id, durationSec: 780, killLimit: KILL_LIMIT,
    weather: match.weather,
    arena: {width: 350, depth: 350},
    spawns: {teamA: [-120,0,0], teamB: [120,0,0]}
  });
}

function finish(match, reason) {
  if (match.status !== "running") return;
  match.status = "finished";
  const winner = match.kills[0] === match.kills[1] ? -1 :
    (match.kills[0] > match.kills[1] ? 0 : 1);

  broadcast(match, "match_end", {
    reason, winner, kills: match.kills,
    xp: winner === -1 ? 250 : 500
  });

  setTimeout(() => {
    for (const p of match.players.values()) {
      players.delete(p.id);
      if (p.ws.readyState === WebSocket.OPEN) send(p.ws, "return_lobby");
    }
    matches.delete(match.id);
  }, 3000);
}

function tick() {
  const now = Date.now();
  for (const match of matches.values()) {
    if (match.status !== "running") continue;
    if (now >= match.endsAt) finish(match, "time");
  }
}
setInterval(tick, 250);

const server = http.createServer((req,res) => {
  res.writeHead(200, {"content-type":"application/json"});
  res.end(JSON.stringify({
    name:"O'zbekistonda Hayot Arena Server",
    status:"online",
    mode:"5v5",
    arena:"350x350m",
    players: players.size,
    matches: matches.size
  }));
});

const wss = new WebSocket.Server({server});
wss.on("connection", ws => {
  const id = crypto.randomUUID();
  const p = {id, ws, matchId:null, team:null, x:0,y:0,z:0, kills:0};
  players.set(id,p);
  send(ws,"connected",{playerId:id});

  ws.on("message", raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }

    if (m.type === "queue") {
      if (!waiting.find(x => x.id === id)) waiting.push(p);
      send(ws,"queued",{position:waiting.findIndex(x=>x.id===id)+1});
      makeMatch();
      return;
    }

    if (m.type === "move" && p.matchId) {
      const match = matches.get(p.matchId);
      if (!match || match.status !== "running") return;
      p.x = Number(m.x)||0; p.y=Number(m.y)||0; p.z=Number(m.z)||0;
      broadcast(match,"player_move",{playerId:id,x:p.x,y:p.y,z:p.z});
      return;
    }

    if (m.type === "kill" && p.matchId) {
      const match = matches.get(p.matchId);
      if (!match || match.status !== "running") return;
      match.kills[p.team]++;
      p.kills++;
      broadcast(match,"score",{kills:match.kills,playerId:id});
      if (match.kills[p.team] >= KILL_LIMIT)
        finish(match,"kill_limit");
      return;
    }

    if (m.type === "leave") {
      if (p.matchId) {
        const match = matches.get(p.matchId);
        if (match) match.players.delete(id);
      }
      p.matchId=null; p.team=null;
    }
  });

  ws.on("close", () => {
    const i = waiting.findIndex(x=>x.id===id);
    if (i >= 0) waiting.splice(i,1);
    if (p.matchId) {
      const match = matches.get(p.matchId);
      if (match) match.players.delete(id);
    }
    players.delete(id);
  });
});

server.listen(PORT, () => console.log(`Arena server listening on ${PORT}`));
