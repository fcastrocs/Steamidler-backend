/**
 * Online steam accounts Steam instance are stored by userId
 */
import Steam from "@machiavelli/steam-client";
import { ObjectId } from "mongodb";
import { ERRORS, SteamIdlerError } from "../commons.js";

type userId = ObjectId;
type accountName = string;
type Accounts = Map<accountName, Steam>;

export default class SteamStore {
  private store: Map<userId, Accounts> = new Map();

  constructor() {}

  /**
   * Stores a steam intance to this user
   */
  public add(userId: ObjectId, accountName: string, steam: Steam): void {
    let accounts = this.store.get(userId);
    // this user doesn't have a store
    if (!accounts) {
      accounts = new Map();
    }

    // make sure there are no duplicates.
    if (accounts.get(accountName)) {
      throw new SteamIdlerError(ERRORS.EXISTS);
    }

    // save steam instance
    accounts.set(accountName, steam);
    this.store.set(userId, accounts);
  }

  /**
   * Get Steam instance for this account
   */
  public get(userId: ObjectId, accountName: string): Steam {
    const accounts = this.store.get(userId);
    if (!accounts) return null;
    return accounts.get(accountName);
  }

  /**
   * Remove an account from user store
   */
  public remove(userId: ObjectId, accountName: string): Steam {
    const accounts = this.store.get(userId);
    if (!accounts) return null;
    const steam = accounts.get(accountName);
    accounts.delete(accountName);
    return steam;
  }
}
