export class LedgerRepository {
  async saveEntry(_entry) {
    throw new Error("saveEntry is not implemented");
  }

  async updateEntry(_entry) {
    throw new Error("updateEntry is not implemented");
  }

  async getEntryById(_id) {
    throw new Error("getEntryById is not implemented");
  }

  async listEntries(_filter) {
    throw new Error("listEntries is not implemented");
  }

  async softDeleteEntry(_id) {
    throw new Error("softDeleteEntry is not implemented");
  }

  async clearEntries() {
    throw new Error("clearEntries is not implemented");
  }

  async upsertAccount(_account) {
    throw new Error("upsertAccount is not implemented");
  }

  async listAccounts() {
    throw new Error("listAccounts is not implemented");
  }

  async saveRuleConfig(_config) {
    throw new Error("saveRuleConfig is not implemented");
  }

  async loadRuleConfig() {
    throw new Error("loadRuleConfig is not implemented");
  }
}
