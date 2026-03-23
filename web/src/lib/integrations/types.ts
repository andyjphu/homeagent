export interface SyncResult {
  contactsSynced: number;
  contactsCreated: number;
  contactsUpdated: number;
  dealsSynced: number;
  dealsCreated: number;
  dealsUpdated: number;
  errors: SyncError[];
}

export interface SyncError {
  entity: string;
  entityId?: string;
  message: string;
  timestamp: string;
}

export function emptySyncResult(): SyncResult {
  return {
    contactsSynced: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    dealsSynced: 0,
    dealsCreated: 0,
    dealsUpdated: 0,
    errors: [],
  };
}

export interface IntegrationProvider {
  name: string;
  connect(agentId: string, credentials: Record<string, string>): Promise<void>;
  disconnect(agentId: string): Promise<void>;
  sync(agentId: string): Promise<SyncResult>;
  isConnected(agentId: string): Promise<boolean>;
}

export interface IntegrationRecord {
  id: string;
  agent_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  settings: Record<string, unknown>;
  last_sync_at: string | null;
  sync_errors: SyncError[];
  is_active: boolean;
  created_at: string;
}
