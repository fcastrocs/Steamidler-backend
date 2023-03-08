import http from "http";
import Cookie from "cookie";
import { verifyAuth } from "./services/user.js";
import { ObjectId } from "mongodb";
import { WebSocket, WebSocketServer, RawData } from "ws";
import { WebSocketReqBody } from "../@types/WebSocketAPIServer.js";

export default class WebSocketAPIServer {
  private readonly websockets: Map<string, WebSocket> = new Map();
  private readonly ws = new WebSocketServer({ noServer: true });
  private readonly Router = new Map<string, Function>();

  constructor() {
    this.ws.on("connection", (ws, req) => {
      const userId = req.body.userId.toString();

      // terminate existing websocket for this user
      if (this.websockets.has(userId)) {
        const ws = this.websockets.get(userId);
        ws.isAlive = false;
        ws.terminate();
      }

      // establish websocket
      this.websockets.set(userId, ws);
      ws.userId = userId;
      ws.isAlive = true;

      // message listener
      ws.on("message", (data: RawData, isBinary: boolean) => {
        let message = {} as WebSocketReqBody;

        // make sure body is a JSON
        try {
          message = JSON.parse(data.toString()) as WebSocketReqBody;
        } catch (error) {
          ws.sendError("BadRequest", "Bad Content-Type");
        }

        this.requestHandler(message, ws.userId);
      });

      ws.sendError = (name: string, message: string) => {
        ws.send(
          JSON.stringify({
            type: "error",
            name,
            message,
            success: false,
          })
        );
      };

      ws.sendSuccess = (type: string, message?: any) => {
        ws.send(
          JSON.stringify({
            success: true,
            type,
            message: message,
          })
        );
      };

      ws.sendInfo = (type: string, message: any) => {
        ws.send(
          JSON.stringify({
            type,
            message,
          })
        );
      };

      ws.on("close", () => {
        if (ws.isAlive) {
          ws.isAlive = false;
          ws.terminate();
          // this.websockets.delete(userId);
        }
      });

      // got ping response from user
      ws.on("pong", () => (ws.isAlive = true));

      ws.sendSuccess("connected");
    });

    this.heartbeat();
  }

  private heartbeat() {
    // ping websockets interval
    setInterval(() => {
      for (const ws of this.ws.clients) {
        // make sure it has not been previously disconnected
        if (!ws.isAlive) {
          ws.terminate();
          this.websockets.delete(ws.userId);
          continue;
        }

        ws.isAlive = false;
        ws.ping();
      }
    }, 10000);
  }

  public addRoute(route: string, controller: Function) {
    this.Router.set(route, controller);
  }

  private async requestHandler(message: WebSocketReqBody, userId: string) {
    const service = this.Router.get(message.type);
    if (!service) {
      this.send({ type: "Error", userId, routeName: "NotFound", message: "Bad route" });
    }

    try {
      await service(userId, message.body);
    } catch (error) {
      console.log(error)
      this.send({ type: "Error", userId, routeName: error.name, message: error.message });
    }
  }

  public send(body: {
    type: "Info" | "Error" | "Success";
    routeName: string;
    userId: ObjectId | string;
    message?: any;
  }) {
    const ws = this.websockets.get(body.userId.toString());
    if (!ws) return;

    ws[`send${body.type}`](body.routeName, body.message);
  }

  /**
   * Handle http socket to websocket upgrade
   */
  public upgrade(httpServer: http.Server) {
    httpServer.on("upgrade", (req, socket, head) => {
      this.ws.handleUpgrade(req, socket, head, async (ws) => {
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
          this.ws.emit("connection", ws, req);
        } catch (error) {
          return ws.close(4001, "Not authenticated");
        }
      });
    });
  }

  public getClient(userId: ObjectId) {
    return this.websockets.get(userId.toString());
  }
}
