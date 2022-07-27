const Store = new Map();
export default class SteamStore {
    /**
     * Stores a steam intance to this user
     */
    static add(userId, username, steam) {
        // make sure there are no duplicates.
        if (this.has(userId, username)) {
            throw Error(`Account ${username} is already in SteamStore.`);
        }
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
    static get(userId, username) {
        const accounts = Store.get(userId);
        if (!accounts)
            return null;
        const steam = accounts.get(username);
        if (!steam)
            return null;
        return steam;
    }
    /**
     * Checks if user already has this account in store
     */
    static has(userId, username) {
        const steam = this.get(userId, username);
        if (!steam)
            return false;
        return true;
    }
    /**
     * Remove an account from user store
     */
    static remove(userId, username) {
        const accounts = Store.get(userId);
        if (!accounts)
            return null;
        const steam = accounts.get(username);
        accounts.delete(username);
        return steam;
    }
}
