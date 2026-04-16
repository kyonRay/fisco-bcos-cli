import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "chain info",
  description: "Chain ID, version, latest height, and consensus summary",
  schema: z.object({}),
  handler: async (ctx) => {
    const [syncStatus, pbftView, groupList] = await Promise.all([
      ctx.bcosRpc.call<unknown>("getSyncStatus", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getPbftView", []).catch(() => null),
      ctx.bcosRpc.call<string[]>("getGroupList", []).catch(() => []),
    ]);
    return {
      chainName: ctx.chain.chainName,
      groupId: ctx.chain.profile.groupId,
      chainId: ctx.chain.profile.chainId,
      syncStatus, pbftView, groupList,
    };
  },
});
