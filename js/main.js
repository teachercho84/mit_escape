// ARIA 연구소 탈출 — 메인 화면 (입장 / 동시 타이머 / 리더보드)
(() => {
  const $ = (sel) => document.querySelector(sel);
  const entryForm = $("#entry-form");
  const entryName = $("#entry-name");
  const activePanel = $("#active-panel");
  const cardsEl = $("#session-cards");
  const layout = $("#layout");

  function esc(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ---------- 입장 ----------

  entryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = entryName.value.trim();
    if (!name) return;
    if (ARIA.isNameTaken(name)) {
      alert(`"${name}" 팀명은 이미 사용 중입니다. 다른 이름을 입력해주세요.`);
      entryName.select();
      return;
    }
    ARIA.startSession(name);
    entryName.value = "";
    renderSessions();
    renderStats();
  });

  // ---------- 진행 중 타이머 카드 ----------

  function renderSessions() {
    const sessions = ARIA.getSessions();
    activePanel.hidden = sessions.length === 0;

    cardsEl.innerHTML = sessions
      .map((s) => {
        const penalty = s.hintCount * ARIA.HINT_PENALTY_SEC;
        return `
        <div class="session-card" data-id="${s.id}">
          <div class="session-name">${esc(s.name)}</div>
          <div class="session-timer" data-timer>00:00</div>
          <div class="session-hints">힌트 <b data-hints>${s.hintCount}</b>/${ARIA.HINT_MAX}회
            <span class="penalty" data-penalty ${penalty ? "" : "hidden"}>(+${penalty}초)</span>
          </div>
          <div class="session-actions">
            <button class="btn btn-hint" data-action="hint">힌트 +1</button>
            <button class="btn btn-success" data-action="finish">탈출 성공</button>
            <button class="btn btn-fail" data-action="dnf">미완주</button>
          </div>
        </div>`;
      })
      .join("");
    tick();
  }

  cardsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const card = btn.closest(".session-card");
    const id = card.dataset.id;
    const session = ARIA.getSessions().find((s) => s.id === id);
    if (!session) return;

    const action = btn.dataset.action;
    if (action === "hint") {
      if (session.hintCount >= ARIA.HINT_MAX) {
        alert("힌트는 최대 " + ARIA.HINT_MAX + "회까지 사용할 수 있습니다.");
        return;
      }
      ARIA.addHint(id);
      renderSessions();
    } else if (action === "finish") {
      if (confirm(`[${session.name}] 팀 탈출 성공 처리할까요?\n기록이 확정되어 리더보드에 등록됩니다.`)) {
        ARIA.endSession(id, true);
        renderSessions();
        renderBoard();
        renderStats();
      }
    } else if (action === "dnf") {
      if (confirm(`[${session.name}] 팀을 미완주 처리할까요?\n리더보드 하단에 별도 표시됩니다.`)) {
        ARIA.endSession(id, false);
        renderSessions();
        renderBoard();
        renderStats();
      }
    }
  });

  // 타이머 갱신 — Date.now() 기반이라 새로고침/백그라운드에도 정확
  function tick() {
    const sessions = ARIA.getSessions();
    const now = Date.now();
    document.querySelectorAll(".session-card").forEach((card) => {
      const session = sessions.find((s) => s.id === card.dataset.id);
      if (!session) return;
      const elapsed = Math.floor((now - session.startEpochMs) / 1000);
      card.querySelector("[data-timer]").textContent = ARIA.fmt(elapsed);
      card.classList.toggle("overtime", elapsed > ARIA.TIME_LIMIT_SEC);
    });
  }

  // ---------- 통계 바 + 미션 브리핑 ----------

  function renderStats() {
    const { finished, dnf } = ARIA.getRanked();
    const sessions = ARIA.getSessions();
    const total = finished.length + dnf.length + sessions.length;
    const concluded = finished.length + dnf.length;

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-success").textContent = finished.length;

    if (concluded > 0) {
      document.getElementById("stat-rate").textContent = Math.round(finished.length / concluded * 100);
      document.getElementById("stat-rate-pct").textContent = "%";
    } else {
      document.getElementById("stat-rate").textContent = "—";
      document.getElementById("stat-rate-pct").textContent = "";
    }

    document.getElementById("stat-best").textContent =
      finished.length > 0 ? ARIA.fmt(finished[0].finalSec) : "--:--";

    const hasAnyData = sessions.length > 0 || finished.length > 0 || dnf.length > 0;
    layout.classList.toggle("with-active", sessions.length > 0);
  }

  // ---------- 리더보드 ----------

  function renderBoard() {
    const { finished, dnf } = ARIA.getRanked();
    const body = $("#board-finished-body");
    const medals = ["gold", "silver", "bronze"];

    body.innerHTML = finished
      .map((t, i) => {
        const medal = i < 3 ? ` class="rank-${medals[i]}"` : "";
        return `
        <tr${medal}>
          <td class="col-rank"><span class="rank-badge">${i + 1}</span></td>
          <td>${esc(t.name)}</td>
          <td class="col-num">${ARIA.fmt(t.elapsedSec)}</td>
          <td class="col-num">${t.hintCount}회</td>
          <td class="col-num final">${ARIA.fmt(t.finalSec)}</td>
        </tr>`;
      })
      .join("");
    $("#empty-finished").hidden = finished.length > 0;

    const dnfSection = $("#dnf-section");
    dnfSection.hidden = dnf.length === 0;
    $("#board-dnf-body").innerHTML = dnf
      .map(
        (t) => `
        <tr>
          <td class="col-rank">—</td>
          <td>${esc(t.name)}</td>
          <td class="col-num">${ARIA.fmt(t.elapsedSec)}</td>
          <td class="col-num">${t.hintCount}회</td>
          <td class="col-num">미완주</td>
        </tr>`
      )
      .join("");
  }

  // ---------- 뽑기 현황 ----------

  function renderLottery() {
    document.getElementById("lottery-prizes").innerHTML = ARIA.getLottery()
      .map((p) => `
        <div class="lottery-chip${p.remaining === 0 ? " sold-out" : ""}">
          <span class="lottery-rank">${p.rank}</span>
          <div class="lottery-remain">
            <span class="lottery-num">${p.remaining}</span>
            <span class="lottery-denom">/ ${p.total}명</span>
          </div>
          <button class="btn btn-claim" data-rank="${p.rank}"
            ${p.remaining === 0 ? "disabled" : ""}>당첨</button>
        </div>`)
      .join("");
  }

  document.getElementById("lottery-prizes").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-claim");
    if (!btn || btn.disabled) return;
    const rank = btn.dataset.rank;
    if (confirm(`${rank} 당첨자가 나왔나요?\n잔여 인원을 1명 줄입니다.`)) {
      ARIA.claimPrize(rank);
      renderLottery();
    }
  });

  document.getElementById("btn-lottery-reset").addEventListener("click", () => {
    if (confirm("뽑기 현황을 초기 인원으로 되돌리시겠습니까?")) {
      ARIA.resetLottery();
      renderLottery();
    }
  });

  // 다른 탭(admin.html)에서 데이터가 바뀌면 즉시 반영
  window.addEventListener("storage", () => {
    renderSessions();
    renderBoard();
    renderStats();
    renderLottery();
  });

  setInterval(tick, 250);
  renderSessions();
  renderBoard();
  renderStats();
  renderLottery();
})();
