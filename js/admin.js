// ARIA 연구소 탈출 — 기록 관리 콘솔 (수정/삭제/수동 추가/CSV/초기화)
(() => {
  const body = document.getElementById("admin-body");
  const emptyMsg = document.getElementById("admin-empty");

  function esc(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function render() {
    // 완주(기록순) → 미완주 순으로 표시
    const { finished, dnf } = ARIA.getRanked();
    const teams = finished.concat(dnf);
    emptyMsg.hidden = teams.length > 0;

    body.innerHTML = teams
      .map(
        (t) => `
      <tr data-id="${t.id}">
        <td><input type="text" data-f="name" maxlength="20" value="${esc(t.name)}"></td>
        <td><input type="text" data-f="time" class="in-time" value="${ARIA.fmt(t.elapsedSec)}"></td>
        <td><input type="number" data-f="hints" min="0" max="${ARIA.HINT_MAX}" value="${t.hintCount}"></td>
        <td>
          <select data-f="finished">
            <option value="1" ${t.finished ? "selected" : ""}>완주</option>
            <option value="0" ${t.finished ? "" : "selected"}>미완주</option>
          </select>
        </td>
        <td class="col-num final">${t.finished ? ARIA.fmt(t.finalSec) : "미완주"}</td>
        <td>
          <button class="btn btn-success btn-small" data-action="save">저장</button>
          <button class="btn btn-fail btn-small" data-action="delete">삭제</button>
        </td>
      </tr>`
      )
      .join("");
  }

  body.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const row = btn.closest("tr");
    const id = row.dataset.id;
    const get = (f) => row.querySelector(`[data-f="${f}"]`);

    if (btn.dataset.action === "save") {
      const name = get("name").value.trim();
      const elapsedSec = ARIA.parseTime(get("time").value);
      if (!name) {
        alert("팀명을 입력해주세요.");
        return;
      }
      if (elapsedSec === null) {
        alert('소요시간 형식이 잘못되었습니다. "분:초" (예: 12:34) 또는 초 단위 숫자로 입력해주세요.');
        return;
      }
      ARIA.updateTeam(id, {
        name,
        elapsedSec,
        hintCount: get("hints").value,
        finished: get("finished").value === "1",
      });
      render();
    } else if (btn.dataset.action === "delete") {
      const team = ARIA.getTeams().find((t) => t.id === id);
      if (team && confirm(`[${team.name}] 기록을 삭제할까요?`)) {
        ARIA.deleteTeam(id);
        render();
      }
    }
  });

  // ---------- 수동 추가 ----------

  document.getElementById("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("add-name").value.trim();
    const elapsedSec = ARIA.parseTime(document.getElementById("add-time").value);
    if (elapsedSec === null) {
      alert('소요시간 형식이 잘못되었습니다. "분:초" (예: 12:34) 또는 초 단위 숫자로 입력해주세요.');
      return;
    }
    if (ARIA.isNameTaken(name)) {
      alert(`"${name}" 팀명은 이미 사용 중입니다.`);
      return;
    }
    ARIA.addTeam({
      name,
      elapsedSec,
      hintCount: document.getElementById("add-hints").value,
      finished: document.getElementById("add-finished").value === "1",
    });
    e.target.reset();
    render();
  });

  // ---------- CSV 내보내기 ----------

  document.getElementById("btn-export").addEventListener("click", () => {
    const { finished, dnf } = ARIA.getRanked();
    const rows = [["순위", "팀명", "소요시간", "힌트횟수", "페널티(초)", "최종기록", "완주여부"]];
    finished.forEach((t, i) => {
      rows.push([
        i + 1,
        t.name,
        ARIA.fmt(t.elapsedSec),
        t.hintCount,
        t.hintCount * ARIA.HINT_PENALTY_SEC,
        ARIA.fmt(t.finalSec),
        "완주",
      ]);
    });
    dnf.forEach((t) => {
      rows.push(["-", t.name, ARIA.fmt(t.elapsedSec), t.hintCount, t.hintCount * ARIA.HINT_PENALTY_SEC, "-", "미완주"]);
    });

    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    // BOM을 붙여야 Excel에서 한글이 깨지지 않음
    const blob = new Blob([String.fromCharCode(0xFEFF) + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    a.download = `aria-escape-결과-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- 전체 초기화 (이중 확인) ----------

  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!confirm("모든 기록과 진행 중인 타이머를 삭제할까요?\n(리허설 후 본 행사 시작 전에만 사용하세요)")) return;
    if (!confirm("정말 삭제합니다. 되돌릴 수 없습니다. 계속할까요?")) return;
    ARIA.clearAllData();
    render();
  });

  // 다른 탭(리더보드)에서 데이터가 바뀌면 즉시 반영
  window.addEventListener("storage", render);

  render();
})();
