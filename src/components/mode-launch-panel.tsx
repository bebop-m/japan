import { PixelButton } from "@/components/pixel-button";

type LaunchArt =
  | "home"
  | "airport"
  | "hotel"
  | "izakaya"
  | "shopping"
  | "review"
  | "practice"
  | "departure"
  | "settings";

type ActionVariant = "primary" | "secondary" | "ghost";

export interface LaunchAction {
  label: string;
  href?: string;
  variant?: ActionVariant;
  disabled?: boolean;
}

export interface LaunchStat {
  label: string;
  value: string;
}

export interface LaunchMenuItem {
  label: string;
  value: string;
  href: string;
  variant?: ActionVariant;
}

interface ModeLaunchPanelProps {
  modeLabel: string;
  badge?: string;
  title: string;
  subtitle: string;
  dialogTitle: string;
  dialogLines: string[];
  stats: LaunchStat[];
  primaryAction: LaunchAction;
  secondaryActions?: LaunchAction[];
  menuItems?: LaunchMenuItem[];
  art?: LaunchArt;
  footerNote?: string;
}

function LaunchButton({
  action,
  className
}: {
  action: LaunchAction;
  className?: string;
}) {
  const classes = ["launch-panel__action", className].filter(Boolean).join(" ");

  if (!action.href || action.disabled) {
    return (
      <PixelButton
        type="button"
        variant={action.variant ?? "primary"}
        className={classes}
        aria-disabled="true"
      >
        {action.label}
      </PixelButton>
    );
  }

  return (
    <PixelButton href={action.href} variant={action.variant ?? "primary"} className={classes}>
      {action.label}
    </PixelButton>
  );
}

export function ModeLaunchPanel({
  modeLabel,
  badge,
  title,
  subtitle,
  dialogTitle,
  dialogLines,
  stats,
  primaryAction,
  secondaryActions = [],
  menuItems = [],
  art = "home",
  footerNote
}: ModeLaunchPanelProps) {
  return (
    <section className="launch-panel">
      <div className="launch-panel__shell">
        <div className="launch-panel__topline">
          <span className="launch-panel__mode">{modeLabel}</span>
          {badge ? <span className="launch-panel__badge">{badge}</span> : null}
        </div>

        <div className={`launch-panel__stage launch-panel__stage--${art}`.trim()}>
          <span className="launch-panel__cloud launch-panel__cloud--a" />
          <span className="launch-panel__cloud launch-panel__cloud--b" />
          <span className="launch-panel__land launch-panel__land--back" />
          <span className="launch-panel__land launch-panel__land--front" />
          <span className="launch-panel__sprite launch-panel__sprite--main" />
          <span className="launch-panel__sprite launch-panel__sprite--alt" />
          <div className="launch-panel__banner">{title}</div>
          <div className="launch-panel__subtitle">{subtitle}</div>
        </div>

        <div className="launch-panel__dialog">
          <div className="launch-panel__dialog-title">{dialogTitle}</div>
          <div className="launch-panel__dialog-lines">
            {dialogLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="launch-panel__stats">
          {stats.map((stat) => (
            <div key={stat.label} className="launch-panel__stat">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>

        <LaunchButton action={primaryAction} className="launch-panel__primary" />

        {secondaryActions.length > 0 ? (
          <div className="launch-panel__secondary-row">
            {secondaryActions.map((action) => (
              <LaunchButton
                key={`${action.label}-${action.href ?? "button"}`}
                action={action}
              />
            ))}
          </div>
        ) : null}

        {menuItems.length > 0 ? (
          <div className="launch-panel__menu">
            {menuItems.map((item) => (
              <PixelButton
                key={`${item.label}-${item.value}`}
                href={item.href}
                variant={item.variant ?? "ghost"}
                className="launch-panel__menu-item"
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </PixelButton>
            ))}
          </div>
        ) : null}
      </div>

      {footerNote ? <div className="launch-panel__footer-note">{footerNote}</div> : null}
    </section>
  );
}
