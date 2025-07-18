// Main application entry point
import './style.css';
import { SoundWaveSculptorApp } from './app/SoundWaveSculptorApp';

console.log('Sound Wave Sculptor - Application Starting');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - Initializing Sound Wave Sculptor');
  
  const appContainer = document.getElementById('app');
  if (appContainer) {
    const app = new SoundWaveSculptorApp(appContainer);
    app.initialize();
  } else {
    console.error('App container not found');
  }
});