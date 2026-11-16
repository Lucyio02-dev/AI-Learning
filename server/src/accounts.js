// 本地账户与数据同步：scrypt 加盐哈希、会话令牌、每用户独立数据文件、
// 版本化推送与冲突检测。云端托管是外部条件，本地后端先满足同步语义。
import { join } from "node:path";
import { nowIso, uuid, newToken, hashPassword, verifyPassword, ensureJson, writeJson } from "./util.js";
import { DATA_DIR } from "./tasks.js";

const USERS_DIR = join(DATA_DIR, "users");
const SESSIONS = new Map(); // token -> {userId, issuedAt, expiresAt}
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30;

async function usersIndex() {
  return ensureJson(join(USERS_DIR, "index.json"), { users: [] });
}

export async function register({ username, password }) {
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(username || ""))
    throw badRequest("用户名需为 3-32 位字母/数字/下划线");
  if (!password || password.length < 8) throw badRequest("密码至少 8 位");
  const index = await usersIndex();
  if (index.users.some((u) => u.username === username))
    throw badRequest("用户名已存在");
  const userId = uuid();
  const hp = hashPassword(password);
  const user = { id: userId, username, createdAt: nowIso() };
  index.users.push({ ...user, ...hp });
  await writeJson(join(USERS_DIR, "index.json"), index);
  await writeJson(join(USERS_DIR, `${userId}.json`), {
    userId,
    revision: 0,
    updatedAt: nowIso(),
    state: null,
  });
  return issueSession(user);
}

export async function login({ username, password }) {
  const index = await usersIndex();
  const record = index.users.find((u) => u.username === username);
  if (!record || !verifyPassword(password, record))
    throw unauthorized("用户名或密码错误");
  return issueSession({ id: record.id, username, createdAt: record.createdAt });
}

function issueSession(user) {
  const token = newToken();
  SESSIONS.set(token, {
    userId: user.id,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL,
  });
  return { token, user: { id: user.id, username: user.username } };
}

export function authUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const session = SESSIONS.get(token);
  if (!session || session.expiresAt < Date.now()) {
    SESSIONS.delete(token);
    return null;
  }
  return { userId: session.userId };
}

export function logout(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  SESSIONS.delete(token);
}

function badRequest(message) {
  const e = new Error(message);
  e.statusCode = 400;
  return e;
}
function unauthorized(message) {
  const e = new Error(message);
  e.statusCode = 401;
  return e;
}

async function userFile(userId) {
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw badRequest("非法用户 ID");
  const path = join(USERS_DIR, `${userId}.json`);
  const data = await ensureJson(path, null);
  if (!data) throw unauthorized("用户数据不存在");
  return { path, data };
}

// 拉取：返回服务端当前状态与版本号。
export async function pull(userId) {
  const { data } = await userFile(userId);
  return { revision: data.revision, updatedAt: data.updatedAt, state: data.state };
}

// 推送：带 baseRevision 乐观并发；冲突时返回服务端状态供合并。
export async function push(userId, { state, baseRevision, strategy = "reject" }) {
  const { path, data } = await userFile(userId);
  if (baseRevision !== data.revision) {
    if (strategy === "force") {
      // 明确选择覆盖：先落历史副本，可恢复。
      const history = join(USERS_DIR, "history", `${userId}-${data.revision}.json`);
      await writeJson(history, data);
    } else {
      const e = new Error("版本冲突：服务端已有更新数据");
      e.statusCode = 409;
      e.payload = {
        code: "E_SYNC_CONFLICT",
        serverRevision: data.revision,
        serverUpdatedAt: data.updatedAt,
        serverState: data.state,
      };
      throw e;
    }
  }
  const next = {
    userId,
    revision: data.revision + 1,
    updatedAt: nowIso(),
    state,
  };
  await writeJson(path, next);
  return { revision: next.revision, updatedAt: next.updatedAt };
}

export async function deleteAccountData(userId, { keepLocal }) {
  const { path } = await userFile(userId);
  const { writeJson: w } = { writeJson };
  if (!keepLocal) {
    await writeJson(join(USERS_DIR, "deleted", `${userId}-${Date.now()}.json`), {
      deletedAt: nowIso(),
    });
  }
  await w(path, { userId, revision: 0, updatedAt: nowIso(), state: null });
  return { cleared: !keepLocal };
}
