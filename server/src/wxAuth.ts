import { db } from "./db";
import { publicUrl } from "./config";
import { HttpError } from "./http";
import { signToken } from "./auth";
import { code2session, getWxPhone } from "./wechat";

export type PublicMember = {
  id: number;
  nickname: string;
  avatarUrl: string;
  phone: string;
  phoneBound: boolean;
  member: boolean;
};

export function publicMember(user: Record<string, any> | null | undefined): PublicMember | null {
  if (!user) return null;
  const phone = String(user.phone || "");
  const avatar = user.avatar_url ? publicUrl(user.avatar_url) || String(user.avatar_url) : "";
  return {
    id: Number(user.id),
    nickname: String(user.nickname || ""),
    avatarUrl: avatar,
    phone,
    phoneBound: Boolean(phone),
    member: Boolean(phone),
  };
}

export function normalizeNickname(raw: unknown) {
  const s = String(raw || "").trim().slice(0, 32);
  if (!s) throw new HttpError(400, "请填写微信昵称");
  return s;
}

export function isRemoteAvatar(url: string) {
  return /^(https?:\/\/|\/uploads\/|\/static\/)/i.test(String(url || "").trim());
}

export async function restoreWxSession(loginCode: string, deviceId?: string) {
  const sess = await code2session(loginCode, deviceId);
  const user = await db("users").where({ openid: sess.openid }).first();
  if (!user || !user.phone) {
    return { needAuthorize: true as const, token: null, user: null };
  }
  if (sess.unionid && !user.unionid) {
    await db("users").where({ id: user.id }).update({ unionid: sess.unionid });
  }
  return {
    needAuthorize: false as const,
    token: signToken({ id: user.id, role: "user" }),
    user: publicMember(user),
  };
}

export async function authorizeWxMember(input: {
  loginCode: string;
  phoneCode?: string;
  phone?: string;
  nickname: string;
  avatarUrl?: string;
  deviceId?: string;
}) {
  const nickname = normalizeNickname(input.nickname);
  const sess = await code2session(input.loginCode, input.deviceId);
  const phone = await getWxPhone(input.phoneCode, input.phone);
  const avatarUrl = isRemoteAvatar(input.avatarUrl || "") ? String(input.avatarUrl).trim().slice(0, 512) : "";
  let user = await db("users").where({ openid: sess.openid }).first();
  const patch = {
    unionid: sess.unionid || user?.unionid || null,
    nickname,
    phone,
    phone_bound_at: db.fn.now(),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  };
  if (!user) {
    const [id] = await db("users").insert({
      openid: sess.openid,
      ...patch,
      avatar_url: avatarUrl || "",
    });
    user = await db("users").where({ id }).first();
  } else {
    await db("users").where({ id: user.id }).update(patch);
    user = await db("users").where({ id: user.id }).first();
  }
  return {
    needAuthorize: false as const,
    token: signToken({ id: user.id, role: "user" }),
    user: publicMember(user),
  };
}
