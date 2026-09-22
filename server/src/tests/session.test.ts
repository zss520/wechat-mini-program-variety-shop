import { shouldAttemptSilentLogin } from "../../../miniprogram/utils/session";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(shouldAttemptSilentLogin(false, false) === true, "fresh visit can restore");
  assert(shouldAttemptSilentLogin(false, true) === false, "existing session is not restored again");
  assert(shouldAttemptSilentLogin(true, false) === false, "manual logout blocks silent login");
  assert(shouldAttemptSilentLogin(true, true) === false, "logout flag wins even if a token remains");
  console.log("session tests passed");
}

run();
