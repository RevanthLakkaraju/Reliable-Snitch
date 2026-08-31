"use client";
import Image from "next/image";
import { COORDINATION } from "@/lib/civic";
import { imageUrl } from "@/lib/client";
import type { Report } from "@/lib/domain";
export type RegisterForm = {
  ward: string;
  assignee: string;
  dueAt: string;
  providerTicket: string;
  coordination: string;
  clarification: string;
  escalated: boolean;
  photoReview: string;
  approvePhoto: boolean;
};
export function registerForm(report: Report): RegisterForm {
  const date = report.dueAt ? new Date(report.dueAt) : null;
  return {
    ward: report.ward ?? "",
    assignee: report.assignee ?? "",
    dueAt: date
      ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
      : "",
    providerTicket: report.providerTicket ?? "",
    coordination: report.coordination ?? "Not required",
    clarification: report.clarification ?? "",
    escalated: !!report.escalated,
    photoReview: "",
    approvePhoto: false,
  };
}
export default function RegisterFields({
  report,
  value,
  onChange,
}: {
  report: Report;
  value: RegisterForm;
  onChange: (value: RegisterForm) => void;
}) {
  const field = (key: keyof RegisterForm, updated: string | boolean) =>
    onChange({ ...value, [key]: updated });
  return (
    <div className="register-fields">
      <h4>Municipal action register</h4>
      <div className="field-grid">
        <label>
          Locality / ward
          <input
            value={value.ward}
            maxLength={120}
            onChange={(e) => field("ward", e.target.value)}
          />
        </label>
        <label>
          Responsible official / staff reference
          <input
            value={value.assignee}
            maxLength={80}
            onChange={(e) => field("assignee", e.target.value)}
          />
        </label>
        <label>
          Response target (demo)
          <input
            type="datetime-local"
            value={value.dueAt}
            onChange={(e) => field("dueAt", e.target.value)}
          />
        </label>
        {report.provider && (
          <>
            <label>
              Provider ticket / reference
              <input
                value={value.providerTicket}
                maxLength={100}
                onChange={(e) => field("providerTicket", e.target.value)}
              />
            </label>
            <label>
              Provider coordination
              <select
                value={value.coordination}
                onChange={(e) => field("coordination", e.target.value)}
              >
                {COORDINATION.filter((v) => v !== "Not required").map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      {report.provider && (
        <p>
          <strong>Selected provider: {report.provider}</strong>
          <br />
          <small>
            Record actual contact manually. This prototype does not call or
            notify the provider.
          </small>
        </p>
      )}
      <label>
        Request clarification from the citizen
        <textarea
          value={value.clarification}
          maxLength={1500}
          placeholder="Leave empty when no clarification is needed."
          onChange={(e) => field("clarification", e.target.value)}
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.escalated}
          onChange={(e) => field("escalated", e.target.checked)}
        />
        Escalate for supervisory review
      </label>
      <p className="field-hint">
        Targets are configurable demonstration targets, not government
        deadlines. Transfers and register changes require an action-taken note
        below.
      </p>
      {report.photoKey && !report.photoApproved && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={value.approvePhoto}
            onChange={(e) => field("approvePhoto", e.target.checked)}
          />
          Approve the original photo for the citizen locality map
        </label>
      )}
      {report.pendingPhotoId && report.pendingPhotoKey && (
        <div>
          <h4>Citizen photo awaiting review</h4>
          <Image
            unoptimized
            src={imageUrl(report.pendingPhotoKey)}
            width={600}
            height={400}
            alt="Citizen-contributed photo awaiting review"
            className="review-photo"
          />
          <label>
            Photo review
            <select
              value={value.photoReview}
              onChange={(e) => field("photoReview", e.target.value)}
            >
              <option value="">Leave pending</option>
              <option value="approve">
                Approve and attach to this complaint
              </option>
              <option value="reject">Do not approve</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
