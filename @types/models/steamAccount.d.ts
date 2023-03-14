import { AuthTokens } from "@fcastrocs/steamclient/@types/services/Auth";
import { EPersonaState } from "@fcastrocs/steamclient/@types/client";
import { ObjectId } from "mongodb";
import { AccountAuth, AccountData } from "@fcastrocs/steamclient";
import { State } from "./addSteamAccount";
import { FarmableGame, Item } from "@fcastrocs/steamclient";

declare module "@fcastrocs/steamclient" {
  export interface AccountAuth {
    password?: string;
    authTokens: AuthTokens;
  }

  interface AccountData {
    farmableGames: FarmableGame[];
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
