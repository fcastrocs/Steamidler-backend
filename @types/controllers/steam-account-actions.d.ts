interface Base {
  accountName: string;
}

interface IdleGamesBody extends Base {
  gameIds: number[];
}

interface ChangePlayerNameBody extends Base {
  playerName: string;
}

interface Activatef2pgameBody extends Base {
  appids: number[];
}

interface CdkeyRedeemBody extends Base {
  cdkey: string;
}

interface ChangePersonaStateBody extends Base {
  state: string;
}
