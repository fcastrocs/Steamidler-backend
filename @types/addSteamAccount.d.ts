import { EPersonaState } from "@machiavelli/steam-client/@types/client";

export interface State {
  personaState: keyof EPersonaState;
  playerName: string;
}

export interface AddAccountBody {
  accountName?: string;
  password?: string;
  authType: AuthType;
}

export interface loginBody {
  accountName: string;
  password?: string;
}

export type AuthType = "QRcode" | "SteamGuardCode";

export interface UpdateWithSteamGuardCodeBody {
  code: string;
}

export interface LoginBody {
  accountName: string;
}

export interface LogoutBody {
  accountName: string;
}

export interface RemoveBody {
  accountName: string;
}

export interface GetBody {
  accountName: string;
}
