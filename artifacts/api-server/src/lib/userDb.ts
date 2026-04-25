import { pool } from "@workspace/db";
import type { PoolClient } from "pg";

/**
 * Run a callback against a Postgres client that has been switched to the
 * non-superuser `app_user` role with `app.current_user_id` set, so that the
 * row-level security policies on user-scoped tables apply. The role and
 * setting are scoped to the transaction via SET LOCAL.
 */
export async function withUserClient<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE app_user");
    // set_config so we can pass the user id as a parameter safely
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [
      userId,
    ]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
