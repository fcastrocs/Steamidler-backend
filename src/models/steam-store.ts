/**
 * Online steam accounts Steam instance are stored by userId
 */
import { ObjectId } from "mongodb";
import Steam from "steam-client";
import { ERRORS, SteamIdlerError } from "../commons.js";

type userId = ObjectId;
type username = string;
type Accounts = Map<username, Steam>;

const Store: Map<userId, Accounts> = new Map();

export default class SteamStore {
  /**
   * Stores a steam intance to this user
   */
  static add(userId: ObjectId, username: string, steam: Steam): void {
    // make sure there are no duplicates.
    if (this.has(userId, username)) throw new SteamIdlerError(ERRORS.EXISTS);

    let accounts = Store.get(userId);
    // this user doesn't have a store
    if (!accounts) {
      accounts = new Map();
    }
    // save steam instance
    accounts.set(username, steam);
    Store.set(userId, accounts);
  }

  /**
   * Get Steam instance for this account
   */
  static get(userId: ObjectId, username: string): Steam {
    const accounts = Store.get(userId);
    if (!accounts) return null;
    return accounts.get(username);
  }

  /**
   * Checks if user already has this account in store
   */
  static has(userId: ObjectId, username: string): boolean {
    const steam = this.get(userId, username);
    if (!steam) return false;
    return true;
  }

  /**
   * Remove an account from user store
   */
  static remove(userId: ObjectId, username: string): Steam {
    const accounts = Store.get(userId);
    if (!accounts) return null;
    const steam = accounts.get(username);
    accounts.delete(username);
    return steam;
  }
}
