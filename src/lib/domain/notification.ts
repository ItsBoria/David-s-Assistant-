import type {
  EntityId,
  OwnedEntity,
  UtcIsoDateTime,
} from "./shared";

export const NotificationProvider = {
  TELEGRAM: "telegram",
  EMAIL: "email",
  SMS: "sms",
  WHATSAPP: "whatsapp",
} as const;

export type NotificationProvider =
  (typeof NotificationProvider)[keyof typeof NotificationProvider];

export const NotificationOutboxStatus = {
  PENDING: "pending",
  PROCESSING: "processing",
  SENT: "sent",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type NotificationOutboxStatus =
  (typeof NotificationOutboxStatus)[keyof typeof NotificationOutboxStatus];

export interface NotificationCapabilities {
  plainText: boolean;
  buttons: boolean;
  links: boolean;
  deliveryStatus: boolean;
  incomingReplies: boolean;
  templates: boolean;
  attachments: boolean;
}

export const NOTIFICATION_CAPABILITIES = {
  [NotificationProvider.TELEGRAM]: {
    plainText: true,
    buttons: true,
    links: true,
    deliveryStatus: false,
    incomingReplies: true,
    templates: false,
    attachments: true,
  },
  [NotificationProvider.EMAIL]: {
    plainText: true,
    buttons: false,
    links: true,
    deliveryStatus: false,
    incomingReplies: false,
    templates: true,
    attachments: true,
  },
  [NotificationProvider.SMS]: {
    plainText: true,
    buttons: false,
    links: true,
    deliveryStatus: true,
    incomingReplies: false,
    templates: true,
    attachments: false,
  },
  [NotificationProvider.WHATSAPP]: {
    plainText: true,
    buttons: true,
    links: true,
    deliveryStatus: true,
    incomingReplies: true,
    templates: true,
    attachments: true,
  },
} as const satisfies Record<NotificationProvider, NotificationCapabilities>;

export interface NotificationButton {
  label: string;
  action: string;
}

export interface NotificationMessage {
  text: string;
  buttons?: readonly NotificationButton[];
  link?: string;
}

export interface NotificationOutboxItem extends OwnedEntity {
  provider: NotificationProvider;
  status: NotificationOutboxStatus;
  recipientConnectionId: EntityId;
  message: NotificationMessage;
  scheduledFor: UtcIsoDateTime;
  deduplicationKey: string;
  attemptCount: number;
  lastErrorCode: string | null;
}
