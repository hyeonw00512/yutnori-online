export type Result = "DO" | "GAE" | "GEOL" | "YUT" | "MO" | "BACKDO" | "NAK";
export type Piece = { id: string; owner: string; pos: number; finished: boolean; stackedWith: string[]; route?: "a" | "b" };
export type Player = { id: string; name: string; team: number; connected: boolean; finished: number; disconnectedAt?: number };
export type Room = {
  code: string; hostId: string; status: "lobby" | "playing" | "finished"; mode: "solo" | "team"; practice?: boolean;
  players: Player[]; pieces: Piece[]; turn: number; pending: Result[]; lastRoll?: { result: Result; sticks: boolean[]; rollId: number }; extra: boolean; winner?: number; rematchVotes?: string[];
};

export const STEPS: Record<Result, number> = { DO: 1, GAE: 2, GEOL: 3, YUT: 4, MO: 5, BACKDO: -1, NAK: 0 };
const weights: Result[] = ["DO", "DO", "DO", "GAE", "GAE", "GAE", "GEOL", "GEOL", "YUT", "MO", "BACKDO", "NAK"];
export const roll = (): { result: Result; sticks: boolean[] } => {
  const result = weights[Math.floor(Math.random() * weights.length)];
  if (result === "NAK") return { result, sticks: [true, false, true, false] };
  // 0번은 X가 새겨진 '빽도 윷'이다. 빽도일 때만 이 윷의 뒷면이 위로 온다.
  if (result === "BACKDO") return { result, sticks: [false, true, true, true] };
  // true는 둥근 앞면, false는 평평한 뒷면이다. 걸은 뒷면 3개, 윷은 뒷면 4개다.
  const faces: Record<Exclude<Result, "BACKDO" | "NAK">, boolean[]> = {
    DO: [true, false, true, true], GAE: [true, false, false, true], GEOL: [true, false, false, false],
    YUT: [false, false, false, false], MO: [true, true, true, true]
  };
  return { result, sticks: faces[result] };
};
export const current = (room: Room) => room.players[room.turn];
export function createPieces(room: Room) { room.pieces = room.players.flatMap(p => Array.from({ length: 4 }, (_, n) => ({ id: `${p.id}-${n}`, owner: p.id, pos: -1, finished: false, stackedWith: [] }))); }
export function restartRound(room: Room) { room.status = "playing"; room.turn = 0; room.pending = []; room.lastRoll = undefined; room.extra = false; room.winner = undefined; room.rematchVotes = []; room.players.forEach(p => p.finished = 0); createPieces(room); }
// -1은 출발/완주 공용 칸이며 1~19는 외곽이다. 빽도 첫 이동은 19번 칸으로 간다.
const forward = (pos: number, route?: "a" | "b") => {
  if (pos === -1) return 1;
  if (pos === 19) return 99;
  if (pos === 5) return route === "a" ? 20 : 6; if (pos === 10) return route === "b" ? 25 : 11;
  if (pos === 20) return 21; if (pos === 21) return 22; if (pos === 22) return route === "b" ? 27 : 23; if (pos === 23) return 24; if (pos === 24) return 15;
  if (pos === 25) return 26; if (pos === 26) return 22;
  if (pos === 27) return 28; if (pos === 28) return 99;
  return pos + 1;
};
const backward = (pos: number) => {
  if (pos === -1) return 19;
  if (pos === 1) return -1;
  if (pos === 20) return 5; if (pos === 21) return 20; if (pos === 22) return 21; if (pos === 23) return 22; if (pos === 24) return 23;
  if (pos === 25) return 10; if (pos === 26) return 25; if (pos === 27) return 22; if (pos === 28) return 27;
  return pos - 1;
};
const travel = (pos: number, steps: number, route?: "a" | "b") => { let at = pos, activeRoute = route; for (let i = 0; i < Math.abs(steps); i++) { at = steps > 0 ? forward(at, activeRoute) : backward(at); if (at === 15 || at === 99) activeRoute = undefined; if (at === 99) break; } return { to: at, route: activeRoute }; };
export function move(room: Room, pieceId: string, result: Result, takeShortcut = false) {
  const player = current(room); const p = room.pieces.find(x => x.id === pieceId);
  if (!p || p.owner !== player.id || p.finished) throw new Error("이동할 수 없는 말입니다.");
  // 출발 대기 중인 말은 1번부터 순서대로 판에 올린다. 잡혀 돌아온 말도 번호가 낮으면 먼저 다시 출발한다.
  if (p.pos === -1) {
    const firstWaiting = room.pieces.filter(x => x.owner === player.id && x.pos === -1 && !x.finished)
      .sort((a, b) => Number(a.id.slice(a.id.lastIndexOf("-") + 1)) - Number(b.id.slice(b.id.lastIndexOf("-") + 1)))[0];
    if (firstWaiting?.id !== p.id) throw new Error("대기 말은 1번부터 순서대로 출발합니다.");
  }
  const steps = STEPS[result]; if (!steps) throw new Error("낙은 말을 이동하지 않습니다.");
  if (takeShortcut && (steps < 1 || ![5, 10, 22].includes(p.pos))) throw new Error("이 위치에서는 지름길을 선택할 수 없습니다.");
  const group = [p, ...room.pieces.filter(x => p.stackedWith.includes(x.id))];
  let route = p.route;
  if (steps > 0 && takeShortcut) route = p.pos === 5 ? "a" : "b";
  if (steps > 0 && p.pos === 22) route = takeShortcut ? "b" : "a";
  const { to, route: nextRoute } = travel(p.pos, steps, route);
  if (to === 99) { group.forEach(x => { x.finished = true; x.pos = 99; x.stackedWith = []; x.route = undefined; }); player.finished += group.length; }
  else { group.forEach(x => { x.pos = to; x.route = nextRoute; }); const enemies = room.pieces.filter(x => x.pos === to && !x.finished && x.owner !== player.id && (room.mode === "solo" || room.players.find(a => a.id === x.owner)?.team !== player.team));
    const caught = enemies.length > 0; enemies.forEach(x => { x.pos = -1; x.stackedWith = []; x.route = undefined; });
    const friends = room.pieces.filter(x => x.pos === to && x.owner === player.id && x.id !== p.id);
    // 같은 칸의 내 말은 어느 말을 눌러도 함께 움직이도록 양방향으로 연결한다.
    const stacked = [...new Map([...group, ...friends].map(x => [x.id, x])).values()];
    stacked.forEach(x => { x.stackedWith = stacked.filter(y => y.id !== x.id).map(y => y.id); x.route = nextRoute; });
    if (caught) room.extra = true;
  }
  const target = room.mode === "team" ? room.players.filter(x => x.team === player.team).reduce((n,x)=>n+x.finished,0) : player.finished;
  if (target >= (room.mode === "team" ? room.players.filter(x=>x.team===player.team).length * 4 : 4)) { room.status = "finished"; room.winner = room.mode === "team" ? player.team : room.players.findIndex(x=>x.id===player.id); return; }
  room.extra ||= result === "YUT" || result === "MO";
  if (!room.extra) room.turn = (room.turn + 1) % room.players.length;
  room.extra = false;
}
