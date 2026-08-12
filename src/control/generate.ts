/** AD-9: generate phase — build the per-Tick world snapshot for Producers */
import { buildWorldSnapshot } from "../world/snapshot";

export function generate(): void {
  buildWorldSnapshot();
}
