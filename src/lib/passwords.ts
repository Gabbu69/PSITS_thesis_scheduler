import { verifyPassword } from "better-auth/crypto";
import type { Tx } from "./context";

export async function freshPassword(tx: Tx, userId: string, currentHash: string, password: string) {
  const history = await tx.passwordHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 });
  for (const hash of [currentHash, ...history.map((entry) => entry.password)]) {
    if (await verifyPassword({ hash, password })) return false;
  }
  return true;
}
export async function savePassword(tx: Tx, account: { id: string; userId: string; password: string }, password: string) {
  await tx.passwordHistory.create({ data: { userId: account.userId, password: account.password } });
  const keep = await tx.passwordHistory.findMany({ where: { userId: account.userId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true } });
  await tx.passwordHistory.deleteMany({ where: { userId: account.userId, id: { notIn: keep.map((entry) => entry.id) } } });
  await tx.account.update({ where: { id: account.id }, data: { password } });
  await tx.user.update({ where: { id: account.userId }, data: { mustChangePassword: false } });
  await tx.authSession.deleteMany({ where: { userId: account.userId } });
}
