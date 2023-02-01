import { RawData, WebSocket, WebSocketServer } from "ws";
import { WebSocketReqBody } from "../@types";
import https from "https";
import { verifyAuth } from "./controllers/auth.js";
import Cookie from "cookie";
import { SteamIdlerError } from "./commons.js";
import { SteamClientError } from "@machiavelli/steam-client";

export default class WebSocketAPIServer {
  private readonly websockets: { [objectId: string]: WebSocket } = {};
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly Router = new Map<string, Function>();

  constructor() {
    this.wss.on("connection", (ws, req) => {
      const userId = req.body.userId.toString();

      // terminate existing websocket for this user
      if (this.websockets[userId]) {
        this.websockets[userId].isAlive = false;
        this.websockets[userId].terminate();
      }

      // establish websocket
      this.websockets[userId] = ws;
      ws.userId = userId;
      ws.isAlive = true;

      ws.sendError = (code: number, type: string, message: string) => {
        ws.send(
          JSON.stringify({
            success: false,
            code,
            type,
            message,
          })
        );
      };

      ws.sendMessage = (type: string, message: any) => {
        ws.send(
          JSON.stringify({
            success: true,
            type,
            message,
          })
        );
      };

      ws.sendInfo = (type: string, info: any) => {
        ws.send(
          JSON.stringify({
            type,
            info,
          })
        );
      };

      ws.sendInfo("connected", "I am listening!");

      ws.on("close", () => {
        if (ws.isAlive) {
          this.websockets[ws.userId].isAlive = false;
          this.websockets[ws.userId].terminate();
          this.websockets[ws.userId] = null;
        }
      });

      // got ping response from user
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (data: RawData, isBinary: boolean) => {
        let message = {} as WebSocketReqBody;

        // make sure body is a JSON
        try {
          message = JSON.parse(data.toString()) as WebSocketReqBody;
        } catch (error) {
          ws.sendError(400, "BadRequest", "Bad Content-Type");
        }

        this.requestHandler(message, ws);
      });

      // ping websockets interval
      // setInterval(() => {
      //   for (const ws of this.wss.clients) {
      //     // make sure it has not been previously disconnected
      //     if (!ws.isAlive) {
      //       this.websockets[ws.userId] = null;
      //       ws.terminate();
      //       continue;
      //     }

      //     ws.isAlive = false;
      //     ws.ping();
      //   }
      // }, 10000);
    });
  }

  public addRoute(route: string, controller: Function) {
    this.Router.set(route, controller);
  }

  private async requestHandler(message: WebSocketReqBody, ws: WebSocket) {
    const service = this.Router.get(message.type);
    if (!service) {
      return ws.sendError(404, "NotFound", "Bad route");
    }

    try {
      await service(ws.userId, message.body, ws);
    } catch (error) {
      if (error instanceof SteamIdlerError) {
        ws.sendError(400, "SteamIdlerError", error.message);
      } else if (error instanceof SteamClientError) {
        ws.sendError(400, "SteamIdlerError", error.message);
      } else {
        ws.sendError(500, "Exception", error.message);
      }
    }
  }

  /**
   * Handle http socket to websocket upgrade
   */
  public upgrade(httpsServer: https.Server) {
    httpsServer.on("upgrade", (req, socket, head) => {
      this.wss.handleUpgrade(req, socket, head, async (ws) => {
        if (!req.headers.cookie) {
          return ws.close(4001, "Not authenticated");
        }

        const cookie = Cookie.parse(req.headers.cookie);

        if (!cookie["refresh-token"] && !cookie["access-token"]) {
          return ws.close(4001, "Not authenticated");
        }

        try {
          const auth = await verifyAuth(cookie["access-token"], cookie["refresh-token"]);
          req.body = { userId: auth.userId };
          this.wss.emit("connection", ws, req);
        } catch (error) {
          return ws.close(4001, "Not authenticated");
        }
      });
    });
  }
}
