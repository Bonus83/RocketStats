import { msg } from "../i18n/messages.js";
import { mmrKeyTitle, shortPlaylistLabel } from "../core/playlists.js";
import { renderRankCardSvg } from "../render/rank-card.js";
import {
  ActionKind,
  KeyRenderModel,
  renderLastGoalCardSvg,
  renderMmrCardSvg,
  renderPingCardSvg,
  renderScopeCardSvg,
  renderStreakCardSvg
} from "../render/key-renderer.js";
import { normalizeActionSettings, RocketStatsActionSettings } from "./action-settings.js";

export interface StreamDeckKeyTarget {
  setTitle(value: string): void | Promise<void>;
  setImage?(image?: string): void | Promise<void>;
}

interface EventAnimation {
  eventKey: string;
  title: string;
  body: string;
  frame: number;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export class RenderBus {
  private readonly targets = new Map<ActionKind, Map<StreamDeckKeyTarget, RocketStatsActionSettings>>();
  private readonly latestModels = new Map<ActionKind, KeyRenderModel>();
  private readonly eventAnimations = new Map<StreamDeckKeyTarget, EventAnimation>();
  private readonly seenEventKeys = new Map<StreamDeckKeyTarget, string>();
  private readonly shownImages = new Map<StreamDeckKeyTarget, string>();

  bind(kind: ActionKind, target: StreamDeckKeyTarget, settings?: unknown): void {
    let actions = this.targets.get(kind);
    if (!actions) {
      actions = new Map();
      this.targets.set(kind, actions);
    }
    const normalized = normalizeActionSettings(settings);
    actions.set(target, normalized);
    this.shownImages.delete(target);
    const latest = this.latestModels.get(kind);
    if (latest) {
      this.publishToTarget(latest, target, normalized);
    }
  }

  unbind(kind: ActionKind, target: StreamDeckKeyTarget): void {
    this.targets.get(kind)?.delete(target);
    this.stopEventAnimation(target);
    this.seenEventKeys.delete(target);
    this.shownImages.delete(target);
  }

  publish(model: KeyRenderModel): void {
    this.latestModels.set(model.action, model);
    const targets = this.targets.get(model.action);
    if (!targets) {
      return;
    }

    for (const [target, settings] of targets) {
      this.publishToTarget(model, target, settings);
    }
  }

  private publishToTarget(
    model: KeyRenderModel,
    target: StreamDeckKeyTarget,
    settings: RocketStatsActionSettings
  ): void {
    if (model.image !== undefined) {
      this.publishImage(model, target, settings);
      return;
    }
    let localizedTitle = settings.locale && model.titleKey
      ? msg(settings.locale, model.titleKey)
      : model.title;
    let value = settings.locale && model.valueKey
      ? msg(settings.locale, model.valueKey)
      : model.value;
    let footer = settings.locale && model.footerKey
      ? msg(settings.locale, model.footerKey)
      : model.footer;

    if (model.action === "mmr") {
      const base = settings.locale ? msg(settings.locale, "mmr") : model.mmrTitleBase ?? model.title;
      localizedTitle = mmrKeyTitle(base, settings.playlist ?? model.mmrPlaylist);
      if (settings.playlist && model.mmrByPlaylist) {
        const selected = model.mmrByPlaylist[settings.playlist];
        value = selected?.value ?? "---";
        footer = value === "---" ? "" : selected?.rankLabel ?? "";
      }
    }

    if (model.action === "event-banner" && model.eventStatValues && settings.eventBannerStats) {
      const stats = settings.eventBannerStats
        .slice(0, 3)
        .map((key) => model.eventStatValues?.[key])
        .filter((entry): entry is string => Boolean(entry));
      footer = [model.eventSpeed, ...stats].filter(Boolean).join(" ");
    }

    const title = localizedTitle.replace(/^▶\s*/, "");
    const rendered = [value, footer].filter(Boolean).join("\n");
    if (model.action === "event-banner") {
      this.publishEventBanner(target, model, title, rendered, settings.animateEvents);
    } else {
      this.stopEventAnimation(target);
      this.setTitle(target, [title, rendered].filter(Boolean).join("\n"));
    }
  }

  private publishImage(
    model: KeyRenderModel,
    target: StreamDeckKeyTarget,
    settings: RocketStatsActionSettings
  ): void {
    let image = model.image ?? "";
    const selected = settings.playlist ? model.mmrByPlaylist?.[settings.playlist] : undefined;
    const value = settings.playlist ? selected?.value ?? "---" : model.value;
    if (model.action === "stats-scope" && settings.locale) {
      image = renderScopeCardSvg(
        msg(settings.locale, "scopeAll"),
        shortPlaylistLabel(model.statsMode),
        msg(settings.locale, "scopeMode"),
        model.statsScope ?? "all"
      );
    } else if (model.action === "ping" && settings.locale) {
      image = renderPingCardSvg(msg(settings.locale, "ping"), model.pingMs, msg(settings.locale, "ms"));
    } else if (model.action === "last-goal" && settings.locale) {
      image = renderLastGoalCardSvg(
        msg(settings.locale, "lastGoal"),
        model.lastGoalScorer,
        model.lastGoalSpeedKph,
        msg(settings.locale, "kmh")
      );
    } else if (model.action === "streak" && settings.locale) {
      image = renderStreakCardSvg(msg(settings.locale, "streak"), model.value, model.footer);
    } else if (model.action === "rank" && settings.playlist) {
      image = renderRankCardSvg(
        value === "---" ? undefined : selected?.rankLabel,
        selected?.division,
        selected?.divisionEstimated
      );
    } else if (model.action === "mmr-wl" && (settings.playlist || settings.locale)) {
      image = renderMmrCardSvg({
        titleBase: msg(settings.locale ?? "en", "mmr"),
        playlist: settings.playlist ?? model.mmrPlaylist,
        value,
        wins: model.wins ?? 0,
        losses: model.losses ?? 0
      });
    }

    this.stopEventAnimation(target);
    if (this.shownImages.get(target) === image) {
      return;
    }
    this.shownImages.set(target, image);
    this.setTitle(target, "");
    try {
      const update = target.setImage?.(image);
      if (update) {
        void update.catch((error: unknown) => this.reportRenderError(error));
      }
    } catch (error) {
      this.reportRenderError(error);
    }
  }

  private publishEventBanner(
    target: StreamDeckKeyTarget,
    model: KeyRenderModel,
    title: string,
    body: string,
    actionAnimationSetting: boolean | undefined
  ): void {
    if (model.eventType === undefined || model.eventId === undefined) {
      this.stopEventAnimation(target);
      this.setTitle(target, [title, body].filter(Boolean).join("\n"));
      return;
    }

    const eventKey = `${model.eventType}:${model.eventId}`;
    const seenEventKey = this.seenEventKeys.get(target);
    const animation = this.eventAnimations.get(target);
    const shouldAnimate = actionAnimationSetting ?? model.animateEvents ?? true;

    if (seenEventKey === eventKey) {
      if (animation?.eventKey === eventKey && shouldAnimate) {
        animation.title = title;
        animation.body = body;
      } else {
        this.stopEventAnimation(target);
        this.setTitle(target, [title, body].filter(Boolean).join("\n"));
      }
      return;
    }

    this.seenEventKeys.set(target, eventKey);
    this.stopEventAnimation(target);
    if (!shouldAnimate) {
      this.setTitle(target, [title, body].filter(Boolean).join("\n"));
      return;
    }

    const nextAnimation: EventAnimation = {
      eventKey,
      title,
      body,
      frame: 0,
      timer: undefined
    };
    this.eventAnimations.set(target, nextAnimation);
    this.showEventAnimationFrame(target, nextAnimation);
  }

  private showEventAnimationFrame(
    target: StreamDeckKeyTarget,
    animation: EventAnimation
  ): void {
    if (this.eventAnimations.get(target) !== animation) {
      return;
    }
    if (animation.frame >= 6) {
      this.eventAnimations.delete(target);
      this.setTitle(target, [animation.title, animation.body].filter(Boolean).join("\n"));
      return;
    }

    const marker = animation.frame % 2 === 0 ? "▶ " : "";
    this.setTitle(
      target,
      [marker + animation.title, animation.body].filter(Boolean).join("\n")
    );
    animation.frame += 1;
    animation.timer = setTimeout(
      () => this.showEventAnimationFrame(target, animation),
      250
    );
  }

  private stopEventAnimation(target: StreamDeckKeyTarget): void {
    const animation = this.eventAnimations.get(target);
    if (animation?.timer) {
      clearTimeout(animation.timer);
    }
    this.eventAnimations.delete(target);
  }

  private setTitle(target: StreamDeckKeyTarget, title: string): void {
    try {
      const update = target.setTitle(title);
      if (update) {
        void update.catch((error: unknown) => this.reportRenderError(error));
      }
    } catch (error) {
      this.reportRenderError(error);
    }
  }

  private reportRenderError(error: unknown): void {
    const normalized = error instanceof Error ? error : new Error(String(error));
    process.stderr.write(`[rocketstats:render] ${normalized.message}\n`);
  }
}
