import { EPersonaState } from "@machiavelli/steam-client/@types/client";

interface Base {
  accountName?: string;
}

export interface ChangePlayerNameBody extends Base {
  playerName: string;
}

export interface Activatef2pgameBody extends Base {
  appids: number[];
}

export interface CdkeyRedeemBody extends Base {
  cdkey: string;
}

export interface ChangePersonaStateBody extends Base {
  state: keyof EPersonaState;
}

export interface AddAccountBody extends Base {
  password?: string;
  authType: AuthType;
}

export interface loginBody extends Base {
  password?: string;
}

export type AuthType = "QRcode" | "SteamGuardCode";

export interface UpdateWithSteamGuardCodeBody extends Base {
  code: string;
  guardType: "deviceCode" | "emailCode";
}

export interface LoginBody extends Base {}

export interface LogoutBody extends Base {}

export interface RemoveBody extends Base {}

export interface GetBody extends Base {
  steamId?: string;
}

export interface CancelConfirmationBody extends Base {}

export interface State {
  personaState: keyof EPersonaState;
  playerName: string;
}

export interface IdleGamesBody extends Base {
  gameIds: number[];
  forcePlay: boolean;
}
