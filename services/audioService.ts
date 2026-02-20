
class AudioService {
  private bgMusic: HTMLAudioElement | null = null;
  private spinSound: HTMLAudioElement | null = null;
  private winSound: HTMLAudioElement | null = null;
  private tickSound: HTMLAudioElement | null = null;
  
  private tracks = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Synth
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', // Epic
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' // Action
  ];

  constructor() {
    if (typeof window !== 'undefined') {
      this.bgMusic = new Audio(this.tracks[0]);
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.3;

      this.spinSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3');
      this.winSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
      this.tickSound = new Audio('https://assets.mixkit.co/active_storage/sfx/586/586-preview.mp3');
    }
  }

  changeTrack(index: number) {
    if (!this.bgMusic) return;
    const wasPlaying = !this.bgMusic.paused;
    this.bgMusic.pause();
    this.bgMusic.src = this.tracks[index % this.tracks.length];
    if (wasPlaying) this.bgMusic.play().catch(() => {});
  }

  toggleMusic(play: boolean) {
    if (!this.bgMusic) return;
    if (play) {
      this.bgMusic.play().catch(e => console.warn("Audio play blocked", e));
    } else {
      this.bgMusic.pause();
    }
  }

  playSpin() { this.spinSound?.play().catch(() => {}); }
  playWin() { this.winSound?.play().catch(() => {}); }
  playTick() { 
    if (this.tickSound) {
      this.tickSound.currentTime = 0;
      this.tickSound.volume = 0.1;
      this.tickSound.play().catch(() => {});
    }
  }
}

export const audioService = new AudioService();
