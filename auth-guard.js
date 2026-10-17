(() => {
  const idleTimeoutMs = 15 * 60 * 1000;
  const activityStorageKey = "authLastActivityAt";
  const page = window.location.pathname.split("/").pop();
  if (page === "" || page === "index.html") return;

  document.documentElement.style.visibility = "hidden";
  const readSession = () => {
    let session;
    try {
      session = JSON.parse(localStorage.getItem("authenticatedSession") || "null");
    } catch (error) {
      console.error("Unable to read the login session:", error);
      return null;
    }
    const username = localStorage.getItem("username");
    const role = localStorage.getItem("role");
    const companyid = localStorage.getItem("companyid");
    const uid = localStorage.getItem("uid");
    const lastActivityAt = Number(localStorage.getItem(activityStorageKey) || 0);
    if (
      !session ||
      session.username !== username ||
      session.role !== role ||
      session.companyid !== companyid ||
      session.uid !== uid ||
      !["admins", "workers"].includes(role) ||
      !username ||
      !companyid ||
      !uid ||
      !lastActivityAt ||
      Date.now() - lastActivityAt >= idleTimeoutMs
    ) {
      return null;
    }
    return true;
  };
  window.hasAuthenticatedSession = readSession;

  let logoutTimer;
  const redirectToLogin = () => {
    window.clearTimeout(logoutTimer);
    [
      "username",
      "role",
      "companyid",
      "uid",
      "authUid",
      "authLastActivityAt",
      "authenticatedSession",
    ].forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem("postLoginRedirect");
    window.location.replace("index.html");
  };

  if (!readSession()) {
    sessionStorage.setItem(
      "postLoginRedirect",
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    redirectToLogin();
    return;
  }

  const scheduleLogout = () => {
    window.clearTimeout(logoutTimer);
    const lastActivityAt = Number(localStorage.getItem(activityStorageKey) || 0);
    const remaining = idleTimeoutMs - (Date.now() - lastActivityAt);
    if (remaining <= 0) {
      redirectToLogin();
      return;
    }
    logoutTimer = window.setTimeout(redirectToLogin, remaining);
  };

  let lastActivityWrite = 0;
  const recordActivity = () => {
    if (!readSession()) {
      redirectToLogin();
      return;
    }
    const now = Date.now();
    if (now - lastActivityWrite >= 30000) {
      localStorage.setItem(activityStorageKey, String(now));
      lastActivityWrite = now;
    }
    scheduleLogout();
  };

  ["click", "keydown", "pointerdown", "scroll", "touchstart"].forEach((type) =>
    document.addEventListener(type, recordActivity, { passive: true }),
  );
  window.addEventListener("storage", (event) => {
    if (
      event.key === null ||
      ["username", "role", "companyid", "uid", "authenticatedSession"].includes(event.key)
    ) {
      if (!readSession()) redirectToLogin();
    }
    if (event.key === activityStorageKey && readSession()) scheduleLogout();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (!readSession()) redirectToLogin();
      else scheduleLogout();
    }
  });
  window.addEventListener("pageshow", () => {
    if (!readSession()) redirectToLogin();
    else scheduleLogout();
  });
  scheduleLogout();
  document.documentElement.style.visibility = "";
})();
