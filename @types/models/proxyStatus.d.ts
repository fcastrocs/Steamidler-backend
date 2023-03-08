import { Proxy } from "..";

// model ProxyStatus
interface ProxyStatus {
  proxyId: ObjectId;
  aliveStatus: string[];
  steamConnectStatus: string[];
  index: number;
}

interface ProxyStatusResults extends Omit<Proxy, "load"> {
  results: Omit<ProxyStatus, "proxyId" | "index">;
}
