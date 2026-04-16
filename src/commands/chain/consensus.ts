import { z } from "zod";
import { defineCommand } from "../registry.js";

defineCommand({
  name: "consensus status",
  description: "Consensus node list, current view, sealer/observer roles",
  schema: z.object({}),
  handler: async (ctx) => {
    const [sealers, observers, view] = await Promise.all([
      ctx.bcosRpc.call<unknown>("getSealerList", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getObserverList", []).catch(() => null),
      ctx.bcosRpc.call<unknown>("getPbftView", []).catch(() => null),
    ]);
    return { sealers, observers, view };
  },
});
