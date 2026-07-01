/**
 * testModeStore.ts
 * Singleton puro (no React) — cualquier archivo lo puede importar
 * Se sincroniza desde TestModeContext
 */
export const testModeStore = {
  isActive:  false,
  sessionId: null as string | null,

  activate(sid: string) {
    this.isActive  = true;
    this.sessionId = sid;
  },

  deactivate() {
    this.isActive  = false;
    this.sessionId = null;
  },
};