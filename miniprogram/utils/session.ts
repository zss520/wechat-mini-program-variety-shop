/** 用户主动退出后，不要再用 wx.login 把会话立刻登回来。 */
export function shouldAttemptSilentLogin(manualLogout: boolean, loggedIn: boolean) {
  if (loggedIn) return false;
  if (manualLogout) return false;
  return true;
}
