import { prisma } from "@/server/db/prisma";

export async function getCurrentUser() {
  return prisma.user.findFirst({
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("No user found. Run npm run db:seed first.");
  }

  return user;
}
