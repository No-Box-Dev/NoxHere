interface Env {
  NOXCONNECT_CAPABILITIES: {
    execute(command: unknown): Promise<{
      provider: string;
      status: string;
      result: { text?: string | null };
    }>;
  };
}
