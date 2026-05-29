import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash("admin1234", 10);
  await prisma.user.upsert({
    where: { email: "admin@church.com" },
    update: {},
    create: { name: "관리자", email: "admin@church.com", password: hashed, role: "ADMIN", team: "운영팀" },
  });
  const deaconHash = await bcrypt.hash("test1234", 10);
  await prisma.user.upsert({
    where: { email: "deacon@church.com" },
    update: {},
    create: { name: "김집사", email: "deacon@church.com", password: deaconHash, role: "DEACON", team: "찬양팀" },
  });
  await prisma.user.upsert({
    where: { email: "member@church.com" },
    update: {},
    create: { name: "이성도", email: "member@church.com", password: deaconHash, role: "MEMBER", team: "청년부" },
  });
  console.log("시드 완료: admin@church.com / admin1234");
}

main().catch(console.error).finally(() => prisma.$disconnect());
