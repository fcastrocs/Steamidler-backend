import ws from "ws";

declare module "ws" {
  interface WebSocket {
    isAlive: boolean;
    userId: string;
    sendSuccess: (type: string, message?: any) => void;
    sendError: (name: string, message: string) => void;
    sendInfo: (type: string, message: any) => void;
  }
}

interface WebSocketReqBody {
  type: string;
  body: { [key: string]: T };
}
