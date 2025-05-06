import { registerPlugin } from '@capacitor/core';
const CapacitorVoiceRecorder = registerPlugin('CapacitorVoiceRecorder', {
    web: () => import('./web').then((m) => new m.CapacitorVoiceRecorderWeb()),
});
export * from './definitions';
export { CapacitorVoiceRecorder };
//# sourceMappingURL=index.js.map