import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateSavedTokenBody,
  ListSavedTokensResponse,
  DeleteSavedTokenResponse,
} from "@workspace/api-zod";
import { withUserClient } from "../lib/userDb";

const router: IRouter = Router();

function toItem(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    chainId: row.chain_id as number,
    tokenAddress: row.token_address as string,
    tokenSymbol: row.token_symbol as string,
    tokenName: (row.token_name as string | null) ?? null,
    decimals: row.decimals as number,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

router.get("/saved-tokens", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const items = await withUserClient(req.user.id, async (client) => {
      const r = await client.query(
        `SELECT id, chain_id, token_address, token_symbol, token_name, decimals, created_at
         FROM saved_tokens
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.id],
      );
      return r.rows.map(toItem);
    });
    res.json(ListSavedTokensResponse.parse({ items }));
  } catch (err) {
    req.log.error({ err }, "Failed to list saved tokens");
    res.status(500).json({ error: "Failed to load saved tokens" });
  }
});

router.post("/saved-tokens", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateSavedTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = parsed.data;
  try {
    const item = await withUserClient(req.user.id, async (client) => {
      const r = await client.query(
        `INSERT INTO saved_tokens (user_id, chain_id, token_address, token_symbol, token_name, decimals)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, chain_id, token_address) DO UPDATE
           SET token_symbol = EXCLUDED.token_symbol,
               token_name = EXCLUDED.token_name,
               decimals = EXCLUDED.decimals
         RETURNING id, chain_id, token_address, token_symbol, token_name, decimals, created_at`,
        [
          req.user.id,
          data.chainId,
          data.tokenAddress,
          data.tokenSymbol,
          data.tokenName ?? null,
          data.decimals,
        ],
      );
      return toItem(r.rows[0]);
    });
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to save token");
    res.status(500).json({ error: "Failed to save token" });
  }
});

router.delete("/saved-tokens/:id", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const ok = await withUserClient(req.user.id, async (client) => {
      const r = await client.query(
        `DELETE FROM saved_tokens WHERE id = $1 AND user_id = $2 RETURNING id`,
        [req.params.id, req.user.id],
      );
      return r.rowCount! > 0;
    });
    if (!ok) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(DeleteSavedTokenResponse.parse({ success: true }));
  } catch (err) {
    req.log.error({ err }, "Failed to delete saved token");
    res.status(500).json({ error: "Failed to delete saved token" });
  }
});

export default router;
