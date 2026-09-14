(() => {
  const ROSTER_ENDPOINT = "https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-roster";

  function waitForApp() {
    try {
      if (typeof state === "undefined" || typeof api !== "function" || typeof renderGradeRows !== "function" || typeof openAssignment !== "function" || typeof sendToExtension !== "function") {
        setTimeout(waitForApp, 50);
        return;
      }
      install();
    } catch {
      setTimeout(waitForApp, 50);
    }
  }

  function roundGrade(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round((n + Number.EPSILON) * 10) / 10;
  }

  function mergeRoster(students, roster) {
    const map = new Map((roster || []).map(r => [String(r.email || "").toLowerCase(), r]));
    return (students || []).map(s => {
      const official = map.get(String(s.email || "").toLowerCase());
      if (!official) return s;
      return {
        ...s,
        firstName: official.firstName || s.firstName || "",
        lastName: official.lastName || s.lastName || "",
        rosterVerified: !!official.verified,
      };
    });
  }

  function install() {
    if (window.__cardinalV04Installed) return;
    window.__cardinalV04Installed = true;

    gradeValue = function(raw, max) {
      let text = String(raw ?? "").trim();
      if (!text) return { grade: null, text: "" };
      if (text.includes("/")) text = text.split("/")[0].trim();
      text = text.replace(/\s/g, "").replace(",", ".");
      const value = Number(text);
      if (!Number.isFinite(value)) throw new Error("Entre une note valide.");
      if (value < 0 || value > Number(max)) throw new Error(`La note doit être entre 0 et ${formatNumber(max)}.`);
      const rounded = roundGrade(value);
      return { grade: rounded, text: formatNumber(rounded, 1) };
    };

    validateMozaikGrades = function() {};

    openAssignment = async function(id) {
      const [data, rosterData] = await Promise.all([
        api(TEACHER_ENDPOINT, { action: "teacherAssignment", token: state.teacherToken, assignmentId: id }),
        api(ROSTER_ENDPOINT, { action: "get", teacherToken: state.teacherToken, assignmentId: id }).catch(() => ({ students: [] })),
      ]);

      state.currentAssignment = data.assignment;
      state.currentStudents = mergeRoster(data.students || [], rosterData.students || []);
      state.detailGroup = state.currentAssignment.groups[0] || "";

      const changed = [];
      for (const student of state.currentStudents) {
        if (student.grade === null || student.grade === undefined) continue;
        const rounded = roundGrade(student.grade);
        if (rounded === null || Number(rounded) === Number(student.grade)) continue;
        student.grade = rounded;
        changed.push(api(TEACHER_ENDPOINT, {
          action: "saveResult",
          token: state.teacherToken,
          assignmentId: state.currentAssignment.id,
          email: student.email,
          response: student.response,
          grade: rounded,
          feedback: student.feedback,
          visible: true,
        }).catch(() => null));
      }

      setTeacherSection("detail");
      fillWorkPage();
      renderGradeRows();
      await refreshSyncState();
      setTimeout(pingExtension, 100);
      if (changed.length) {
        Promise.all(changed).then(() => refreshSyncState()).catch(() => {});
      }
    };

    const originalSendToExtension = sendToExtension;
    sendToExtension = async function(payload) {
      const result = await originalSendToExtension(payload);
      if (Array.isArray(result?.roster) && result.roster.length && payload?.group?.code) {
        try {
          await api(ROSTER_ENDPOINT, {
            action: "upsert",
            teacherToken: state.teacherToken,
            groupCode: String(payload.group.code),
            students: result.roster,
          });
          const rosterMap = new Map(result.roster.map(r => [String(r.email || "").toLowerCase(), r]));
          state.currentStudents = state.currentStudents.map(s => {
            const r = rosterMap.get(String(s.email || "").toLowerCase());
            return r ? { ...s, firstName: r.firstName || s.firstName, lastName: r.lastName || s.lastName, rosterVerified: true } : s;
          });
          renderGradeRows();
        } catch {}
      }
      return result;
    };
  }

  waitForApp();
})();
