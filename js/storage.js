// ARIA 연구소 탈출 — 데이터 저장 모듈 (LocalStorage)
// 완료 기록: "aria-teams" / 진행 중 세션: "aria-sessions"
const ARIA = (() => {
  const TEAMS_KEY = "aria-teams";
  const SESSIONS_KEY = "aria-sessions";
  const HINT_PENALTY_SEC = 30;
  const HINT_MAX = 6;
  const TIME_LIMIT_SEC = 15 * 60;

  function load(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalize(name) {
    return String(name).trim().replace(/\s+/g, " ");
  }

  // ---------- 완료 기록 ----------

  function getTeams() {
    return load(TEAMS_KEY);
  }

  function addTeam({ name, elapsedSec, hintCount, finished }) {
    const teams = getTeams();
    const record = {
      id: uid(),
      name: normalize(name),
      elapsedSec: Math.max(0, Math.round(elapsedSec)),
      hintCount: clampHint(hintCount),
      finished: !!finished,
      timestamp: Date.now(),
    };
    record.finalSec = record.elapsedSec + record.hintCount * HINT_PENALTY_SEC;
    teams.push(record);
    save(TEAMS_KEY, teams);
    return record;
  }

  function updateTeam(id, fields) {
    const teams = getTeams();
    const team = teams.find((t) => t.id === id);
    if (!team) return null;
    if (fields.name !== undefined) team.name = normalize(fields.name);
    if (fields.elapsedSec !== undefined) team.elapsedSec = Math.max(0, Math.round(fields.elapsedSec));
    if (fields.hintCount !== undefined) team.hintCount = clampHint(fields.hintCount);
    if (fields.finished !== undefined) team.finished = !!fields.finished;
    team.finalSec = team.elapsedSec + team.hintCount * HINT_PENALTY_SEC;
    save(TEAMS_KEY, teams);
    return team;
  }

  function deleteTeam(id) {
    save(TEAMS_KEY, getTeams().filter((t) => t.id !== id));
  }

  function clearAllData() {
    localStorage.removeItem(TEAMS_KEY);
    localStorage.removeItem(SESSIONS_KEY);
  }

  // 완주 팀은 최종기록 오름차순, 미완주 팀은 별도 배열로 반환
  function getRanked() {
    const teams = getTeams();
    const finished = teams
      .filter((t) => t.finished)
      .sort((a, b) => a.finalSec - b.finalSec || a.timestamp - b.timestamp);
    const dnf = teams
      .filter((t) => !t.finished)
      .sort((a, b) => a.timestamp - b.timestamp);
    return { finished, dnf };
  }

  // ---------- 진행 중 세션 ----------

  function getSessions() {
    return load(SESSIONS_KEY);
  }

  function startSession(name) {
    const sessions = getSessions();
    const session = { id: uid(), name: normalize(name), startEpochMs: Date.now(), hintCount: 0 };
    sessions.push(session);
    save(SESSIONS_KEY, sessions);
    return session;
  }

  function addHint(sessionId) {
    const sessions = getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || session.hintCount >= HINT_MAX) return session || null;
    session.hintCount += 1;
    save(SESSIONS_KEY, sessions);
    return session;
  }

  // 세션 종료 → 완료 기록으로 이동
  function endSession(sessionId, finished) {
    const sessions = getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    const elapsedSec = Math.round((Date.now() - session.startEpochMs) / 1000);
    save(SESSIONS_KEY, sessions.filter((s) => s.id !== sessionId));
    return addTeam({
      name: session.name,
      elapsedSec,
      hintCount: session.hintCount,
      finished,
    });
  }

  function isNameTaken(name) {
    const key = normalize(name).toLowerCase();
    return (
      getSessions().some((s) => s.name.toLowerCase() === key) ||
      getTeams().some((t) => t.name.toLowerCase() === key)
    );
  }

  // ---------- 유틸 ----------

  function clampHint(n) {
    return Math.min(HINT_MAX, Math.max(0, Math.round(Number(n) || 0)));
  }

  // 초 → "MM:SS"
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  // "MM:SS" 또는 초 숫자 → 초 (실패 시 null)
  function parseTime(text) {
    text = String(text).trim();
    if (/^\d+$/.test(text)) return parseInt(text, 10);
    const m = text.match(/^(\d{1,3}):([0-5]?\d)$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  return {
    HINT_PENALTY_SEC,
    HINT_MAX,
    TIME_LIMIT_SEC,
    getTeams,
    addTeam,
    updateTeam,
    deleteTeam,
    clearAllData,
    getRanked,
    getSessions,
    startSession,
    addHint,
    endSession,
    isNameTaken,
    fmt,
    parseTime,
  };
})();
