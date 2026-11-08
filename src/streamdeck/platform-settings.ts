import { PlatformAccountsSnapshot } from "../core/types.js";

type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject {
  [key: string]: JsonValue;
}

interface AccountActions {
  get(): PlatformAccountsSnapshot;
  add(accountId: string): Promise<void>;
  select(accountId: string, correctInferred?: boolean): Promise<void>;
  remove(accountId: string): Promise<void>;
}

interface SettingsGateway {
  get(): Promise<JsonObject>;
  set(settings: JsonObject): Promise<void>;
}

interface AccountCommand {
  requestId: string;
  action: "add" | "select" | "remove";
  accountId: string;
  correctInferred?: boolean;
}

export class PlatformSettingsBridge {
  private ready = false;
  private dirty = false;
  private publishing = false;
  private readonly handledRequestIds = new Set<string>();
  private readonly results: Array<{ requestId: string; error?: string }> = [];
  private commandQueue: Promise<void> = Promise.resolve();
  private accounts: PlatformAccountsSnapshot | undefined;

  constructor(
    private readonly gateway: SettingsGateway,
    private readonly actions: AccountActions,
    private readonly reportError: (error: unknown) => void
  ) {}

  start(settings: unknown): void {
    this.ready = true;
    this.receive(settings);
    this.update(this.actions.get());
  }

  receive(settings: unknown): void {
    if (!isRecord(settings)) {
      this.reportError(new Error("Received invalid Stream Deck global settings."));
      return;
    }
    const raw = settings.platformAccountCommand;
    if (raw === undefined || raw === null) return;
    const command = parseCommand(raw);
    if (!command) {
      this.reportError(new Error("Received an invalid Stream Deck account command."));
      return;
    }
    if (this.handledRequestIds.has(command.requestId)) return;
    this.handledRequestIds.add(command.requestId);
    this.commandQueue = this.commandQueue.then(() => this.execute(command)).catch(this.reportError);
  }

  update(accounts: PlatformAccountsSnapshot): void {
    this.accounts = accounts;
    this.requestPublish();
  }

  private async execute(command: AccountCommand): Promise<void> {
    try {
      if (command.action === "select") {
        await this.actions.select(command.accountId, command.correctInferred);
      } else {
        await this.actions[command.action](command.accountId);
      }
      this.results.push({ requestId: command.requestId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.results.push({ requestId: command.requestId, error: message });
      this.reportError(error);
    }
    this.accounts = this.actions.get();
    this.requestPublish();
  }

  private requestPublish(): void {
    this.dirty = true;
    if (!this.ready || this.publishing) return;
    this.publishing = true;
    void this.publish().catch(this.reportError).finally(() => {
      this.publishing = false;
      if (this.dirty) this.requestPublish();
    });
  }

  private async publish(): Promise<void> {
    while (this.dirty && this.accounts) {
      this.dirty = false;
      const settings = await this.gateway.get();
      const result = this.results[0];
      const command = settings.platformAccountCommand;
      const currentCommand = command === undefined ? undefined : parseCommand(command);
      if (result && currentCommand?.requestId === result.requestId) {
        delete settings.platformAccountCommand;
      }
      const next: JsonObject = {
        ...settings,
        platformAccounts: serializeAccounts(this.accounts),
        ...(result
          ? {
              platformAccountResult: {
                requestId: result.requestId,
                ...(result.error ? { error: result.error } : {})
              }
            }
          : {})
      };
      await this.gateway.set(next);
      if (result) this.results.shift();
      if (this.results.length > 0) this.dirty = true;
    }
  }
}

function parseCommand(value: unknown): AccountCommand | undefined {
  if (!isRecord(value)) return undefined;
  const { requestId, action, accountId, correctInferred } = value;
  if (
    typeof requestId !== "string" || requestId.length === 0 || requestId.length > 100 ||
    (action !== "add" && action !== "select" && action !== "remove") ||
    typeof accountId !== "string" || accountId.length > 160 ||
    (correctInferred !== undefined && (action !== "select" || typeof correctInferred !== "boolean"))
  ) {
    return undefined;
  }
  return {
    requestId,
    action,
    accountId,
    ...(typeof correctInferred === "boolean" ? { correctInferred } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeAccounts(snapshot: PlatformAccountsSnapshot): JsonObject {
  return {
    accounts: snapshot.accounts.map((account) => ({
      accountId: account.accountId,
      ...(account.name ? { name: account.name } : {}),
      matchesSeen: account.matchesSeen,
      managed: account.managed,
      suggested: account.suggested
    })),
    ...(snapshot.activeAccountId ? { activeAccountId: snapshot.activeAccountId } : {}),
    ...(snapshot.selectedAccountId ? { selectedAccountId: snapshot.selectedAccountId } : {}),
    ...(snapshot.verifiedAccountId ? { verifiedAccountId: snapshot.verifiedAccountId } : {}),
    ...(snapshot.selectionSource ? { selectionSource: snapshot.selectionSource } : {}),
    selectionRequired: snapshot.selectionRequired
  };
}
