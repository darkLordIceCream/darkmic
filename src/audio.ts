/**
 * Audio pipeline — processes incoming opus chunks through FFmpeg
 * and pipes decoded PCM to the virtual audio device.
 *
 * Stub for F-001. Full implementation in F-003.
 */

export interface AudioPipe {
  write(chunk: Buffer): void;
  close(): void;
}

export function createAudioPipe(): AudioPipe {
  console.log('Audio pipe: not yet implemented (F-003)');
  return {
    write(_chunk: Buffer) {
      // No-op until F-003
    },
    close() {
      // No-op until F-003
    },
  };
}
