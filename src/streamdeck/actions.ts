import {
  SingletonAction,
  action,
  type DidReceiveSettingsEvent,
  type KeyDownEvent,
  type KeyUpEvent,
  type WillAppearEvent,
  type WillDisappearEvent
} from "@elgato/streamdeck";
import { ActionKind } from "../render/key-renderer.js";
import { RenderBus, StreamDeckKeyTarget } from "./render-bus.js";
import { RlControlClient } from "../control/rl-control-client.js";
import { normalizeActionSettings, RocketStatsActionSettings } from "./action-settings.js";
import { msg } from "../i18n/messages.js";

abstract class LiveStatsAction extends SingletonAction {
  constructor(
    private readonly bus: RenderBus,
    private readonly kind: ActionKind
  ) {
    super();
  }

  override onWillAppear(ev: WillAppearEvent): void {
    this.bus.bind(
      this.kind,
      ev.action as unknown as StreamDeckKeyTarget,
      ev.payload.settings
    );
  }

  override onWillDisappear(ev: WillDisappearEvent): void {
    this.bus.unbind(this.kind, ev.action as unknown as StreamDeckKeyTarget);
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent): void {
    this.bus.bind(
      this.kind,
      ev.action as unknown as StreamDeckKeyTarget,
      ev.payload.settings
    );
  }
}

@action({ UUID: "com.rocketstats.livestats.score" })
export class ScoreAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "score");
  }
}

@action({ UUID: "com.rocketstats.livestats.timer" })
export class TimerAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "timer");
  }
}

@action({ UUID: "com.rocketstats.livestats.boost" })
export class BoostAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "boost");
  }
}

@action({ UUID: "com.rocketstats.livestats.banner" })
export class EventBannerAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "event-banner");
  }
}

@action({ UUID: "com.rocketstats.livestats.last-goal" })
export class LastGoalAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "last-goal");
  }
}

@action({ UUID: "com.rocketstats.livestats.streak" })
export class StreakAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "streak");
  }
}

@action({ UUID: "com.rocketstats.livestats.mmr" })
export class MmrAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "mmr");
  }
}

@action({ UUID: "com.rocketstats.livestats.queue" })
export class QueueStatusAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "queue-status");
  }
}

@action({ UUID: "com.rocketstats.livestats.ban" })
export class BanCountdownAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "ban-countdown");
  }
}

@action({ UUID: "com.rocketstats.livestats.speed" })
export class SpeedAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "speed");
  }
}

@action({ UUID: "com.rocketstats.livestats.ping" })
export class PingAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "ping");
  }
}

@action({ UUID: "com.rocketstats.livestats.possession" })
export class PossessionAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "possession");
  }
}

@action({ UUID: "com.rocketstats.livestats.records" })
export class RecordsAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "records");
  }
}

@action({ UUID: "com.rocketstats.livestats.goals" })
export class GoalsAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "goals");
  }
}

@action({ UUID: "com.rocketstats.livestats.assists" })
export class AssistsAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "assists");
  }
}

@action({ UUID: "com.rocketstats.livestats.saves" })
export class SavesAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "saves");
  }
}

@action({ UUID: "com.rocketstats.livestats.shots" })
export class ShotsAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "shots");
  }
}

@action({ UUID: "com.rocketstats.livestats.demos" })
export class DemosAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "demos");
  }
}

@action({ UUID: "com.rocketstats.livestats.flip-resets" })
export class FlipResetsAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "flip-resets");
  }
}

@action({ UUID: "com.rocketstats.livestats.touches" })
export class TouchesAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "touches");
  }
}

@action({ UUID: "com.rocketstats.livestats.player-score" })
export class PlayerScoreAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "player-score");
  }
}

@action({ UUID: "com.rocketstats.livestats.rank" })
export class RankAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "rank");
  }
}

@action({ UUID: "com.rocketstats.livestats.mmr-wl" })
export class MmrWinLossAction extends LiveStatsAction {
  constructor(bus: RenderBus) {
    super(bus, "mmr-wl");
  }
}

export interface StatsControls {
  toggleStatsScope(): Promise<void>;
  resetStats(): Promise<void>;
}

@action({ UUID: "com.rocketstats.livestats.stats-scope" })
export class StatsScopeAction extends LiveStatsAction {
  constructor(bus: RenderBus, private readonly controls: StatsControls) {
    super(bus, "stats-scope");
  }

  override async onKeyDown(): Promise<void> {
    await this.controls.toggleStatsScope();
  }
}

const RESET_HOLD_MS = 2_000;
const RESET_HINT_MS = 1_500;

@action({ UUID: "com.rocketstats.livestats.stats-reset" })
export class StatsResetAction extends LiveStatsAction {
  private readonly pressedAt = new Map<string, number>();

  constructor(private readonly renderBus: RenderBus, private readonly controls: StatsControls) {
    super(renderBus, "stats-reset");
  }

  override onKeyDown(ev: KeyDownEvent): void {
    this.pressedAt.set(ev.action.id, Date.now());
  }

  // A deliberate long press is required so the history cannot be wiped by an accidental tap.
  override async onKeyUp(ev: KeyUpEvent): Promise<void> {
    const pressedAt = this.pressedAt.get(ev.action.id);
    this.pressedAt.delete(ev.action.id);
    const target = ev.action as unknown as StreamDeckKeyTarget;
    if (pressedAt === undefined || Date.now() - pressedAt < RESET_HOLD_MS) {
      const locale = normalizeActionSettings(ev.payload.settings).locale ?? "en";
      await ev.action.setTitle(`${msg(locale, "reset")}\n${msg(locale, "holdToReset")}`);
      setTimeout(() => this.renderBus.bind("stats-reset", target, ev.payload.settings), RESET_HINT_MS);
      return;
    }
    await this.controls.resetStats();
    await ev.action.showOk();
  }
}

@action({ UUID: "com.rocketstats.livestats.hud-toggle" })
export class HudToggleAction extends SingletonAction {
  constructor(private readonly controlClient: RlControlClient) {
    super();
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    try {
      await this.controlClient.toggleHud();
      await ev.action.setTitle("SENT TO BRIDGE");
    } catch (error) {
      await ev.action.setTitle("BRIDGE OFFLINE");
      throw error;
    }
  }
}
