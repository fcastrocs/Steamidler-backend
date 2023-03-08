import { AuthTokens } from "@machiavelli/steam-client/@types/services/Auth";
import { EPersonaState } from "@machiavelli/steam-client/@types/client";
import { ObjectId } from "mongodb";
import { AccountAuth, AccountData } from "@machiavelli/steam-client";
import { State } from "./addSteamAccount";
import { FarmableGame, Item } from "@machiavelli/steam-web";

declare module "@machiavelli/steam-client" {
  export interface AccountAuth {
    password?: string;
    authTokens: AuthTokens;
  }

  interface AccountData {
    farmableGames: FarmableGame[];
    items: Item[];
    avatarFrame: string;
  }
}

interface AccountState {
  status: "online" | "offline" | "reconnecting" | "AccessDenied" | "ingame";
  personaState: keyof EPersonaState;
  gamesIdsIdle: number[];
  gamesIdsFarm: number[];
  proxyId: ObjectId;
}

interface SteamAccount {
  userId: ObjectId;
  accountName: string;
  steamId: string;
  auth: AccountAuth;
  data: AccountData;
  state: AccountState;
}

/**
 * SteamAccount Object stored in database
 */
interface SteamAccountEncrypted extends Omit<SteamAccount, "auth"> {
  auth: string;
}

/**
 * SteamAccount Object sent to requests
 */
type SteamAccountNonSensitive = Omit<SteamAccount, "auth">;
