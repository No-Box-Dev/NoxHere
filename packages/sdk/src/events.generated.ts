// Generated from packages/contracts/platform-events.ts. Do not edit by hand.

export const PLATFORM_EVENT_SPEC_VERSION = 1 as const;
export const PLATFORM_EVENT_DATA_VERSION = 1 as const;
export const MAX_PLATFORM_EVENT_BYTES = 64000 as const;
export const PLATFORM_EVENT_TYPES = ["source_control.pull_request.opened","source_control.pull_request.merged","source_control.issue.created","feedback.report.created","feedback.report.reopened","feedback.report.resolved","reliability.error.detected","reliability.incident.opened","reliability.incident.resolved","engagement.user.registered","engagement.user.active","engagement.activity.recorded","capability.execution.completed","delivery.notification.queued","delivery.notification.delivered","delivery.notification.failed"] as const;
export const FORBIDDEN_PLATFORM_EVENT_KEYS = ["authorization","cookie","setcookie","token","accesstoken","refreshtoken","bottoken","apikey","privatekey","clientsecret","password","secret","email","reporteremail","userid","affecteduser"] as const;
