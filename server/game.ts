export type Result = "DO" | "GAE" | "GEOL" | "YUT" | "MO" | "BACKDO" | "NAK";
export type Piece = { id: string; owner: string; pos: number; finished: boolean; stackedWith: string[]; carriedBy?: string; route?: "a" | "b" };
export type StackOffer = { playerId: string; pieceId: string; hostPieceId: string; takeShortcut: boolean; resultIndex: number };
export type Player = { id: string; name: string; team: number; connected: boolean; finished: number; disconnectedAt?: number };
export type GameEvent = { id: number; kind: "roll" | "move" | "capture" | "finish" | "system"; text: string; team?: number; at: number };
export type Room = {
  code: string; hostId: string; status: "lobby" | "playing" | "finished"; mode: "solo" | "team"; practice?: boolean;
  players: Player[]; pieces: Piece[]; turn: number; pending: Result[]; extraThrows: number; events?: GameEvent[]; lastRoll?: { result: Result; sticks: boolean[]; rollId: number }; lastCapture?: { by: string; count: number; at: number }; stackOffer?: StackOffer; extra: boolean; winner?: number; rematchVotes?: string[];
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
export function restartRound(room: Room) { room.status = "playing"; room.turn = 0; room.pending = []; room.extraThrows=0; room.lastRoll = undefined; room.lastCapture = undefined; room.stackOffer = undefined; room.extra = false; room.winner = undefined; room.rematchVotes = []; room.players.forEach(p => p.finished = 0); createPieces(room); }
// -1은 출발 대기, 0은 출발·완주 칸, 1~19는 외곽이다.
const forward = (pos: number, route?: "a" | "b") => {
  if (pos === -1) return 1;
  // 마지막 외곽 칸에서는 먼저 출발·완주 칸을 밟고, 그 다음 이동에 완주한다.
  if (pos === 19) return 0;
  if (pos === 0) return 99;
  if (pos === 5) return route === "a" ? 20 : 6; if (pos === 10) return route === "b" ? 25 : 11;
  if (pos === 20) return 21; if (pos === 21) return 22; if (pos === 22) return route === "b" ? 27 : 23; if (pos === 23) return 24; if (pos === 24) return 15;
  if (pos === 25) return 26; if (pos === 26) return 22;
  if (pos === 27) return 28; if (pos === 28) return 99;
  return pos + 1;
};
const backward = (pos: number) => {
  if (pos === -1) return -1;
  // 도로 첫 칸에 나온 뒤 빽도가 나오면 출발·완주 공용 칸으로 돌아와 완주한다.
  if (pos === 1) return 99;
  if (pos === 20) return 5; if (pos === 21) return 20; if (pos === 22) return 21; if (pos === 23) return 22; if (pos === 24) return 23;
  if (pos === 25) return 10; if (pos === 26) return 25; if (pos === 27) return 22; if (pos === 28) return 27;
  return pos - 1;
};
const travel = (pos: number, steps: number, route?: "a" | "b") => { let at = pos, activeRoute = route; for (let i = 0; i < Math.abs(steps); i++) { at = steps > 0 ? forward(at, activeRoute) : backward(at); if (at === 15 || at === 99) activeRoute = undefined; if (at === 99) break; } return { to: at, route: activeRoute }; };
export function previewMove(room: Room, pieceId: string, result: Result, takeShortcut = false) { const p=room.pieces.find(x=>x.id===pieceId); if(!p)throw new Error("이동할 수 없는 말입니다."); const steps=STEPS[result]; if(!steps)throw new Error("낙은 말을 이동하지 않습니다."); if(takeShortcut&&(steps<1||![5,10,22].includes(p.pos)))throw new Error("이 위치에서는 지름길을 선택할 수 없습니다."); let route=p.route;if(steps>0&&takeShortcut)route=p.pos===5?"a":"b";if(steps>0&&p.pos===22)route=takeShortcut?"b":"a";return travel(p.pos,steps,route); }
export function move(room: Room, pieceId: string, result: Result, takeShortcut = false, stackWithId?: string) {
  const player = current(room); const p = room.pieces.find(x => x.id === pieceId);
  if (!p || p.owner !== player.id || p.finished || p.carriedBy) throw new Error("이동할 수 없는 말입니다.");
  // 출발 대기 중인 말은 1번부터 순서대로 판에 올린다. 잡혀 돌아온 말도 번호가 낮으면 먼저 다시 출발한다.
  if (p.pos === -1) {
    const firstWaiting = room.pieces.filter(x => x.owner === player.id && x.pos === -1 && !x.finished)
      .sort((a, b) => Number(a.id.slice(a.id.lastIndexOf("-") + 1)) - Number(b.id.slice(b.id.lastIndexOf("-") + 1)))[0];
    if (firstWaiting?.id !== p.id) throw new Error("대기 말은 1번부터 순서대로 출발합니다.");
  }
  const steps = STEPS[result]; if (!steps) throw new Error("낙은 말을 이동하지 않습니다.");
  // 업기 그룹은 항상 대표 말 하나에 모든 말이 직접 연결되도록 평탄화한다.
  // 이렇게 해야 ×3, ×4가 된 뒤에도 대표 말 한 번의 이동으로 전원이 함께 움직인다.
  const followers=(leaderId:string)=>room.pieces.filter(candidate=>{let carrier=candidate.carriedBy;while(carrier){if(carrier===leaderId)return true;carrier=room.pieces.find(x=>x.id===carrier)?.carriedBy}return false;});
  const group = [p, ...followers(p.id)];
  const { to, route: nextRoute } = previewMove(room,pieceId,result,takeShortcut);
  if (to === 99) { group.forEach(x => { x.finished = true; x.pos = 99; x.stackedWith = []; x.carriedBy=undefined; x.route = undefined; }); player.finished += group.length; }
  else { group.forEach(x => { x.pos = to; x.route = nextRoute; }); const enemies = room.pieces.filter(x => x.pos === to && !x.finished && x.owner !== player.id && (room.mode === "solo" || room.players.find(a => a.id === x.owner)?.team !== player.team));
    const caught = enemies.length > 0; enemies.forEach(x => { x.pos = -1; x.stackedWith = []; x.carriedBy=undefined; x.route = undefined; });
    if (caught) room.lastCapture = { by: player.id, count: enemies.length, at: Date.now() };
    const host=stackWithId&&room.pieces.find(x=>x.id===stackWithId&&x.pos===to&&!x.finished&&!x.carriedBy);
    if(host){const hostGroup=[host,...followers(host.id)],all=[...new Map([...hostGroup,...group].map(x=>[x.id,x])).values()];host.stackedWith=all.filter(x=>x.id!==host.id).map(x=>x.id);host.carriedBy=undefined;all.filter(x=>x.id!==host.id).forEach(x=>{x.stackedWith=[];x.carriedBy=host.id;x.route=nextRoute;});}
    else {const friends = room.pieces.filter(x => x.pos === to && x.owner === player.id && x.id !== p.id && !x.carriedBy && !group.some(member=>member.id===x.id));const friendGroups=friends.flatMap(friend=>[friend,...followers(friend.id)]),stacked=[...new Map([...group,...friendGroups].map(x=>[x.id,x])).values()];p.stackedWith=stacked.filter(x=>x.id!==p.id).map(x=>x.id);p.carriedBy=undefined;stacked.filter(x=>x.id!==p.id).forEach(x=>{x.stackedWith=[];x.carriedBy=p.id;x.route=nextRoute;});}
    if (caught) room.extra = true;
  }
  const target = room.mode === "team" ? room.players.filter(x => x.team === player.team).reduce((n,x)=>n+x.finished,0) : player.finished;
  if (target >= (room.mode === "team" ? room.players.filter(x=>x.team===player.team).length * 4 : 4)) { room.status = "finished"; room.winner = room.mode === "team" ? player.team : room.players.findIndex(x=>x.id===player.id); return; }
  // 턴과 추가 던지기 처리는 서버가 누적 결과를 모두 고려해 결정한다.
}
