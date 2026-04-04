"use client";

/**
 * ExclusionAlert Component — HustleGuard AI
 *
 * Displayed in the rider dashboard when a parametric trigger fires but a
 * policy exclusion blocks the payout. Shows a clear, transparent explanation
 * so the rider understands WHY they won't be paid.
 *
 * This is critical UX — without this, riders would think the system is broken
 * when actually the policy is working as intended (blocking pandemic/war claims).
 *
 * Usage: Render when TriggerEvaluateResponse.triggered === false
 *        AND exclusion_category is set (not null/none).
 */

type ExclusionAlertProps = {
  exclusionCategory: string;
  exclusionTitle: string;
  exclusionDescription: string;
  canAppeal: boolean;
  appealInstructions?: string | null;
  onDismiss?: () => void;
};

const CATEGORY_ICONS: Record<string, string> = {
  war: "⚔️",
  pandemic: "🦠",
  terrorism: "💥",
  nuclear: "☢️",
  government_order: "🏛️",
  force_majeure: "🌋",
  intentional: "🚫",
  none: "ℹ️",
};

export default function ExclusionAlert({
  exclusionCategory,
  exclusionTitle,
  exclusionDescription,
  canAppeal,
  appealInstructions,
  onDismiss,
}: ExclusionAlertProps) {
  const icon = CATEGORY_ICONS[exclusionCategory] ?? "❌";
  const isAbsolute = !canAppeal;

  return (
    <div
      className="exc-alert"
      style={{
        borderColor: isAbsolute ? "#E24B4A" : "#EF9F27",
        background: isAbsolute ? "#FCEBEB" : "#FAEEDA",
      }}
    >
      {/* Header */}
      <div className="exc-header">
        <span className="exc-icon">{icon}</span>
        <div className="exc-headline">
          <div className="exc-label" style={{ color: isAbsolute ? "#A32D2D" : "#854F0B" }}>
            Payout Blocked — Policy Exclusion
          </div>
          <div className="exc-title" style={{ color: isAbsolute ? "#791F1F" : "#633806" }}>
            {exclusionTitle}
          </div>
        </div>
        {onDismiss && (
          <button type="button" className="exc-dismiss" onClick={onDismiss}>✕</button>
        )}
      </div>

      {/* Description */}
      <div className="exc-desc">{exclusionDescription}</div>

      {/* Appeal section */}
      {canAppeal && appealInstructions && (
        <div className="exc-appeal">
          <div className="exc-appeal-label">⚖️ You may be eligible to appeal this decision</div>
          <div className="exc-appeal-text">{appealInstructions}</div>
        </div>
      )}

      {/* Absolute exclusion note */}
      {isAbsolute && (
        <div className="exc-absolute-note">
          This exclusion is absolute and cannot be appealed. It is a standard requirement for all parametric insurance products under IRDAI regulations.
        </div>
      )}

      {/* Policy link */}
      <div className="exc-footer">
        <span>View full policy exclusions under </span>
        <strong>Policy → Exclusions</strong>
      </div>

      <style>{`
        .exc-alert { border: 0.5px solid; border-radius: 10px; padding: 14px 16px; font-family: var(--font-sans, system-ui); }
        .exc-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
        .exc-icon { font-size: 22px; flex-shrink: 0; line-height: 1; }
        .exc-headline { flex: 1; }
        .exc-label { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 2px; }
        .exc-title { font-size: 14px; font-weight: 600; }
        .exc-dismiss { background: transparent; border: none; cursor: pointer; color: #9CA3AF; font-size: 14px; padding: 0; flex-shrink: 0; }
        .exc-desc { font-size: 12px; line-height: 1.5; color: #4B5563; margin-bottom: 10px; }
        .exc-appeal { background: rgba(255,255,255,0.6); border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; }
        .exc-appeal-label { font-size: 12px; font-weight: 600; color: #633806; margin-bottom: 4px; }
        .exc-appeal-text { font-size: 11px; color: #854F0B; line-height: 1.4; }
        .exc-absolute-note { font-size: 11px; color: #791F1F; background: rgba(255,255,255,0.5); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; line-height: 1.4; }
        .exc-footer { font-size: 11px; color: #9CA3AF; border-top: 0.5px solid rgba(0,0,0,0.08); padding-top: 8px; }
      `}</style>
    </div>
  );
}
