/**
 * Ekstraksi YouTube Video ID dari berbagai variasi URL
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * Pengelola Interval Tontonan Video (Anti-Scrubbing)
 * Membagi durasi video menjadi potongan 5 detik.
 * Hanya potongan waktu yang benar-benar dimainkan secara berurutan yang dicatat.
 */
export class YouTubeWatchTracker {
  private watchedChunks = new Set<number>();
  private readonly chunkSize = 5; // 5 detik per segmen
  private duration = 0;

  constructor(videoDuration: number) {
    this.duration = Math.max(1, videoDuration);
  }

  public setDuration(dur: number) {
    if (dur > 0) this.duration = dur;
  }

  /**
   * Panggil fungsi ini setiap detik saat video sedang berstatus PLAYING
   */
  public recordCurrentTime(currentTime: number): number {
    if (this.duration <= 0) return 0;
    const chunkIndex = Math.floor(currentTime / this.chunkSize);
    this.watchedChunks.add(chunkIndex);
    return this.getPercentage();
  }

  /**
   * Menghitung persentase tontonan nyata unik
   */
  public getPercentage(): number {
    if (this.duration <= 0) return 0;
    const totalPossibleChunks = Math.ceil(this.duration / this.chunkSize);
    if (totalPossibleChunks <= 0) return 0;
    const pct = Math.round((this.watchedChunks.size / totalPossibleChunks) * 100);
    return Math.min(100, pct);
  }

  public getWatchedSeconds(): number {
    return Math.min(this.duration, this.watchedChunks.size * this.chunkSize);
  }

  public getDuration(): number {
    return this.duration;
  }

  public isThresholdMet(thresholdPercentage: number = 85): boolean {
    return this.getPercentage() >= thresholdPercentage;
  }
}
