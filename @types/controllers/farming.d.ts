interface Base {
  accountName?: string;
}

export interface StartBody extends Base {
  gameIds: number[];
}

export interface StopBody extends Base {}
